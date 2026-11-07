-- =====================================================================
-- STEP 11 : UPCOMING SHOWS (for the PL/SQL demo and the web app)
--
-- The shows in 03_sample_data.sql are fixed dates in early October 2026,
-- which are now in the past, so nothing can be booked for them
-- (book_seats refuses shows that have started).
-- This script adds 32 shows for the NEXT 4 DAYS, using dates relative to
-- SYSDATE, so the demo always has bookable shows whenever it is run.
--
-- Show IDs are fixed: show_id = 13 + (day - 1) * 8 + (slot - 1)
--   -> show 13 is tomorrow's 18:30 RRR in Cineplex Central IMAX.
--
-- Safe to re-run: it first removes shows 13-99 and anything booked on them.
-- NOTE: run 04_queries.sql BEFORE this file. Its "Expected:" comments
-- describe the 03 data only (e.g. Q24 and Q37 list more rows afterwards).
-- =====================================================================

-- Remove a previous run (payments first: PAYMENT -> BOOKING has no cascade;
-- BOOKING_SEAT rows go with ON DELETE CASCADE from BOOKING)
DELETE FROM payment
WHERE  booking_id IN (SELECT booking_id FROM booking WHERE show_id BETWEEN 13 AND 99);

DELETE FROM booking WHERE show_id BETWEEN 13 AND 99;

DELETE FROM movie_show WHERE show_id BETWEEN 13 AND 99;

-- 8 daily slots x 4 days. A PL/SQL record collection keeps the slot list
-- readable; the nested loop inserts one show per (day, slot).
DECLARE
  TYPE t_slot IS RECORD (
    movie_id   movie_show.movie_id%TYPE,
    screen_id  movie_show.screen_id%TYPE,
    start_time VARCHAR2(5),
    base_price movie_show.base_price%TYPE
  );
  TYPE t_slot_list IS TABLE OF t_slot;

  v_slots t_slot_list := t_slot_list();
  v_id    NUMBER;

  PROCEDURE add_slot (p_movie NUMBER, p_screen NUMBER, p_time VARCHAR2, p_price NUMBER) IS
  BEGIN
    v_slots.EXTEND;
    v_slots(v_slots.LAST).movie_id   := p_movie;
    v_slots(v_slots.LAST).screen_id  := p_screen;
    v_slots(v_slots.LAST).start_time := p_time;
    v_slots(v_slots.LAST).base_price := p_price;
  END;
BEGIN
  --        movie                  screen                         time     price
  add_slot(11, 1, '18:30', 250);   -- RRR           Cineplex Central  IMAX
  add_slot(2,  1, '14:00', 300);   -- Interstellar  Cineplex Central  IMAX
  add_slot(9,  2, '21:00', 180);   -- Andhadhun     Cineplex Central  Screen 2
  add_slot(6,  3, '10:30', 150);   -- Spirited Away Cineplex Central  Screen 3 (3D)
  add_slot(12, 4, '12:00', 160);   -- Eega          Starlight         Screen 1
  add_slot(4,  5, '15:00', 220);   -- Oppenheimer   Starlight         Screen 2
  add_slot(7,  6, '19:00', 150);   -- 3 Idiots      Royal Talkies
  add_slot(10, 7, '20:00', 200);   -- Baahubali 2   Orion Screens (Bengaluru)

  FOR d IN 1 .. 4 LOOP
    FOR s IN 1 .. v_slots.COUNT LOOP
      v_id := 13 + (d - 1) * 8 + (s - 1);
      INSERT INTO movie_show (show_id, movie_id, screen_id, show_start, base_price)
      VALUES (v_id,
              v_slots(s).movie_id,
              v_slots(s).screen_id,
              TO_DATE(TO_CHAR(TRUNC(SYSDATE) + d, 'YYYY-MM-DD') || ' ' || v_slots(s).start_time,
                      'YYYY-MM-DD HH24:MI'),
              v_slots(s).base_price);
    END LOOP;
  END LOOP;

  DBMS_OUTPUT.PUT_LINE(v_slots.COUNT * 4 || ' upcoming shows added.');
END;
/

COMMIT;

-- Upcoming schedule (uses the view from 05 and the function from 07)
SELECT show_id, theatre_name, screen_no, title,
       TO_CHAR(show_start, 'DD-Mon HH24:MI') AS starts, base_price,
       seats_left(show_id) AS seats_left
FROM   theatre_show_schedule
WHERE  show_start > SYSDATE
ORDER  BY show_start, theatre_name;
