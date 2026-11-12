-- =====================================================================
-- STEP 9 : BASIC BOOKING INTEGRITY
-- Run in a sample-data schema after 02, 03 and 05, with auto-commit off.
--
-- Almost every rule is already enforced by constraints in 02_create_tables:
--
--   Invalid situation                           Stopped by                     Oracle error
--   ------------------------------------------  -----------------------------  ------------
--   Booking a nonexistent show                  fk_booking_show                ORA-02291
--   Booking for a nonexistent user              fk_booking_user                ORA-02291
--   Booking a nonexistent seat                  fk_bseat_seat                  ORA-02291
--   Same seat twice for the same show           uq_bseat_show_seat             ORA-00001
--   BOOKING_SEAT show_id ≠ the booking's show   fk_bseat_booking (composite)   ORA-02291
--   Invalid booking status                      ck_booking_status              ORA-02290
--   Invalid payment status / method             ck_pay_status / ck_pay_method  ORA-02290
--   SUCCESS payment with no timestamp           ck_pay_paid_at                 ORA-02290
--   Second payment row for one booking          uq_payment_booking             ORA-00001
--   Seat from a DIFFERENT screen than the show  trigger below                  ORA-20001
--
-- The last rule needs a trigger because it compares values in two OTHER
-- tables (SEAT.screen_id and MOVIE_SHOW.screen_id). CHECK constraints can
-- only look at the row being inserted, and a foreign key can only say
-- "this value exists", not "these two looked-up values are equal".
-- =====================================================================


-- ---------------------------------------------------------------------
-- TRIGGER: the seat being booked must be in the screen the show runs on.
-- It reads MOVIE_SHOW and SEAT (not BOOKING_SEAT itself), so there is no
-- "mutating table" error.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_booking_seat_screen
BEFORE INSERT OR UPDATE OF seat_id, show_id ON booking_seat
FOR EACH ROW
DECLARE
  v_show_screen  movie_show.screen_id%TYPE;
  v_seat_screen  seat.screen_id%TYPE;
BEGIN
  SELECT screen_id INTO v_show_screen FROM movie_show WHERE show_id = :NEW.show_id;
  SELECT screen_id INTO v_seat_screen FROM seat       WHERE seat_id = :NEW.seat_id;

  IF v_show_screen <> v_seat_screen THEN
    RAISE_APPLICATION_ERROR(-20001,
      'Seat ' || :NEW.seat_id || ' is not in screen ' || v_show_screen ||
      ' where show ' || :NEW.show_id || ' is running.');
  END IF;
EXCEPTION
  -- If the show or seat does not exist, do nothing here and let the
  -- foreign-key constraint report the proper ORA-02291 error.
  WHEN NO_DATA_FOUND THEN
    NULL;
END;
/


-- =====================================================================
-- TEST SCRIPT
-- Run with F5. Statements marked "EXPECT ERROR" should fail with the
-- given error; SQL Developer keeps running the rest of the script.
--
-- Teaching point: in Oracle a failed statement is rolled back on its own
-- (statement-level atomicity). The earlier successful statements of the
-- same transaction are NOT undone until we issue ROLLBACK.
-- Everything is rolled back at the end, so the sample data stays clean.
-- =====================================================================

-- ---- 1. A valid booking (divya_p books seat A1 for show 1) ----------
INSERT INTO booking (booking_id, user_id, show_id, status)
VALUES (900, 8, 1, 'PENDING');

INSERT INTO booking_seat (booking_id, show_id, seat_id, price_paid)
VALUES (900, 1, 101, 250)                                   /* OK: A1 is free */;

SAVEPOINT after_valid_seat;

-- ---- 2. Booking a nonexistent show ----------------------------------
-- EXPECT ERROR ORA-02291: integrity constraint (FK_BOOKING_SHOW) violated - parent key not found
INSERT INTO booking (booking_id, user_id, show_id, status)
VALUES (901, 8, 999, 'PENDING');

-- EXPECT ERROR ORA-02291 (FK_BOOKING_USER)
INSERT INTO booking (booking_id, user_id, show_id, status)
VALUES (901, 999, 1, 'PENDING');

-- ---- 3. Booking a nonexistent seat ----------------------------------
-- EXPECT ERROR ORA-02291 (FK_BSEAT_SEAT)
INSERT INTO booking_seat (booking_id, show_id, seat_id, price_paid)
VALUES (900, 1, 9999, 250);

-- ---- 4. Booking the same seat twice for the same show ---------------
-- Seat 105 (B1) for show 1 already belongs to booking 1.
-- EXPECT ERROR ORA-00001: unique constraint (UQ_BSEAT_SHOW_SEAT) violated
INSERT INTO booking_seat (booking_id, show_id, seat_id, price_paid)
VALUES (900, 1, 105, 250);

-- ---- 5. Seat from the wrong screen ----------------------------------
-- Show 1 runs on screen 1; seat 201 is in screen 2.
-- EXPECT ERROR ORA-20001: Seat 201 is not in screen 1 where show 1 is running.
INSERT INTO booking_seat (booking_id, show_id, seat_id, price_paid)
VALUES (900, 1, 201, 250);

-- Changing either side of a valid booking seat must also be checked.
-- EXPECT ERROR ORA-20001
UPDATE booking_seat SET seat_id = 201
WHERE booking_id = 900 AND seat_id = 101;

-- EXPECT ERROR ORA-20001
UPDATE booking_seat SET show_id = 2
WHERE booking_id = 900 AND seat_id = 101;

-- ---- 6. show_id in BOOKING_SEAT disagrees with the booking ----------
-- Booking 900 is for show 1, but this row claims show 2.
-- (Seat 401 IS in show 2's screen, so the trigger passes; the composite FK catches it.)
-- EXPECT ERROR ORA-02291 (FK_BSEAT_BOOKING)
INSERT INTO booking_seat (booking_id, show_id, seat_id, price_paid)
VALUES (900, 2, 401, 200);

-- ---- 7. Invalid booking status --------------------------------------
-- EXPECT ERROR ORA-02290: check constraint (CK_BOOKING_STATUS) violated
INSERT INTO booking (booking_id, user_id, show_id, status)
VALUES (902, 8, 1, 'DONE');

-- EXPECT ERROR ORA-02290 (CK_BOOKING_STATUS) — also applies to UPDATE
UPDATE booking SET status = 'BOOKED' WHERE booking_id = 900;

-- ---- 8. Invalid payment status / method -----------------------------
-- EXPECT ERROR ORA-02290 (CK_PAY_STATUS)
INSERT INTO payment (payment_id, booking_id, amount, payment_method, payment_status, paid_at)
VALUES (900, 900, 250, 'UPI', 'PAID', SYSDATE);

-- EXPECT ERROR ORA-02290 (CK_PAY_METHOD)
INSERT INTO payment (payment_id, booking_id, amount, payment_method, payment_status, paid_at)
VALUES (900, 900, 250, 'CASH', 'SUCCESS', SYSDATE);

-- ---- 9. SUCCESS payment without a payment time ----------------------
-- EXPECT ERROR ORA-02290 (CK_PAY_PAID_AT)
INSERT INTO payment (payment_id, booking_id, amount, payment_method, payment_status)
VALUES (900, 900, 250, 'UPI', 'SUCCESS');

-- ---- 10. Complete the valid booking correctly -----------------------
INSERT INTO payment (payment_id, booking_id, amount, payment_method, payment_status, paid_at)
VALUES (900, 900, 250, 'UPI', 'SUCCESS', SYSDATE)           /* OK */;

UPDATE booking SET status = 'CONFIRMED' WHERE booking_id = 900  /* OK */;

-- ---- 11. A second payment for the same booking ----------------------
-- EXPECT ERROR ORA-00001 (UQ_PAYMENT_BOOKING)
INSERT INTO payment (payment_id, booking_id, amount, payment_method, payment_status, paid_at)
VALUES (901, 900, 250, 'CARD', 'SUCCESS', SYSDATE);

-- The valid work from steps 1 and 10 is still visible in THIS session:
SELECT seat_label, seat_status FROM show_seat_status
WHERE show_id = 1 AND seat_row = 'A'
ORDER BY seat_number;
-- A1 shows as BOOKED and A2 through A4 remain AVAILABLE.

-- ---- 12. ROLLBACK TO SAVEPOINT vs full ROLLBACK ---------------------
-- Undo everything after the savepoint (the payment + CONFIRMED status),
-- but keep booking 900 and its seat:
ROLLBACK TO SAVEPOINT after_valid_seat;

SELECT booking_id, status FROM booking WHERE booking_id = 900   /* still PENDING */;
SELECT COUNT(*) AS payments_for_900 FROM payment WHERE booking_id = 900  /* 0 */;

-- Now undo the whole test transaction so the sample data is unchanged:
ROLLBACK;

SELECT COUNT(*) AS booking_900_rows FROM booking WHERE booking_id = 900  /* 0 */;
SELECT COUNT(*) AS seat_101_booked FROM show_seat_status
WHERE show_id = 1 AND seat_id = 101 AND seat_status = 'BOOKED' /* 0 */;


-- =====================================================================
-- OPTIONAL LIVE DEMO: two users trying to grab the same seat
-- (simple, but shows why the UNIQUE constraint matters)
--
-- Open TWO separate sessions in SQL Developer: a normal worksheet plus
-- Tools → "Unshared SQL Worksheet" (Ctrl+Shift+N). A normal second
-- worksheet shares the same session, so it would not show blocking.
--
-- Worksheet 1:
--   INSERT INTO booking VALUES (910, 1, 3, SYSDATE, 'PENDING');
--   INSERT INTO booking_seat VALUES (910, 3, 101, 300);     -- do NOT commit yet
--
-- Worksheet 2:
--   INSERT INTO booking VALUES (911, 2, 3, SYSDATE, 'PENDING');
--   INSERT INTO booking_seat VALUES (911, 3, 101, 300);     -- this WAITS (blocked)
--
-- Worksheet 1:  COMMIT;
--   → Worksheet 2 immediately fails with ORA-00001. The seat was sold once.
-- (If Worksheet 1 does ROLLBACK instead, Worksheet 2's insert succeeds.)
--
-- Clean up afterwards:
--   DELETE FROM booking WHERE booking_id IN (910, 911); COMMIT;
-- =====================================================================
