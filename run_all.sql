-- Run all project scripts in order (SQL*Plus). Usage:
--   sqlplus MOVIEDB/<password>@localhost:1521/XEPDB1 @run_all.sql
SET DEFINE OFF
SET SQLBLANKLINES ON
SET ECHO ON
SET FEEDBACK ON
SET LINESIZE 220
SET PAGESIZE 200
SET TRIMSPOOL ON
SET SERVEROUTPUT ON
COLUMN title FORMAT A30
COLUMN review_text FORMAT A40
COLUMN genres FORMAT A35
COLUMN cast_list FORMAT A50
COLUMN description FORMAT A40
COLUMN seats FORMAT A45
ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI';

SPOOL output_02_create_tables.log
@02_create_tables.sql
SPOOL OFF
SPOOL output_03_sample_data.log
@03_sample_data.sql
SPOOL OFF
SPOOL output_04_queries.log
@04_queries.sql
SPOOL OFF
SPOOL output_05_views.log
@05_views.sql
SPOOL OFF
SPOOL output_06_booking_integrity.log
@06_booking_integrity.sql
SPOOL OFF
SPOOL output_07_plsql.log
@07_plsql.sql
SPOOL OFF
SPOOL output_08_upcoming_shows.log
@08_upcoming_shows.sql
SPOOL OFF
SPOOL output_09_plsql_demo.log
@09_plsql_demo.sql
SPOOL OFF
EXIT
