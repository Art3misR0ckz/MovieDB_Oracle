// W2 movie page, W3 rate / review, W4 add to watchlist.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../UserContext.jsx';
import { Alert, Loading, Stars, useLoad } from '../components/ui.jsx';
import Poster from '../components/Poster.jsx';
import { fmtDate, fmtTime, hours, rupees } from '../format.js';

const RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

function ReviewForm({ movie, userId, onSaved }) {
  const mine = movie.reviews.find((r) => r.user_id === userId);
  const [rating, setRating] = useState(mine?.rating ?? 4);
  const [text, setText] = useState(mine?.review_text ?? '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // when the "acting as" user changes, show that user's review instead
  useEffect(() => {
    setRating(mine?.rating ?? 4);
    setText(mine?.review_text ?? '');
    setMsg(null);
  }, [userId, mine?.rating, mine?.review_text]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveReview(movie.movie_id, userId, rating, text);
      // a NEW review fires trg_review_clears_watchlist
      setMsg({ kind: 'success', text: mine ? 'Review updated.' : movie.in_watchlist
        ? 'Review saved. The movie was removed from your watchlist (trigger).' : 'Review saved.' });
      onSaved();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteReview(movie.movie_id, userId);
      setMsg({ kind: 'success', text: 'Review deleted.' });
      onSaved();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-4">
      <h2 className="h2">{mine ? 'Your review' : 'Rate this movie'}</h2>
      <div>
        <span className="label">Rating</span>
        <div className="flex flex-wrap gap-1">
          {RATINGS.slice().reverse().map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRating(r)}
              className={`rounded-md border px-2 py-1 text-xs ${rating === r ? 'border-reel bg-reel text-ink' : 'border-ink-line text-gray-300 hover:border-gray-500'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="text">Review (optional)</label>
        <textarea id="text" rows={3} maxLength={1000} className="input" value={text}
                  onChange={(e) => setText(e.target.value)} placeholder="Leave empty for a rating-only log" />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{mine ? 'Update review' : 'Save review'}</button>
        {mine && <button type="button" className="btn-danger" onClick={remove} disabled={busy}>Delete</button>}
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </form>
  );
}

export default function MoviePage() {
  const { id } = useParams();
  const { userId } = useUser();
  const { data: movie, error, loading, reload } = useLoad(() => api.movie(id, userId), [id, userId]);
  const [wlMsg, setWlMsg] = useState(null);

  async function toggleWatchlist() {
    setWlMsg(null);
    try {
      if (movie.in_watchlist) await api.removeFromWatchlist(userId, movie.movie_id);
      else await api.addToWatchlist(userId, movie.movie_id);
      reload();
    } catch (err) {
      setWlMsg(err.message);
    }
  }

  if (loading && !movie) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  if (!movie) return null;

  // group upcoming shows by date for display
  const byDate = {};
  for (const s of movie.shows) (byDate[s.show_start.slice(0, 10)] ||= []).push(s);

  return (
    <div className="space-y-8">
      <Link to="/" className="text-sm text-gray-400 hover:text-white">← All movies</Link>

      <section className="grid gap-6 md:grid-cols-[220px_1fr]">
        <Poster title={movie.title} className="h-72 md:h-80" />
        <div className="space-y-4">
          <div>
            <h1 className="h1">{movie.title}</h1>
            <p className="mt-1 text-sm text-gray-400">
              {movie.release_date.slice(0, 4)} · {hours(movie.duration_min)} · {movie.movie_language} ·{' '}
              <span className="chip">{movie.certificate}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {movie.genres?.split(', ').map((g) => <span key={g} className="chip">{g}</span>)}
          </div>
          <div className="flex items-center gap-3">
            <Stars value={movie.avg_rating} className="text-xl" />
            <span className="text-sm text-gray-400">from {movie.review_count} review{movie.review_count === 1 ? '' : 's'}</span>
          </div>
          {movie.description && <p className="max-w-2xl text-gray-300">{movie.description}</p>}
          {movie.cast.length > 0 && (
            <div>
              <span className="label">Cast</span>
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {movie.cast.map((c) => (
                  <li key={c.actor_name}>
                    <span className="text-white">{c.actor_name}</span>
                    {c.character_name && <span className="text-gray-500"> as {c.character_name}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button className={movie.in_watchlist ? 'btn-ghost' : 'btn-primary'} onClick={toggleWatchlist} disabled={!userId}>
              {movie.in_watchlist ? '✓ On your watchlist' : '+ Add to watchlist'}
            </button>
          </div>
          <Alert>{wlMsg}</Alert>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="h2">Upcoming shows</h2>
        {movie.shows.length === 0 ? (
          <p className="text-sm text-gray-500">Not showing in any theatre right now.</p>
        ) : (
          Object.entries(byDate).map(([date, shows]) => (
            <div key={date} className="card p-4">
              <div className="mb-2 text-sm font-semibold text-gray-300">{fmtDate(date)}</div>
              <div className="flex flex-wrap gap-2">
                {shows.map((s) => (
                  <Link key={s.show_id} to={`/shows/${s.show_id}`}
                        className="rounded-lg border border-ink-line px-3 py-2 text-sm hover:border-reel">
                    <div className="font-semibold text-reel">{fmtTime(s.show_start)}</div>
                    <div className="text-xs text-gray-400">{s.theatre_name} · Screen {s.screen_no} {s.screen_type}</div>
                    <div className="text-xs text-gray-500">from {rupees(s.base_price)} · {s.seats_left} left</div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <h2 className="h2">Reviews</h2>
          {movie.reviews.length === 0 && <p className="text-sm text-gray-500">No reviews yet. Be the first.</p>}
          {movie.reviews.map((r) => (
            <div key={r.user_id} className={`card p-4 ${r.user_id === userId ? 'border-reel/50' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">@{r.username}</span>
                <Stars value={r.rating} className="text-sm" />
              </div>
              {r.review_text
                ? <p className="mt-2 text-sm text-gray-300">{r.review_text}</p>
                : <p className="mt-2 text-xs italic text-gray-500">rating only</p>}
              <p className="mt-2 text-xs text-gray-500">{r.review_date}</p>
            </div>
          ))}
        </div>
        {userId && <ReviewForm movie={movie} userId={userId} onSaved={reload} />}
      </section>
    </div>
  );
}
