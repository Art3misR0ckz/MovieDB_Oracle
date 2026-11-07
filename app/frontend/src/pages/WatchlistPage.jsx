// W4: watchlist. "In theatres" uses the same idea as Q37 (watchlist ∩ shows).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../UserContext.jsx';
import { Alert, Empty, Loading, Stars, useLoad } from '../components/ui.jsx';
import Poster from '../components/Poster.jsx';

export default function WatchlistPage() {
  const { userId, user } = useUser();
  const { data, error, loading, reload } = useLoad(() => (userId ? api.watchlist(userId) : Promise.resolve([])), [userId]);
  const [msg, setMsg] = useState(null);

  async function remove(movieId) {
    try {
      await api.removeFromWatchlist(userId, movieId);
      reload();
    } catch (err) {
      setMsg(err.message);
    }
  }

  const showing = (data || []).filter((m) => m.now_showing === 1).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Watchlist</h1>
        {user && <p className="mt-1 text-sm text-gray-400">Movies @{user.username} wants to see</p>}
      </div>
      {showing > 0 && (
        <Alert kind="info">
          {showing} movie{showing > 1 ? 's' : ''} on your watchlist {showing > 1 ? 'are' : 'is'} in theatres right now.
        </Alert>
      )}
      <Alert>{error || msg}</Alert>
      {loading && !data ? <Loading /> : data?.length === 0 ? (
        <Empty>Your watchlist is empty. Add movies from their page.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((m) => (
            <div key={m.movie_id} className="card flex gap-4 p-3">
              <Poster title={m.title} className="h-28 w-20 shrink-0 [&>span]:text-xs" />
              <div className="flex flex-1 flex-col">
                <Link to={`/movies/${m.movie_id}`} className="font-semibold text-white hover:text-reel">{m.title}</Link>
                <span className="text-xs text-gray-400">{m.release_year} · {m.movie_language}</span>
                <span className="truncate text-xs text-gray-500">{m.genres}</span>
                <Stars value={m.avg_rating} className="mt-1 text-sm" />
                <div className="mt-auto flex gap-2 pt-2">
                  {m.now_showing === 1 && (
                    <Link to={`/movies/${m.movie_id}`} className="btn-primary px-3 py-1 text-xs">
                      See shows
                    </Link>
                  )}
                  <button className="btn-ghost px-3 py-1 text-xs" onClick={() => remove(m.movie_id)}>Remove</button>
                </div>
              </div>
              <span className="self-start text-[10px] text-gray-500">added {m.added_on}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
