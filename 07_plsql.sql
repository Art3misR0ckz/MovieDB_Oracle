-- =====================================================================
-- STEP 10 : INDEXES, PL/SQL FUNCTIONS, PROCEDURES AND A SECOND TRIGGER
-- Run AFTER 02 -> 06. Safe to re-run (CREATE OR REPLACE everywhere,
-- indexes are dropped first).
--
-- What this file adds:
--   Indexes    : 6 indexes on foreign-key columns the app filters on
--   Functions  : get_seat_price, get_avg_rating, seats_left
--   Procedures : book_seats, make_payment, cancel_booking,
--                save_review, print_user_activity
--   Trigger    : trg_review_clears_watchlist
--
-- TRANSACTION RULE FOR ALL PROCEDURES BELOW:
--   The procedures never COMMIT. The caller decides (COMMIT or ROLLBACK).
--   This lets one transaction contain several calls, e.g.
--   book_seats + make_payment, and then one COMMIT for both.
--   If a procedure fails half-way, it rolls back to a SAVEPOINT taken at
--   its start, so it never leaves a half-finished booking behind.
--
-- Application error codes (RAISE_APPLICATION_ERROR):
--   -20001  seat is not in the show's screen     (trigger from 06)
--   -20010  show or seat not found               (get_seat_price)
--   -20020  show does not exist                  (book_seats)
--   -20021  show has already started             (book_seats)
--   -20022  no seats selected / > 10 seats       (book_seats)
--   -20024  seat already booked for this show    (book_seats)
--   -20030  booking does not exist               (make_payment)
--   -20031  booking is not awaiting payment      (make_payment)
--   -20040  booking does not exist               (cancel_booking)
--   -20041  booking already cancelled            (cancel_booking)
--   -20042  show already started                 (cancel_booking)
-- =====================================================================

SET SERVEROUTPUT ON;


-- =====================================================================
-- 1. INDEXES
-- Oracle automatically creates an index for every PRIMARY KEY and UNIQUE
-- constraint, but NOT for foreign keys. These are the FK columns that
-- the web app searches on most often ("my bookings", "shows of this
-- movie", "reviews of this movie" ...).
--
-- Already covered by an automatic index (so no new index needed):
--   SCREEN(theatre_id)    -> leading column of UQ_SCREEN_THEATRE_NO
--   SEAT(screen_id)       -> leading column of UQ_SEAT_POSITION
--   BOOKING_SEAT(show_id) -> leading column of UQ_BSEAT_SHOW_SEAT
--   PAYMENT(booking_id)   -> UQ_PAYMENT_BOOKING
--   REVIEW(user_id), WATCHLIST(user_id), MOVIE_GENRE(movie_id) ...
--                         -> leading column of the composite PK
-- =====================================================================
BEGIN
  FOR i IN (SELECT index_name FROM user_indexes
            WHERE  index_name IN ('IDX_BOOKING_USER','IDX_BOOKING_SHOW','IDX_SHOW_MOVIE',
                                  'IDX_REVIEW_MOVIE','IDX_WATCHLIST_MOVIE','IDX_MOVIE_GENRE_GENRE')) LOOP
    EXECUTE IMMEDIATE 'DROP INDEX ' || i.index_name;
  END LOOP;
END;
/

CREATE INDEX idx_booking_user      ON booking (user_id);
CREATE INDEX idx_booking_show      ON booking (show_id);
CREATE INDEX idx_show_movie        ON movie_show (movie_id);
CREATE INDEX idx_review_movie      ON review (movie_id);
CREATE INDEX idx_watchlist_movie   ON watchlist (movie_id);
CREATE INDEX idx_movie_genre_genre ON movie_genre (genre_id);

-- All indexes on our tables (automatic ones are named after their constraint)
SELECT table_name, index_name, uniqueness
FROM   user_indexes
ORDER  BY table_name, index_name;


-- =====================================================================
-- 2. FUNCTIONS
-- =====================================================================

-- ---------------------------------------------------------------------
-- get_seat_price: business rule BR15 in ONE place.
-- Premium seats cost the show's base price + 100, regular seats the
-- base price. Used by book_seats and can be used in any SELECT.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_seat_price (
  p_show_id IN movie_show.show_id%TYPE,
  p_seat_id IN seat.seat_id%TYPE
) RETURN NUMBER
IS
  v_base_price  movie_show.base_price%TYPE;
  v_seat_type   seat.seat_type%TYPE;
BEGIN
  SELECT base_price INTO v_base_price FROM movie_show WHERE show_id = p_show_id;
  SELECT seat_type  INTO v_seat_type  FROM seat       WHERE seat_id = p_seat_id;

  IF v_seat_type = 'PREMIUM' THEN
    RETURN v_base_price + 100;
  ELSE
    RETURN v_base_price;
  END IF;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20010,
      'Show ' || p_show_id || ' or seat ' || p_seat_id || ' does not exist.');
END get_seat_price;
/

-- ---------------------------------------------------------------------
-- get_avg_rating: average rating of a movie, NULL if nobody rated it.
-- (AVG over zero rows returns NULL, so no NO_DATA_FOUND handling needed.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_avg_rating (
  p_movie_id IN movie.movie_id%TYPE
) RETURN NUMBER
IS
  v_avg NUMBER;
BEGIN
  SELECT ROUND(AVG(rating), 2) INTO v_avg
  FROM   review
  WHERE  movie_id = p_movie_id;

  RETURN v_avg;
END get_avg_rating;
/

-- ---------------------------------------------------------------------
-- seats_left: free seats for a show = seats in its screen - seats booked.
-- Returns NULL if the show does not exist.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seats_left (
  p_show_id IN movie_show.show_id%TYPE
) RETURN NUMBER
IS
  v_capacity NUMBER;
  v_booked   NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_capacity
  FROM   seat st
  JOIN   movie_show sh ON sh.screen_id = st.screen_id
  WHERE  sh.show_id = p_show_id;

  IF v_capacity = 0 THEN
    RETURN NULL;                      -- no such show
  END IF;

  SELECT COUNT(*) INTO v_booked FROM booking_seat WHERE show_id = p_show_id;

  RETURN v_capacity - v_booked;
END seats_left;
/

-- Functions can be called inside ordinary SQL:
SELECT m.title, get_avg_rating(m.movie_id) AS avg_rating
FROM   movie m
ORDER  BY avg_rating DESC NULLS LAST;

SELECT sh.show_id, m.title, seats_left(sh.show_id) AS seats_left,
       get_seat_price(sh.show_id, 101) AS price_a1_if_screen1
FROM   movie_show sh
JOIN   movie m ON m.movie_id = sh.movie_id
WHERE  sh.screen_id = 1;


-- =====================================================================
-- 3. PROCEDURES
-- =====================================================================

-- ---------------------------------------------------------------------
-- book_seats: books a list of seats for one show as ONE unit of work.
--
--   p_seat_ids is a comma-separated list of seat IDs, e.g. '101,102'.
--   (A plain string keeps it easy to call from SQL Developer and from the
--    web app. REGEXP_SUBSTR picks out the i-th number.)
--
-- Steps:
--   1. check the show exists and has not started
--   2. insert a PENDING booking and get its new ID from booking_seq
--   3. insert one BOOKING_SEAT row per seat, priced with get_seat_price
-- If ANY seat fails (taken, wrong screen, does not exist) everything done
-- by this call is undone with ROLLBACK TO SAVEPOINT, so either all seats
-- are booked or none are (atomicity).
--
-- Note there is no "is this seat free?" SELECT before inserting. The
-- UNIQUE (show_id, seat_id) constraint already answers that, and it is
-- safe even when two users click "Book" at the same moment.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE book_seats (
  p_user_id    IN  app_user.user_id%TYPE,
  p_show_id    IN  movie_show.show_id%TYPE,
  p_seat_ids   IN  VARCHAR2,
  p_booking_id OUT booking.booking_id%TYPE
)
IS
  v_show_start  movie_show.show_start%TYPE;
  v_seat_count  NUMBER;
  v_seat_id     seat.seat_id%TYPE;
BEGIN
  SAVEPOINT start_booking;
  p_booking_id := NULL;

  -- 1. Show must exist and be in the future
  BEGIN
    SELECT show_start INTO v_show_start FROM movie_show WHERE show_id = p_show_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20020, 'Show ' || p_show_id || ' does not exist.');
  END;

  IF v_show_start <= SYSDATE THEN
    RAISE_APPLICATION_ERROR(-20021, 'This show has already started.');
  END IF;

  v_seat_count := NVL(REGEXP_COUNT(p_seat_ids, '[^,]+'), 0);
  IF v_seat_count = 0 OR v_seat_count > 10 THEN
    RAISE_APPLICATION_ERROR(-20022, 'Select between 1 and 10 seats.');
  END IF;

  -- 2. The booking itself (FK checks that the user exists)
  INSERT INTO booking (booking_id, user_id, show_id, booking_time, status)
  VALUES (booking_seq.NEXTVAL, p_user_id, p_show_id, SYSDATE, 'PENDING')
  RETURNING booking_id INTO p_booking_id;

  -- 3. One row per seat
  FOR i IN 1 .. v_seat_count LOOP
    v_seat_id := TO_NUMBER(TRIM(REGEXP_SUBSTR(p_seat_ids, '[^,]+', 1, i)));

    INSERT INTO booking_seat (booking_id, show_id, seat_id, price_paid)
    VALUES (p_booking_id, p_show_id, v_seat_id, get_seat_price(p_show_id, v_seat_id));
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('Booking ' || p_booking_id || ' created with ' ||
                       v_seat_count || ' seat(s). Status: PENDING.');
EXCEPTION
  WHEN DUP_VAL_ON_INDEX THEN
    -- ORA-00001 from UQ_BSEAT_SHOW_SEAT (or the same seat twice in the list)
    ROLLBACK TO start_booking;
    p_booking_id := NULL;
    RAISE_APPLICATION_ERROR(-20024, 'One or more of these seats is already booked for this show.');
  WHEN OTHERS THEN
    ROLLBACK TO start_booking;
    p_booking_id := NULL;
    RAISE;                          -- pass the original error to the caller
END book_seats;
/

-- ---------------------------------------------------------------------
-- make_payment: simulated payment (always succeeds).
-- The amount is the sum of the seat prices. Uses MERGE because a
-- booking may already have a PENDING/FAILED payment row (assumption 5:
-- a retry updates that row instead of adding a second one).
-- SELECT ... FOR UPDATE locks the booking row so the same booking
-- cannot be paid twice at the same time.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE make_payment (
  p_booking_id IN booking.booking_id%TYPE,
  p_method     IN payment.payment_method%TYPE
)
IS
  v_status  booking.status%TYPE;
  v_amount  payment.amount%TYPE;
BEGIN
  SAVEPOINT start_payment;

  BEGIN
    SELECT status INTO v_status
    FROM   booking
    WHERE  booking_id = p_booking_id
    FOR UPDATE;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20030, 'Booking ' || p_booking_id || ' does not exist.');
  END;

  IF v_status <> 'PENDING' THEN
    RAISE_APPLICATION_ERROR(-20031, 'Booking ' || p_booking_id || ' is ' || v_status ||
                                    ', not awaiting payment.');
  END IF;

  SELECT SUM(price_paid) INTO v_amount FROM booking_seat WHERE booking_id = p_booking_id;

  MERGE INTO payment p
  USING (SELECT p_booking_id AS booking_id FROM dual) src
  ON (p.booking_id = src.booking_id)
  WHEN MATCHED THEN
    UPDATE SET p.amount         = v_amount,
               p.payment_method = p_method,
               p.payment_status = 'SUCCESS',
               p.paid_at        = SYSDATE
  WHEN NOT MATCHED THEN
    INSERT (payment_id, booking_id, amount, payment_method, payment_status, paid_at)
    VALUES (payment_seq.NEXTVAL, p_booking_id, v_amount, p_method, 'SUCCESS', SYSDATE);

  UPDATE booking SET status = 'CONFIRMED' WHERE booking_id = p_booking_id;

  DBMS_OUTPUT.PUT_LINE('Payment of Rs ' || v_amount || ' by ' || p_method ||
                       ' received. Booking ' || p_booking_id || ' is CONFIRMED.');
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK TO start_payment;
    RAISE;                          -- e.g. ORA-02290 if the method is invalid
END make_payment;
/

-- ---------------------------------------------------------------------
-- cancel_booking: business rule BR16.
-- Frees the seats (deletes the BOOKING_SEAT rows), keeps the booking row
-- as CANCELLED for history, and marks a successful payment REFUNDED.
-- Not allowed once the show has started.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE cancel_booking (
  p_booking_id IN booking.booking_id%TYPE
)
IS
  v_status      booking.status%TYPE;
  v_show_start  movie_show.show_start%TYPE;
  v_seats_freed NUMBER;
BEGIN
  SAVEPOINT start_cancel;

  BEGIN
    SELECT b.status, sh.show_start
    INTO   v_status, v_show_start
    FROM   booking b
    JOIN   movie_show sh ON sh.show_id = b.show_id
    WHERE  b.booking_id = p_booking_id
    FOR UPDATE OF b.status;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20040, 'Booking ' || p_booking_id || ' does not exist.');
  END;

  IF v_status = 'CANCELLED' THEN
    RAISE_APPLICATION_ERROR(-20041, 'Booking ' || p_booking_id || ' is already cancelled.');
  END IF;

  IF v_show_start <= SYSDATE THEN
    RAISE_APPLICATION_ERROR(-20042, 'The show has already started; it cannot be cancelled.');
  END IF;

  DELETE FROM booking_seat WHERE booking_id = p_booking_id;
  v_seats_freed := SQL%ROWCOUNT;

  UPDATE booking SET status = 'CANCELLED' WHERE booking_id = p_booking_id;

  -- paid_at keeps its value, so ck_pay_paid_at is still satisfied
  UPDATE payment SET payment_status = 'REFUNDED'
  WHERE  booking_id = p_booking_id AND payment_status = 'SUCCESS';

  IF SQL%ROWCOUNT = 1 THEN
    DBMS_OUTPUT.PUT_LINE('Booking ' || p_booking_id || ' cancelled, ' || v_seats_freed ||
                         ' seat(s) freed, payment refunded.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Booking ' || p_booking_id || ' cancelled, ' || v_seats_freed ||
                         ' seat(s) freed (nothing was paid).');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK TO start_cancel;
    RAISE;
END cancel_booking;
/

-- ---------------------------------------------------------------------
-- save_review: add a review, or update it if the user already reviewed
-- this movie (BR2: one review per user per movie). MERGE = "insert or
-- update" in one statement. The rating is still checked by ck_rev_rating.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE save_review (
  p_user_id  IN review.user_id%TYPE,
  p_movie_id IN review.movie_id%TYPE,
  p_rating   IN review.rating%TYPE,
  p_text     IN review.review_text%TYPE DEFAULT NULL
)
IS
BEGIN
  MERGE INTO review r
  USING (SELECT p_user_id AS user_id, p_movie_id AS movie_id FROM dual) src
  ON (r.user_id = src.user_id AND r.movie_id = src.movie_id)
  WHEN MATCHED THEN
    UPDATE SET r.rating      = p_rating,
               r.review_text = p_text,
               r.review_date = SYSDATE
  WHEN NOT MATCHED THEN
    INSERT (user_id, movie_id, rating, review_text, review_date)
    VALUES (p_user_id, p_movie_id, p_rating, p_text, SYSDATE);
END save_review;
/

-- ---------------------------------------------------------------------
-- print_user_activity: a small report printed with DBMS_OUTPUT.
-- Demonstrates the two kinds of cursor:
--   * an explicit cursor with OPEN / FETCH / EXIT WHEN %NOTFOUND / CLOSE
--   * a cursor FOR loop (Oracle opens, fetches and closes automatically)
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE print_user_activity (
  p_user_id IN app_user.user_id%TYPE
)
IS
  v_user  app_user%ROWTYPE;

  CURSOR c_reviews IS
    SELECT m.title, r.rating
    FROM   review r
    JOIN   movie m ON m.movie_id = r.movie_id
    WHERE  r.user_id = p_user_id
    ORDER  BY r.rating DESC, m.title;

  v_review  c_reviews%ROWTYPE;
  v_total   NUMBER := 0;
BEGIN
  SELECT * INTO v_user FROM app_user WHERE user_id = p_user_id;

  DBMS_OUTPUT.PUT_LINE('Activity of ' || v_user.full_name || ' (@' || v_user.username || ')');
  DBMS_OUTPUT.PUT_LINE('--------------------------------------------');

  -- Explicit cursor
  DBMS_OUTPUT.PUT_LINE('Reviews:');
  OPEN c_reviews;
  LOOP
    FETCH c_reviews INTO v_review;
    EXIT WHEN c_reviews%NOTFOUND;
    DBMS_OUTPUT.PUT_LINE('  ' || RPAD(v_review.title, 30) || TO_CHAR(v_review.rating, '0.0'));
  END LOOP;
  IF c_reviews%ROWCOUNT = 0 THEN
    DBMS_OUTPUT.PUT_LINE('  (no reviews yet)');
  END IF;
  CLOSE c_reviews;

  -- Cursor FOR loop
  DBMS_OUTPUT.PUT_LINE('Bookings:');
  FOR rec IN (SELECT bk.booking_id, m.title, bk.status,
                     NVL((SELECT SUM(bs.price_paid) FROM booking_seat bs
                          WHERE bs.booking_id = bk.booking_id), 0) AS amount
              FROM   booking bk
              JOIN   movie_show sh ON sh.show_id = bk.show_id
              JOIN   movie m       ON m.movie_id = sh.movie_id
              WHERE  bk.user_id = p_user_id
              ORDER  BY bk.booking_id) LOOP
    DBMS_OUTPUT.PUT_LINE('  #' || RPAD(rec.booking_id, 5) || RPAD(rec.title, 28) ||
                         RPAD(rec.status, 11) || 'Rs ' || rec.amount);
    IF rec.status = 'CONFIRMED' THEN
      v_total := v_total + rec.amount;
    END IF;
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('Total spent on confirmed bookings: Rs ' || v_total);
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    DBMS_OUTPUT.PUT_LINE('No user with id ' || p_user_id);
END print_user_activity;
/


-- =====================================================================
-- 4. TRIGGER: reviewing a movie removes it from your watchlist
-- (Letterboxd does this: once you have logged a film you have "watched"
--  it, so it no longer belongs on the to-watch list.)
-- AFTER INSERT only: editing an existing review should not touch the
-- watchlist. MERGE's INSERT branch also fires this trigger.
-- It modifies WATCHLIST, not REVIEW, so there is no mutating-table error.
-- (Rows in the sample data that existed before this trigger, like
--  rahul_v's Dangal, are not changed: triggers only act on new events.)
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_review_clears_watchlist
AFTER INSERT ON review
FOR EACH ROW
BEGIN
  DELETE FROM watchlist
  WHERE  user_id  = :NEW.user_id
  AND    movie_id = :NEW.movie_id;
END;
/


-- =====================================================================
-- Everything this project created (data dictionary)
-- =====================================================================
SELECT object_type, object_name, status
FROM   user_objects
WHERE  object_type IN ('FUNCTION','PROCEDURE','TRIGGER','VIEW','SEQUENCE')
ORDER  BY object_type, object_name;

-- Any compile errors would be listed here (should return no rows)
SELECT name, type, line, text FROM user_errors ORDER BY name, sequence;
