// W1 browse/search movies, W2 movie page, W3 rate/review a movie.
import { Router } from 'express';
import { query, transaction } from '../db.js';
import { ApiError } from '../errors.js';
import { ah, id, opt, num, DT } from '../util.js';

const router = Router();

// Only these ORDER BY clauses are allowed (the user picks a key, never SQL text).
const SORTS = {
  rating: 's.avg_rating DESC NULLS LAST, d.title',
  newest: 'd.release_date DESC',
  title: 'd.title',
};

// GET /api/movies?q=&genre=&lang=&sort=
// Reads the MOVIE_DETAILS and MOVIE_RATING_SUMMARY views from 05_views.sql.
router.get('/', ah(async (req, res) => {
  const orderBy = SORTS[req.query.sort] || SORTS.rating;
  const rows = await query(
    `SELECT d.movie_id, d.title,
            EXTRACT(YEAR FROM d.release_date) AS release_year,
            d.duration_min, d.movie_language, d.certificate, d.genres,
            s.avg_rating, s.review_count,
            CASE WHEN EXISTS (SELECT 1 FROM movie_show sh
                              WHERE sh.movie_id = d.movie_id AND sh.show_start > SYSDATE)
                 THEN 1 ELSE 0 END AS now_showing
     FROM   movie_details d
     JOIN   movie_rating_summary s ON s.movie_id = d.movie_id
     WHERE  (:q IS NULL OR UPPER(d.title) LIKE '%' || UPPER(:q) || '%')
     AND    (:lang IS NULL OR d.movie_language = :lang)
     AND    (:genre IS NULL OR EXISTS (SELECT 1
                                      FROM   movie_genre mg
                                      JOIN   genre g ON g.genre_id = mg.genre_id
                                      WHERE  mg.movie_id = d.movie_id
                                      AND    g.genre_name = :genre))
     ORDER  BY ${orderBy}`,
    { q: opt(req.query.q), lang: opt(req.query.lang), genre: opt(req.query.genre) });
  res.json(rows);
}));

// GET /api/movies/:id?userId=   -> details, cast, reviews, upcoming shows
router.get('/:id', ah(async (req, res) => {
  const movieId = id(req.params.id, 'movie id');
  const userId = req.query.userId ? id(req.query.userId, 'userId') : null;

  const [movie] = await query(
    `SELECT d.movie_id, d.title, TO_CHAR(d.release_date, 'YYYY-MM-DD') AS release_date,
            d.duration_min, d.movie_language, d.certificate, d.genres, m.description,
            s.avg_rating, s.review_count
     FROM   movie_details d
     JOIN   movie m                ON m.movie_id = d.movie_id
     JOIN   movie_rating_summary s ON s.movie_id = d.movie_id
     WHERE  d.movie_id = :movieId`, { movieId });
  if (!movie) throw new ApiError(404, 'Movie not found.');

  const [cast, reviews, shows, inWatchlist] = await Promise.all([
    query(`SELECT a.actor_name, ma.character_name
           FROM   movie_actor ma JOIN actor a ON a.actor_id = ma.actor_id
           WHERE  ma.movie_id = :movieId
           ORDER  BY a.actor_name`, { movieId }),
    query(`SELECT r.user_id, u.username, r.rating, r.review_text,
                  TO_CHAR(r.review_date, 'YYYY-MM-DD') AS review_date
           FROM   review r JOIN app_user u ON u.user_id = r.user_id
           WHERE  r.movie_id = :movieId
           ORDER  BY r.review_date DESC`, { movieId }),
    query(`SELECT show_id, theatre_name, city, screen_no, screen_type,
                  TO_CHAR(show_start, ${DT}) AS show_start, base_price,
                  seats_left(show_id) AS seats_left
           FROM   theatre_show_schedule
           WHERE  movie_id = :movieId AND show_start > SYSDATE
           ORDER  BY show_start, theatre_name`, { movieId }),
    userId
      ? query(`SELECT 1 AS yes FROM watchlist WHERE user_id = :userId AND movie_id = :movieId`,
              { userId, movieId })
      : Promise.resolve([]),
  ]);

  res.json({ ...movie, cast, reviews, shows, in_watchlist: inWatchlist.length > 0 });
}));

// PUT /api/movies/:id/review  { userId, rating, text }
// Calls the save_review procedure (MERGE: insert or update). The rating is
// validated by the CHECK constraint, not here. A new review also fires
// trg_review_clears_watchlist.
router.put('/:id/review', ah(async (req, res) => {
  const movieId = id(req.params.id, 'movie id');
  const userId = id(req.body.userId, 'userId');
  const rating = num(req.body.rating);
  const text = opt(req.body.text?.trim());

  await transaction((conn) => conn.execute(
    `BEGIN save_review(:userId, :movieId, :rating, :text); END;`,
    { userId, movieId, rating, text }));
  res.json({ ok: true });
}));

// DELETE /api/movies/:id/review?userId=
router.delete('/:id/review', ah(async (req, res) => {
  const movieId = id(req.params.id, 'movie id');
  const userId = id(req.query.userId, 'userId');
  const result = await transaction((conn) => conn.execute(
    `DELETE FROM review WHERE user_id = :userId AND movie_id = :movieId`, { userId, movieId }));
  if (result.rowsAffected === 0) throw new ApiError(404, 'You have not reviewed this movie.');
  res.json({ ok: true });
}));

export default router;
