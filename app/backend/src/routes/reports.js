// Reports page: a few of the project's SQL queries run live, with the
// SQL text sent along so it can be shown in the viva.
import { Router } from 'express';
import { query } from '../db.js';
import { ah } from '../util.js';

const router = Router();

const REPORTS = [
  {
    id: 'top-rated',
    title: 'Top-rated movies (at least 2 reviews)',
    concept: 'View + WHERE + ORDER BY + FETCH FIRST',
    sql: `SELECT title, avg_rating, review_count
FROM   movie_rating_summary
WHERE  review_count >= 2
ORDER  BY avg_rating DESC
FETCH  FIRST 5 ROWS ONLY`,
  },
  {
    id: 'genres',
    title: 'Movies per genre (including empty genres)',
    concept: 'LEFT JOIN + GROUP BY + COUNT(column)',
    sql: `SELECT g.genre_name, COUNT(mg.movie_id) AS movie_count
FROM   genre g
LEFT   JOIN movie_genre mg ON mg.genre_id = g.genre_id
GROUP  BY g.genre_name
ORDER  BY movie_count DESC, g.genre_name`,
  },
  {
    id: 'reviewers',
    title: 'Most active reviewers (3 or more reviews)',
    concept: 'GROUP BY + HAVING + AVG',
    sql: `SELECT u.username, COUNT(*) AS reviews, ROUND(AVG(r.rating), 2) AS avg_given
FROM   app_user u
JOIN   review r ON r.user_id = u.user_id
GROUP  BY u.user_id, u.username
HAVING COUNT(*) >= 3
ORDER  BY reviews DESC, u.username`,
  },
  {
    id: 'revenue',
    title: 'Confirmed revenue per theatre',
    concept: 'Multi-table LEFT JOIN + SUM + NVL',
    sql: `SELECT t.theatre_name, t.city,
       COUNT(DISTINCT b.booking_id) AS bookings,
       NVL(SUM(bs.price_paid), 0)   AS revenue
FROM   theatre t
LEFT   JOIN screen       sc ON sc.theatre_id = t.theatre_id
LEFT   JOIN movie_show   sh ON sh.screen_id  = sc.screen_id
LEFT   JOIN booking      b  ON b.show_id     = sh.show_id AND b.status = 'CONFIRMED'
LEFT   JOIN booking_seat bs ON bs.booking_id = b.booking_id
GROUP  BY t.theatre_id, t.theatre_name, t.city
ORDER  BY revenue DESC`,
  },
  {
    id: 'scifi-completionists',
    title: 'Users who reviewed EVERY Sci-Fi movie',
    concept: 'Double NOT EXISTS (relational division)',
    sql: `SELECT u.username
FROM   app_user u
WHERE  NOT EXISTS (
         SELECT 1
         FROM   movie_genre mg
         JOIN   genre g ON g.genre_id = mg.genre_id
         WHERE  g.genre_name = 'Sci-Fi'
         AND    NOT EXISTS (SELECT 1
                            FROM   review r
                            WHERE  r.user_id  = u.user_id
                            AND    r.movie_id = mg.movie_id))`,
  },
  {
    id: 'reviewers-not-bookers',
    title: 'Users who review but have never booked',
    concept: 'MINUS',
    sql: `SELECT u.username
FROM   app_user u
WHERE  u.user_id IN (SELECT user_id FROM review
                     MINUS
                     SELECT user_id FROM booking)`,
  },
];

// GET /api/reports  -> every report with its rows
router.get('/', ah(async (req, res) => {
  const results = await Promise.all(REPORTS.map(async (r) => ({ ...r, rows: await query(r.sql) })));
  res.json(results);
}));

export default router;
