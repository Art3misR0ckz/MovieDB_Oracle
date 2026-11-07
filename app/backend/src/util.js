// Small helpers shared by the route files.
import { ApiError } from './errors.js';

// Express 4 does not catch errors thrown by async handlers by itself.
// Wrapping a handler with ah(...) sends any error to the error middleware.
export const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Read a required positive whole number (an ID) from a request value.
export function id(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, `${name} must be a positive whole number.`);
  return n;
}

// Optional text filter: '' or undefined -> null, so "(:x IS NULL OR ...)" works in SQL.
export const opt = (value) => (value === undefined || value === '' ? null : String(value));

// Date columns are formatted in SQL with this mask, so the API always
// returns plain "2026-11-08T18:30" strings and no time-zone conversion happens.
export const DT = `'YYYY-MM-DD"T"HH24:MI'`;

// Optional number: '' / undefined / not-a-number -> null (Oracle then
// reports the NOT NULL or CHECK constraint, which errors.js translates).
export const num = (value) => {
  const n = Number(value);
  return value === '' || value === undefined || value === null || !Number.isFinite(n) ? null : n;
};
