// Oracle connection pool + two small helpers used by every route.
//
// Every query uses BIND VARIABLES (:name). Values are never pasted into
// the SQL text, so SQL injection is not possible.
import oracledb from 'oracledb';
import 'dotenv/config';

// Return rows as { column_name: value } objects instead of arrays
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

export async function initPool() {
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 1,
    poolMax: 5,
  });
  console.log('Connected to Oracle at', process.env.DB_CONNECT_STRING);
}

export async function closePool() {
  if (pool) await pool.close(5);
}

// Oracle returns column names in UPPER CASE; the frontend prefers lower case.
function lowerKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v;
  return out;
}

// Run one SELECT and return the rows.
export async function query(sql, binds = {}) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds);
    return result.rows.map(lowerKeys);
  } finally {
    await conn.close();
  }
}

// Run several statements as ONE transaction.
//   await transaction(async (conn) => { await conn.execute(...); ... });
// If the callback finishes, we COMMIT. If anything throws, we ROLLBACK,
// so the database never keeps half of the work.
export async function transaction(work) {
  const conn = await pool.getConnection();
  try {
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export { oracledb };
