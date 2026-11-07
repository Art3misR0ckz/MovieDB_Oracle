-- =====================================================================
-- STEP 12 : PL/SQL + TRANSACTION DEMO
-- Run AFTER 07_plsql.sql and 08_upcoming_shows.sql, with Run Script (F5)
-- and auto-commit OFF.
--
-- Show 13 = tomorrow 18:30, RRR, Cineplex Central Screen 1 (IMAX)
--   Screen 1 seats: A1-A4 = 101-104, B1-B4 = 105-108,
--                   C1-C4 = 109-112 (PREMIUM, base price + 100)
--
-- Parts 2 and 8 COMMIT (a booking that is then cancelled, so the seats
-- end up free again and the script can be re-run). Parts 5 and 6 end
-- with ROLLBACK so they leave no trace.
-- =====================================================================

SET SERVEROUTPUT ON;

VARIABLE v_booking NUMBER;


-- =====================================================================
-- PART 1. Functions
-- Expected: 250 (regular), 350 (premium), 12 seats left
-- =====================================================================
SELECT get_seat_price(13, 101) AS regular_price,
       get_seat_price(13, 109) AS premium_price,
       seats_left(13)          AS seats_left,
       get_avg_rating(11)      AS rrr_avg_rating
FROM   dual;


-- =====================================================================
-- PART 2. A complete booking = ONE transaction
-- priya_s books B1, B2 and C1 for show 13, pays by UPI, then COMMIT.
-- book_seats + make_payment both run before the single COMMIT, so the
-- booking can never be saved without its payment (or the other way round).
-- Expected output: booking created with 3 seats; payment of Rs 850.
-- =====================================================================
BEGIN
  book_seats(p_user_id => 2, p_show_id => 13, p_seat_ids => '105,106,109',
             p_booking_id => :v_booking);
  make_payment(:v_booking, 'UPI');
END;
/

COMMIT;

SELECT booking_id, username, title, booking_status, seat_count, total_amount, payment_status
FROM   booking_summary
WHERE  booking_id = :v_booking;

-- Expected: 9
SELECT seats_left(13) AS seats_left_after_booking FROM dual;


-- =====================================================================
-- PART 3. Atomicity: all seats or none
-- aarav_k asks for B3 (free) and B1 (just taken by priya_s).
-- book_seats inserts the booking and B3, then fails on B1, and rolls
-- back to its savepoint: the booking and B3 disappear too.
-- The error is caught here so we can print it.
-- =====================================================================
DECLARE
  v_id NUMBER;
BEGIN
  book_seats(1, 13, '107,105', v_id);
  DBMS_OUTPUT.PUT_LINE('Should not get here');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('Booking failed: ' || SQLERRM);
END;
/

-- Expected: 0 bookings for aarav_k on show 13, and B3 still AVAILABLE
SELECT COUNT(*) AS aarav_bookings_show_13
FROM   booking
WHERE  user_id = 1 AND show_id = 13;

SELECT seat_label, seat_status
FROM   show_seat_status
WHERE  show_id = 13 AND seat_row = 'B'
ORDER  BY seat_number;


-- =====================================================================
-- PART 4. Business rules enforced by the procedures
-- Each call below is EXPECTED to fail with the error shown.
-- =====================================================================

-- EXPECT ERROR ORA-20021: This show has already started. (show 1 was in October)
EXEC book_seats(1, 1, '101', :v_booking);

-- EXPECT ERROR ORA-20020: Show 999 does not exist.
EXEC book_seats(1, 999, '101', :v_booking);

-- EXPECT ERROR ORA-20022: Select between 1 and 10 seats.
EXEC book_seats(1, 13, '', :v_booking);

-- EXPECT ERROR ORA-20001 from the trigger in 06: seat 201 is in screen 2, show 13 runs on screen 1
EXEC book_seats(1, 13, '201', :v_booking);

-- EXPECT ERROR ORA-20010: Show 13 or seat 9999 does not exist.
EXEC book_seats(1, 13, '9999', :v_booking);

-- EXPECT ERROR ORA-20031: Booking 9 is CANCELLED, not awaiting payment.
EXEC make_payment(9, 'UPI');

-- EXPECT ERROR ORA-20042: The show has already started; it cannot be cancelled.
EXEC cancel_booking(1);

-- EXPECT ERROR ORA-20040: Booking 12345 does not exist.
EXEC cancel_booking(12345);


-- =====================================================================
-- PART 5. COMMIT vs ROLLBACK
-- sneha_r books A1 and A2 but does NOT commit.
-- =====================================================================
EXEC book_seats(4, 13, '101,102', :v_booking);

-- Expected: 7 (this session sees its own uncommitted change;
-- another session would still see 9 until we COMMIT)
SELECT seats_left(13) AS seats_left_uncommitted FROM dual;

-- Paying with an invalid method fails on ck_pay_method.
-- make_payment rolls back to ITS savepoint only: the booking itself survives.
-- EXPECT ERROR ORA-02290: check constraint (CK_PAY_METHOD) violated
EXEC make_payment(:v_booking, 'CASH');

-- Expected: PENDING, 2 seats, no payment
SELECT booking_id, booking_status, seat_count, payment_status
FROM   booking_summary
WHERE  booking_id = :v_booking;

-- Changed our mind: undo the whole transaction
ROLLBACK;

-- Expected: 9 again, and the booking row is gone
SELECT seats_left(13) AS seats_left_after_rollback FROM dual;
SELECT COUNT(*) AS rows_for_rolled_back_booking FROM booking WHERE booking_id = :v_booking;


-- =====================================================================
-- PART 6. save_review (MERGE) and the watchlist trigger
-- divya_p (user 8) has RRR (movie 11) on her watchlist.
-- =====================================================================

-- Expected: 1
SELECT COUNT(*) AS rrr_on_divya_watchlist FROM watchlist WHERE user_id = 8 AND movie_id = 11;

-- First review -> MERGE inserts -> trigger removes RRR from her watchlist
EXEC save_review(8, 11, 4.5, 'Saw it in IMAX. Loud and glorious.');

-- Expected: 0
SELECT COUNT(*) AS rrr_on_divya_watchlist FROM watchlist WHERE user_id = 8 AND movie_id = 11;

-- Second call -> MERGE updates the same row (still exactly one review, BR2)
EXEC save_review(8, 11, 5, 'Rewatched. Even better.');

-- Expected: 1 row, rating 5
SELECT user_id, movie_id, rating, review_text FROM review WHERE user_id = 8 AND movie_id = 11;

-- RRR's average changed from 4 to 4.25
SELECT get_avg_rating(11) AS rrr_avg_now FROM dual;

-- EXPECT ERROR ORA-02290: check constraint (CK_REV_RATING) violated (not a half-star)
EXEC save_review(8, 4, 4.3);

-- Undo part 6 so the sample data stays as in 03
ROLLBACK;


-- =====================================================================
-- PART 7. Cursor demo
-- Expected: priya_s's 5 reviews and her bookings, including today's #booking
-- =====================================================================
EXEC print_user_activity(2);


-- =====================================================================
-- PART 8. Cancel the booking from part 2 and COMMIT
-- Seats are freed, the booking stays as CANCELLED, payment -> REFUNDED.
-- =====================================================================
DECLARE
  v_id booking.booking_id%TYPE;
BEGIN
  SELECT MAX(booking_id) INTO v_id
  FROM   booking
  WHERE  user_id = 2 AND show_id = 13 AND status = 'CONFIRMED';

  cancel_booking(v_id);
END;
/

COMMIT;

-- Expected: CANCELLED, 0 seats, REFUNDED
SELECT booking_id, booking_status, seat_count, total_amount, amount_charged, payment_status
FROM   booking_summary
WHERE  username = 'priya_s' AND show_start > SYSDATE
ORDER  BY booking_id;

-- Expected: 12 (all seats free again)
SELECT seats_left(13) AS seats_left_at_end FROM dual;
