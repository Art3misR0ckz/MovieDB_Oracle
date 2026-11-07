-- =====================================================================
-- STEP 5 : TABLE CREATION
-- Movie Discovery, Review & Cinema Booking Database (Oracle)
-- Run in SQL Developer with "Run Script" (F5).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Clean up (safe to re-run). Children are dropped before parents.
--    ORA-00942 (table does not exist) is ignored on the first run.
-- ---------------------------------------------------------------------
BEGIN
  FOR t IN (SELECT column_value AS tname
              FROM TABLE(sys.odcivarchar2list(
                'PAYMENT','BOOKING_SEAT','BOOKING','MOVIE_SHOW','SEAT','SCREEN',
                'THEATRE','WATCHLIST','REVIEW','MOVIE_ACTOR','ACTOR',
                'MOVIE_GENRE','GENRE','MOVIE','APP_USER'))) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP TABLE ' || t.tname || ' CASCADE CONSTRAINTS PURGE';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
    END;
  END LOOP;

  FOR s IN (SELECT column_value AS sname
              FROM TABLE(sys.odcivarchar2list('BOOKING_SEQ','PAYMENT_SEQ','MOVIE_SEQ','SHOW_SEQ'))) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP SEQUENCE ' || s.sname;
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -2289 THEN RAISE; END IF;
    END;
  END LOOP;
END;
/

-- ---------------------------------------------------------------------
-- 1. Independent (parent) tables
-- ---------------------------------------------------------------------

CREATE TABLE app_user (
  user_id        NUMBER(6),
  username       VARCHAR2(30)  NOT NULL,
  full_name      VARCHAR2(60)  NOT NULL,
  email          VARCHAR2(80)  NOT NULL,
  phone          VARCHAR2(15),
  city           VARCHAR2(40),
  date_of_birth  DATE,
  joined_on      DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT pk_app_user        PRIMARY KEY (user_id),
  CONSTRAINT uq_user_username   UNIQUE (username),
  CONSTRAINT uq_user_email      UNIQUE (email),
  CONSTRAINT uq_user_phone      UNIQUE (phone),
  CONSTRAINT ck_user_email      CHECK (email LIKE '%_@_%._%')
);

CREATE TABLE movie (
  movie_id        NUMBER(6),
  title           VARCHAR2(100) NOT NULL,
  release_date    DATE          NOT NULL,
  duration_min    NUMBER(3)     NOT NULL,
  movie_language  VARCHAR2(20)  NOT NULL,
  certificate     VARCHAR2(2)   NOT NULL,
  description     VARCHAR2(500),
  CONSTRAINT pk_movie              PRIMARY KEY (movie_id),
  CONSTRAINT uq_movie_title_date   UNIQUE (title, release_date),
  CONSTRAINT ck_movie_duration     CHECK (duration_min BETWEEN 30 AND 300),
  CONSTRAINT ck_movie_certificate  CHECK (certificate IN ('U','UA','A','S'))
);

CREATE TABLE genre (
  genre_id    NUMBER(3),
  genre_name  VARCHAR2(30) NOT NULL,
  CONSTRAINT pk_genre       PRIMARY KEY (genre_id),
  CONSTRAINT uq_genre_name  UNIQUE (genre_name)
);

CREATE TABLE actor (
  actor_id     NUMBER(6),
  actor_name   VARCHAR2(60) NOT NULL,
  nationality  VARCHAR2(30),
  CONSTRAINT pk_actor PRIMARY KEY (actor_id)
);

CREATE TABLE theatre (
  theatre_id    NUMBER(4),
  theatre_name  VARCHAR2(60)  NOT NULL,
  city          VARCHAR2(40)  NOT NULL,
  address       VARCHAR2(150),
  CONSTRAINT pk_theatre            PRIMARY KEY (theatre_id),
  CONSTRAINT uq_theatre_name_city  UNIQUE (theatre_name, city)
);

-- ---------------------------------------------------------------------
-- 2. Associative tables for the discovery side (M:N relationships)
-- ---------------------------------------------------------------------

CREATE TABLE movie_genre (
  movie_id  NUMBER(6),
  genre_id  NUMBER(3),
  CONSTRAINT pk_movie_genre PRIMARY KEY (movie_id, genre_id),
  CONSTRAINT fk_mg_movie FOREIGN KEY (movie_id) REFERENCES movie (movie_id) ON DELETE CASCADE,
  CONSTRAINT fk_mg_genre FOREIGN KEY (genre_id) REFERENCES genre (genre_id) ON DELETE CASCADE
);

CREATE TABLE movie_actor (
  movie_id        NUMBER(6),
  actor_id        NUMBER(6),
  character_name  VARCHAR2(60),
  CONSTRAINT pk_movie_actor PRIMARY KEY (movie_id, actor_id),
  CONSTRAINT fk_ma_movie FOREIGN KEY (movie_id) REFERENCES movie (movie_id) ON DELETE CASCADE,
  CONSTRAINT fk_ma_actor FOREIGN KEY (actor_id) REFERENCES actor (actor_id) ON DELETE CASCADE
);

CREATE TABLE review (
  user_id      NUMBER(6),
  movie_id     NUMBER(6),
  rating       NUMBER(2,1)   NOT NULL,
  review_text  VARCHAR2(1000),
  review_date  DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT pk_review PRIMARY KEY (user_id, movie_id),
  CONSTRAINT fk_rev_user  FOREIGN KEY (user_id)  REFERENCES app_user (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_movie FOREIGN KEY (movie_id) REFERENCES movie (movie_id)   ON DELETE CASCADE,
  -- 0.5 to 5.0 in half-star steps
  CONSTRAINT ck_rev_rating CHECK (rating BETWEEN 0.5 AND 5 AND MOD(rating * 2, 1) = 0)
);

CREATE TABLE watchlist (
  user_id   NUMBER(6),
  movie_id  NUMBER(6),
  added_on  DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT pk_watchlist PRIMARY KEY (user_id, movie_id),
  CONSTRAINT fk_wl_user  FOREIGN KEY (user_id)  REFERENCES app_user (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_wl_movie FOREIGN KEY (movie_id) REFERENCES movie (movie_id)   ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 3. Cinema structure: THEATRE -> SCREEN -> SEAT
--    SCREEN and SEAT are weak entities; their natural keys are UNIQUE.
-- ---------------------------------------------------------------------

CREATE TABLE screen (
  screen_id    NUMBER(5),
  theatre_id   NUMBER(4)   NOT NULL,
  screen_no    NUMBER(2)   NOT NULL,
  screen_type  VARCHAR2(5) DEFAULT '2D' NOT NULL,
  CONSTRAINT pk_screen          PRIMARY KEY (screen_id),
  CONSTRAINT fk_screen_theatre  FOREIGN KEY (theatre_id) REFERENCES theatre (theatre_id),
  CONSTRAINT uq_screen_theatre_no UNIQUE (theatre_id, screen_no),
  CONSTRAINT ck_screen_no       CHECK (screen_no > 0),
  CONSTRAINT ck_screen_type     CHECK (screen_type IN ('2D','3D','IMAX'))
);

CREATE TABLE seat (
  seat_id      NUMBER(6),
  screen_id    NUMBER(5)    NOT NULL,
  seat_row     CHAR(1)      NOT NULL,
  seat_number  NUMBER(2)    NOT NULL,
  seat_type    VARCHAR2(10) DEFAULT 'REGULAR' NOT NULL,
  CONSTRAINT pk_seat          PRIMARY KEY (seat_id),
  CONSTRAINT fk_seat_screen   FOREIGN KEY (screen_id) REFERENCES screen (screen_id),
  CONSTRAINT uq_seat_position UNIQUE (screen_id, seat_row, seat_number),
  CONSTRAINT ck_seat_row      CHECK (seat_row BETWEEN 'A' AND 'Z'),
  CONSTRAINT ck_seat_number   CHECK (seat_number > 0),
  CONSTRAINT ck_seat_type     CHECK (seat_type IN ('REGULAR','PREMIUM'))
);

-- ---------------------------------------------------------------------
-- 4. Shows, bookings, payments
-- ---------------------------------------------------------------------

CREATE TABLE movie_show (
  show_id     NUMBER(6),
  movie_id    NUMBER(6)   NOT NULL,
  screen_id   NUMBER(5)   NOT NULL,
  show_start  DATE        NOT NULL,      -- Oracle DATE stores date AND time
  base_price  NUMBER(7,2) NOT NULL,
  CONSTRAINT pk_movie_show        PRIMARY KEY (show_id),
  CONSTRAINT fk_show_movie        FOREIGN KEY (movie_id)  REFERENCES movie (movie_id),
  CONSTRAINT fk_show_screen       FOREIGN KEY (screen_id) REFERENCES screen (screen_id),
  CONSTRAINT uq_show_screen_start UNIQUE (screen_id, show_start),
  CONSTRAINT ck_show_price        CHECK (base_price > 0)
);

CREATE TABLE booking (
  booking_id    NUMBER(8),
  user_id       NUMBER(6)    NOT NULL,
  show_id       NUMBER(6)    NOT NULL,
  booking_time  DATE DEFAULT SYSDATE NOT NULL,
  status        VARCHAR2(10) DEFAULT 'PENDING' NOT NULL,
  CONSTRAINT pk_booking         PRIMARY KEY (booking_id),
  CONSTRAINT fk_booking_user    FOREIGN KEY (user_id) REFERENCES app_user (user_id),
  CONSTRAINT fk_booking_show    FOREIGN KEY (show_id) REFERENCES movie_show (show_id),
  -- Exists only so BOOKING_SEAT can reference (booking_id, show_id) together
  CONSTRAINT uq_booking_show    UNIQUE (booking_id, show_id),
  CONSTRAINT ck_booking_status  CHECK (status IN ('PENDING','CONFIRMED','CANCELLED'))
);

CREATE TABLE booking_seat (
  booking_id  NUMBER(8)   NOT NULL,
  show_id     NUMBER(6)   NOT NULL,
  seat_id     NUMBER(6)   NOT NULL,
  price_paid  NUMBER(7,2) NOT NULL,
  CONSTRAINT pk_booking_seat PRIMARY KEY (booking_id, seat_id),
  -- THE double-booking rule: one seat, one show, one booking
  CONSTRAINT uq_bseat_show_seat UNIQUE (show_id, seat_id),
  -- Guarantees show_id here always matches the booking's show
  CONSTRAINT fk_bseat_booking FOREIGN KEY (booking_id, show_id)
      REFERENCES booking (booking_id, show_id) ON DELETE CASCADE,
  CONSTRAINT fk_bseat_seat    FOREIGN KEY (seat_id) REFERENCES seat (seat_id),
  CONSTRAINT ck_bseat_price   CHECK (price_paid > 0)
);

CREATE TABLE payment (
  payment_id      NUMBER(8),
  booking_id      NUMBER(8)    NOT NULL,
  amount          NUMBER(8,2)  NOT NULL,
  payment_method  VARCHAR2(12) NOT NULL,
  payment_status  VARCHAR2(10) DEFAULT 'PENDING' NOT NULL,
  paid_at         DATE,
  CONSTRAINT pk_payment         PRIMARY KEY (payment_id),
  CONSTRAINT uq_payment_booking UNIQUE (booking_id),          -- 1:1 with BOOKING
  CONSTRAINT fk_pay_booking     FOREIGN KEY (booking_id) REFERENCES booking (booking_id),
  CONSTRAINT ck_pay_amount      CHECK (amount > 0),
  CONSTRAINT ck_pay_method      CHECK (payment_method IN ('UPI','CARD','NETBANKING','WALLET')),
  CONSTRAINT ck_pay_status      CHECK (payment_status IN ('PENDING','SUCCESS','FAILED','REFUNDED')),
  -- A completed or refunded payment must have a timestamp
  CONSTRAINT ck_pay_paid_at     CHECK (payment_status IN ('PENDING','FAILED') OR paid_at IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- 5. Sequences for NEW bookings/payments/movies/shows (sample data uses explicit IDs
--    below 100, so sequences start at 100 to avoid collisions).
-- ---------------------------------------------------------------------
CREATE SEQUENCE booking_seq START WITH 100 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE payment_seq START WITH 100 INCREMENT BY 1 NOCACHE;
-- Used by the admin page of the web app to add new movies and shows
CREATE SEQUENCE movie_seq   START WITH 100 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE show_seq    START WITH 100 INCREMENT BY 1 NOCACHE;

-- Quick check: should list 15 tables
SELECT table_name FROM user_tables ORDER BY table_name;
