// Entry point: npm start  ->  http://localhost:4000
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initPool, closePool } from './db.js';
import { toHttpError } from './errors.js';
import metaRoutes from './routes/meta.js';
import movieRoutes from './routes/movies.js';
import watchlistRoutes from './routes/watchlist.js';
import showRoutes from './routes/shows.js';
import bookingRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';
import reportRoutes from './routes/reports.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', metaRoutes);               // /api/users, /api/meta
app.use('/api/movies', movieRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'No such API route.' }));

// If the frontend has been built (npm run build in app/frontend), serve it
// from here too, so the whole app runs on one port for the demo.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Every error ends up here and is sent as { error: "message" }
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const { status, message } = toHttpError(err);
  res.status(status).json({ error: message });
});

const PORT = Number(process.env.PORT) || 4000;

try {
  await initPool();
} catch (err) {
  console.error('Could not connect to Oracle:', err.message);
  console.error('Check DB_USER, DB_PASSWORD and DB_CONNECT_STRING in app/backend/.env');
  process.exit(1);
}

const server = app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

process.on('SIGINT', async () => {
  server.close();
  await closePool();
  process.exit(0);
});
