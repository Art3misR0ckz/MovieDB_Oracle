// W4 watchlist.
import { Router } from 'express';
import { query, transaction } from '../db.js';
import { ApiError } from '../errors.js';
import { ah, id } from '../util.js';

const router = Router();

// GET /api/watchlist?userId=
// now_showing = 1 when the movie has an upcoming show (the idea of Q37).
router.get('/', ah(async (req, res) => {
  const userId = id(req.query.userId, 'userId');
  res.json(await query(
    `SELECT w.movie_id, d.title, d.genres, d.movie_language,
            EXTRACT(YEAR FROM d.release_date) AS release_year,
            TO_CHAR(w.added_on, 'YYYY-MM-DD') AS added_on,
            s.avg_rating,
            CASE WHEN EXISTS (SELECT 1 FROM movie_show sh
                              WHERE sh.movie_id = w.movie_id AND sh.show_start > SYSDATE)
                 THEN 1 ELSE 0 END AS now_showing
     FROM   watchlist w
     JOIN   movie_details d        ON d.movie_id = w.movie_id
     JOIN   movie_rating_summary s ON s.movie_id = w.movie_id
     WHERE  w.user_id = :userId
     ORDER  BY now_showing DESC, w.added_on DESC`, { userId }));
}));

// POST /api/watchlist  { userId, movieId }   (PK stops duplicates)
router.post('/', ah(async (req, res) => {
  const userId = id(req.body.userId, 'userId');
  const movieId = id(req.body.movieId, 'movieId');
  await transaction((conn) => conn.execute(
    `INSERT INTO watchlist (user_id, movie_id, added_on) VALUES (:userId, :movieId, SYSDATE)`,
    { userId, movieId }));
  res.status(201).json({ ok: true });
}));

// DELETE /api/watchlist/:movieId?userId=
router.delete('/:movieId', ah(async (req, res) => {
  const userId = id(req.query.userId, 'userId');
  const movieId = id(req.params.movieId, 'movieId');
  const result = await transaction((conn) => conn.execute(
    `DELETE FROM watchlist WHERE user_id = :userId AND movie_id = :movieId`, { userId, movieId }));
  if (result.rowsAffected === 0) throw new ApiError(404, 'Movie is not on your watchlist.');
  res.json({ ok: true });
}));

export default router;
