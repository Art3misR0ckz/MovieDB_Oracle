// Lookup data for drop-downs: users (for the "acting as" picker), genres,
// languages, cities, screens and upcoming show dates.
import { Router } from 'express';
import { query } from '../db.js';
import { ah } from '../util.js';

const router = Router();

// There is no login in this project (out of scope). The frontend lets you
// pick which sample user you are "acting as".
router.get('/users', ah(async (req, res) => {
  res.json(await query(
    `SELECT user_id, username, full_name, city
     FROM   app_user
     ORDER  BY user_id`));
}));

router.get('/meta', ah(async (req, res) => {
  const [genres, languages, cities, screens, showDates, movies] = await Promise.all([
    query(`SELECT genre_id, genre_name FROM genre ORDER BY genre_name`),
    query(`SELECT DISTINCT movie_language FROM movie ORDER BY movie_language`),
    query(`SELECT DISTINCT city FROM theatre ORDER BY city`),
    query(`SELECT sc.screen_id, t.theatre_name, t.city, sc.screen_no, sc.screen_type
           FROM   screen sc JOIN theatre t ON t.theatre_id = sc.theatre_id
           ORDER  BY t.theatre_name, sc.screen_no`),
    query(`SELECT DISTINCT TO_CHAR(show_start, 'YYYY-MM-DD') AS show_date
           FROM   movie_show
           WHERE  show_start > SYSDATE
           ORDER  BY show_date`),
    query(`SELECT movie_id, title FROM movie ORDER BY title`),
  ]);
  res.json({
    genres,
    languages: languages.map((r) => r.movie_language),
    cities: cities.map((r) => r.city),
    screens,
    showDates: showDates.map((r) => r.show_date),
    movies,
  });
}));

export default router;
