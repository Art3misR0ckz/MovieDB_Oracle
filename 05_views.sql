-- =====================================================================
-- STEP 8 : VIEWS
-- A view is a stored query. It stores no data of its own; each time it
-- is queried, Oracle runs the underlying SELECT on the base tables.
-- All five views explicitly allow reads only. Booking and review changes
-- go through the base tables or the project's PL/SQL procedures.
-- =====================================================================


-- ---------------------------------------------------------------------
-- VIEW 1: MOVIE_RATING_SUMMARY
-- Purpose: the "movie page" numbers — how many reviews and the average
-- rating — without repeating the LEFT JOIN + GROUP BY in every query.
-- Also shows why we do NOT store avg_rating in MOVIE: it is derived and
-- would go stale every time a review is added (update anomaly).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW movie_rating_summary AS
SELECT m.movie_id,
       m.title,
       m.movie_language,
       COUNT(r.user_id)        AS review_count,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM   movie m
LEFT   JOIN review r ON r.movie_id = m.movie_id
GROUP  BY m.movie_id, m.title, m.movie_language
WITH READ ONLY;


-- ---------------------------------------------------------------------
-- VIEW 2: MOVIE_DETAILS
-- Purpose: one row per movie with its genres and cast as readable text.
-- The M:N tables are normalized (one row per genre/actor); this view
-- "de-normalizes" them for display only, using LISTAGG.
-- Scalar subqueries are used instead of joining both M:N tables at once:
-- joining MOVIE_GENRE and MOVIE_ACTOR together would multiply rows
-- (3 genres x 3 actors = 9 rows per movie).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW movie_details AS
SELECT m.movie_id,
       m.title,
       m.release_date,
       m.duration_min,
       m.movie_language,
       m.certificate,
       (SELECT LISTAGG(g.genre_name, ', ') WITHIN GROUP (ORDER BY g.genre_name)
        FROM   movie_genre mg
        JOIN   genre g ON g.genre_id = mg.genre_id
        WHERE  mg.movie_id = m.movie_id) AS genres,
       (SELECT LISTAGG(a.actor_name, ', ') WITHIN GROUP (ORDER BY a.actor_name, a.actor_id)
        FROM   movie_actor ma
        JOIN   actor a ON a.actor_id = ma.actor_id
        WHERE  ma.movie_id = m.movie_id) AS cast_list
FROM   movie m
WITH READ ONLY;


-- ---------------------------------------------------------------------
-- VIEW 3: THEATRE_SHOW_SCHEDULE
-- Purpose: what a customer sees when browsing "what's playing where".
-- Hides the 4-table join behind a simple name.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW theatre_show_schedule AS
SELECT sh.show_id,
       t.theatre_name,
       t.city,
       sc.screen_no,
       sc.screen_type,
       m.movie_id,
       m.title,
       m.movie_language,
       m.certificate,
       sh.show_start,
       sh.base_price
FROM   movie_show sh
JOIN   movie   m  ON m.movie_id   = sh.movie_id
JOIN   screen  sc ON sc.screen_id = sh.screen_id
JOIN   theatre t  ON t.theatre_id = sc.theatre_id
WITH READ ONLY;


-- ---------------------------------------------------------------------
-- VIEW 4: BOOKING_SUMMARY
-- Purpose: one row per booking with who, what, where, how many seats,
-- the total (computed, not stored) and the payment status.
-- LEFT JOINs keep cancelled bookings (no seats) and unpaid bookings.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW booking_summary AS
SELECT b.booking_id,
       u.username,
       m.title,
       t.theatre_name,
       sh.show_start,
       b.status                   AS booking_status,
       COUNT(bs.seat_id)          AS seat_count,
       NVL(SUM(bs.price_paid), 0) AS total_amount,
       p.payment_status,
       p.amount                   AS amount_charged
FROM   booking b
JOIN   app_user   u  ON u.user_id     = b.user_id
JOIN   movie_show sh ON sh.show_id    = b.show_id
JOIN   movie      m  ON m.movie_id    = sh.movie_id
JOIN   screen     sc ON sc.screen_id  = sh.screen_id
JOIN   theatre    t  ON t.theatre_id  = sc.theatre_id
LEFT   JOIN booking_seat bs ON bs.booking_id = b.booking_id
LEFT   JOIN payment      p  ON p.booking_id  = b.booking_id
GROUP  BY b.booking_id, u.username, m.title, t.theatre_name, sh.show_start,
          b.status, p.payment_status, p.amount
WITH READ ONLY;


-- ---------------------------------------------------------------------
-- VIEW 5: SHOW_SEAT_STATUS
-- Purpose: the seat map for every show — each seat of the show's screen
-- marked AVAILABLE or BOOKED, with its price. This is what the booking
-- screen will read in Phase 2.
-- Business rule BR15: premium seats cost base_price + 100.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW show_seat_status AS
SELECT sh.show_id,
       m.title,
       sh.show_start,
       st.seat_id,
       st.seat_row,
       st.seat_number,
       st.seat_row || st.seat_number AS seat_label,
       st.seat_type,
       CASE WHEN st.seat_type = 'PREMIUM' THEN sh.base_price + 100
            ELSE sh.base_price END   AS seat_price,
       CASE WHEN bs.seat_id IS NULL THEN 'AVAILABLE'
            ELSE 'BOOKED' END        AS seat_status
FROM   movie_show sh
JOIN   movie m  ON m.movie_id   = sh.movie_id
JOIN   seat  st ON st.screen_id = sh.screen_id
LEFT   JOIN booking_seat bs ON bs.show_id = sh.show_id
                           AND bs.seat_id = st.seat_id
WITH READ ONLY;


-- =====================================================================
-- Demo queries on the views (notice how short they become)
-- =====================================================================

-- Top-rated movies with at least 2 reviews
SELECT title, avg_rating, review_count
FROM   movie_rating_summary
WHERE  review_count >= 2
ORDER  BY avg_rating DESC, title, movie_id;

-- A movie page
SELECT * FROM movie_details WHERE title = 'Inception';

-- Everything playing in Hyderabad on 3 October
SELECT theatre_name, screen_no, title, TO_CHAR(show_start, 'HH24:MI') AS starts, base_price
FROM   theatre_show_schedule
WHERE  city = 'Hyderabad'
AND    TRUNC(show_start) = DATE '2026-10-03'
ORDER  BY show_start, show_id;

-- In the sample data, the cancelled bookings (9 and 10) retain their
-- payment records after their seat rows have been released.
SELECT booking_id, username, booking_status, total_amount, amount_charged, payment_status
FROM   booking_summary
WHERE  total_amount <> NVL(amount_charged, 0)
ORDER  BY booking_id;

-- Seat map for show 1, laid out row by row
SELECT seat_row,
       LISTAGG(seat_label || CASE seat_status WHEN 'BOOKED' THEN '(X)' ELSE '' END, '  ')
         WITHIN GROUP (ORDER BY seat_number) AS seats
FROM   show_seat_status
WHERE  show_id = 1
GROUP  BY seat_row
ORDER  BY seat_row;

-- Views are listed in the data dictionary
SELECT view_name FROM user_views ORDER BY view_name;
