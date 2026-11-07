// Every call to the Express API goes through this one function.
// If the API answers with an error, it sends { error: "message" } (the
// message comes from errors.js, which translates the Oracle error), and we
// throw it so the page can show it.
async function request(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Builds "?a=1&b=2", leaving out empty values
function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
}

export const api = {
  users: () => request('GET', '/users'),
  meta: () => request('GET', '/meta'),

  movies: (filters) => request('GET', '/movies' + qs(filters)),
  movie: (id, userId) => request('GET', `/movies/${id}` + qs({ userId })),
  saveReview: (movieId, userId, rating, text) => request('PUT', `/movies/${movieId}/review`, { userId, rating, text }),
  deleteReview: (movieId, userId) => request('DELETE', `/movies/${movieId}/review` + qs({ userId })),

  watchlist: (userId) => request('GET', '/watchlist' + qs({ userId })),
  addToWatchlist: (userId, movieId) => request('POST', '/watchlist', { userId, movieId }),
  removeFromWatchlist: (userId, movieId) => request('DELETE', `/watchlist/${movieId}` + qs({ userId })),

  shows: (filters) => request('GET', '/shows' + qs(filters)),
  show: (id) => request('GET', `/shows/${id}`),

  bookings: (userId) => request('GET', '/bookings' + qs({ userId })),
  booking: (id, userId) => request('GET', `/bookings/${id}` + qs({ userId })),
  book: (userId, showId, seatIds) => request('POST', '/bookings', { userId, showId, seatIds }),
  pay: (id, userId, method) => request('POST', `/bookings/${id}/pay`, { userId, method }),
  cancel: (id, userId) => request('POST', `/bookings/${id}/cancel`, { userId }),

  addMovie: (movie) => request('POST', '/admin/movies', movie),
  addShow: (show) => request('POST', '/admin/shows', show),

  reports: () => request('GET', '/reports'),
};
