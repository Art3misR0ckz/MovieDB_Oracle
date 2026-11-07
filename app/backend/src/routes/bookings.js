// W6 book seats, W7 pay (simulated), W8 my bookings / cancel.
// All three write operations call the PL/SQL procedures from 07_plsql.sql
// and then COMMIT (or ROLLBACK on error) through transaction().
import { Router } from 'express';
import { query, transaction, oracledb } from '../db.js';
import { ApiError } from '../errors.js';
import { ah, id, DT } from '../util.js';

const router = Router();

const BOOKING_COLUMNS = `
  bs.booking_id, b.show_id, bs.title, bs.theatre_name,
  TO_CHAR(bs.show_start, ${DT}) AS show_start,
  CASE WHEN bs.show_start > SYSDATE THEN 1 ELSE 0 END AS upcoming,
  TO_CHAR(b.booking_time, ${DT}) AS booking_time,
  bs.booking_status, bs.seat_count, bs.total_amount, bs.payment_status, bs.amount_charged,
  (SELECT LISTAGG(st.seat_row || st.seat_number, ', ')
            WITHIN GROUP (ORDER BY st.seat_row, st.seat_number)
   FROM   booking_seat x JOIN seat st ON st.seat_id = x.seat_id
   WHERE  x.booking_id = bs.booking_id) AS seats`;

// There is no login, so we at least check that the booking belongs to the
// user the frontend says it is acting as.
async function checkOwner(bookingId, userId) {
  const rows = await query(`SELECT user_id FROM booking WHERE booking_id = :bookingId`, { bookingId });
  if (rows.length === 0) throw new ApiError(404, 'Booking not found.');
  if (rows[0].user_id !== userId) throw new ApiError(403, 'This booking belongs to another user.');
}

// GET /api/bookings?userId=   (BOOKING_SUMMARY view)
router.get('/', ah(async (req, res) => {
  const userId = id(req.query.userId, 'userId');
  res.json(await query(
    `SELECT ${BOOKING_COLUMNS}
     FROM   booking_summary bs
     JOIN   booking b ON b.booking_id = bs.booking_id
     WHERE  b.user_id = :userId
     ORDER  BY bs.show_start DESC, bs.booking_id DESC`, { userId }));
}));

// GET /api/bookings/:id?userId=
router.get('/:id', ah(async (req, res) => {
  const bookingId = id(req.params.id, 'booking id');
  const userId = id(req.query.userId, 'userId');
  await checkOwner(bookingId, userId);
  const [row] = await query(
    `SELECT ${BOOKING_COLUMNS}
     FROM   booking_summary bs
     JOIN   booking b ON b.booking_id = bs.booking_id
     WHERE  bs.booking_id = :bookingId`, { bookingId });
  res.json(row);
}));

// POST /api/bookings  { userId, showId, seatIds: [105, 106] }
// book_seats either books every seat or none of them. If someone else got
// a seat first, Oracle raises ORA-20024 and nothing is saved.
router.post('/', ah(async (req, res) => {
  const userId = id(req.body.userId, 'userId');
  const showId = id(req.body.showId, 'showId');
  const seatIds = Array.isArray(req.body.seatIds) ? req.body.seatIds.map((s) => id(s, 'seat id')) : [];
  if (seatIds.length === 0) throw new ApiError(400, 'Select at least one seat.');

  const bookingId = await transaction(async (conn) => {
    const result = await conn.execute(
      `BEGIN book_seats(:userId, :showId, :seatIds, :bookingId); END;`,
      {
        userId,
        showId,
        seatIds: seatIds.join(','),
        bookingId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      });
    return result.outBinds.bookingId;
  });
  res.status(201).json({ booking_id: bookingId });
}));

// POST /api/bookings/:id/pay  { userId, method }
router.post('/:id/pay', ah(async (req, res) => {
  const bookingId = id(req.params.id, 'booking id');
  const userId = id(req.body.userId, 'userId');
  await checkOwner(bookingId, userId);
  await transaction((conn) => conn.execute(
    `BEGIN make_payment(:bookingId, :method); END;`,
    { bookingId, method: String(req.body.method || '') }));
  res.json({ ok: true });
}));

// POST /api/bookings/:id/cancel  { userId }
router.post('/:id/cancel', ah(async (req, res) => {
  const bookingId = id(req.params.id, 'booking id');
  const userId = id(req.body.userId, 'userId');
  await checkOwner(bookingId, userId);
  await transaction((conn) => conn.execute(`BEGIN cancel_booking(:bookingId); END;`, { bookingId }));
  res.json({ ok: true });
}));

export default router;
