// W9 admin: add movies and shows.
import { Router } from 'express';
import { transaction, oracledb } from '../db.js';
import { ApiError } from '../errors.js';
import { ah, id, opt, num } from '../util.js';

const router = Router();

// POST /api/admin/movies
// { title, releaseDate:'YYYY-MM-DD', durationMin, language, certificate, description, genreIds:[..] }
// The movie row and its MOVIE_GENRE rows are inserted in ONE transaction:
// a movie must have at least one genre (total participation, section 2.2
// of the design notes), so we never want a movie saved without genres.
router.post('/movies', ah(async (req, res) => {
  const b = req.body;
  const genreIds = Array.isArray(b.genreIds) ? b.genreIds.map((g) => id(g, 'genre id')) : [];
  if (!opt(b.title?.trim())) throw new ApiError(400, 'Title is required.');
  if (genreIds.length === 0) throw new ApiError(400, 'Pick at least one genre.');

  const movieId = await transaction(async (conn) => {
    const r = await conn.execute(
      `INSERT INTO movie (movie_id, title, release_date, duration_min, movie_language, certificate, description)
       VALUES (movie_seq.NEXTVAL, :title, TO_DATE(:releaseDate, 'YYYY-MM-DD'), :durationMin,
               :language, :certificate, :description)
       RETURNING movie_id INTO :movieId`,
      {
        title: b.title.trim(),
        releaseDate: opt(b.releaseDate),
        durationMin: num(b.durationMin),
        language: opt(b.language?.trim()),
        certificate: opt(b.certificate),
        description: opt(b.description?.trim()),
        movieId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      });
    const newId = r.outBinds.movieId[0];

    // executeMany = one round trip for all genre rows
    await conn.executeMany(
      `INSERT INTO movie_genre (movie_id, genre_id) VALUES (:movieId, :genreId)`,
      genreIds.map((genreId) => ({ movieId: newId, genreId })));
    return newId;
  });
  res.status(201).json({ movie_id: movieId });
}));

// POST /api/admin/shows  { movieId, screenId, showStart:'YYYY-MM-DDTHH:MM', basePrice }
// INSERT ... SELECT ... WHERE start > SYSDATE: a CHECK constraint cannot use
// SYSDATE, so the "must be in the future" rule is part of the statement.
// UQ_SHOW_SCREEN_START still stops two shows starting together on a screen.
router.post('/shows', ah(async (req, res) => {
  const b = req.body;
  const showId = await transaction(async (conn) => {
    const r = await conn.execute(
      `INSERT INTO movie_show (show_id, movie_id, screen_id, show_start, base_price)
       SELECT show_seq.NEXTVAL, :movieId, :screenId, TO_DATE(:showStart, 'YYYY-MM-DD"T"HH24:MI'), :basePrice
       FROM   dual
       WHERE  TO_DATE(:showStart, 'YYYY-MM-DD"T"HH24:MI') > SYSDATE`,
      {
        movieId: id(b.movieId, 'movieId'),
        screenId: id(b.screenId, 'screenId'),
        showStart: opt(b.showStart),
        basePrice: num(b.basePrice),
      });
    if (r.rowsAffected === 0) throw new ApiError(400, 'Show time must be in the future.');
    const [[newId]] = (await conn.execute(`SELECT show_seq.CURRVAL FROM dual`, [], {
      outFormat: oracledb.OUT_FORMAT_ARRAY })).rows;
    return newId;
  });
  res.status(201).json({ show_id: showId });
}));

export default router;
