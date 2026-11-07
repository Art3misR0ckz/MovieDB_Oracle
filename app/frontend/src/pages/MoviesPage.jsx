// W1: browse and search movies (MOVIE_DETAILS + MOVIE_RATING_SUMMARY views)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Empty, Loading, Stars, useLoad } from '../components/ui.jsx';
import Poster from '../components/Poster.jsx';

export default function MoviesPage() {
  const [filters, setFilters] = useState({ q: '', genre: '', lang: '', sort: 'rating' });
  const meta = useLoad(() => api.meta(), []);
  const movies = useLoad(() => api.movies(filters), [filters.q, filters.genre, filters.lang, filters.sort]);

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Movies</h1>
        <p className="mt-1 text-sm text-gray-400">Rate what you've seen, watchlist the rest, and book the ones in theatres.</p>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="q">Search title</label>
          <input id="q" className="input" placeholder="e.g. Inception" value={filters.q} onChange={set('q')} />
        </div>
        <div>
          <label className="label" htmlFor="genre">Genre</label>
          <select id="genre" className="input" value={filters.genre} onChange={set('genre')}>
            <option value="">All genres</option>
            {meta.data?.genres.map((g) => <option key={g.genre_id}>{g.genre_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="lang">Language</label>
            <select id="lang" className="input" value={filters.lang} onChange={set('lang')}>
              <option value="">All</option>
              {meta.data?.languages.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sort">Sort</label>
            <select id="sort" className="input" value={filters.sort} onChange={set('sort')}>
              <option value="rating">Rating</option>
              <option value="newest">Newest</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      </div>

      <Alert>{movies.error}</Alert>
      {movies.loading && !movies.data ? <Loading /> : movies.data?.length === 0 ? (
        <Empty>No movies match these filters.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {movies.data?.map((m) => (
            <Link key={m.movie_id} to={`/movies/${m.movie_id}`} className="card group overflow-hidden p-2 transition hover:border-reel/60">
              <div className="relative">
                <Poster title={m.title} className="h-40" />
                {m.now_showing === 1 && (
                  <span className="absolute right-2 top-2 rounded bg-reel px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">In theatres</span>
                )}
              </div>
              <div className="space-y-1 p-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold text-white group-hover:text-reel">{m.title}</span>
                  <span className="text-xs text-gray-500">{m.release_year}</span>
                </div>
                <div className="truncate text-xs text-gray-400">{m.genres} · {m.movie_language}</div>
                <div className="flex items-center justify-between">
                  <Stars value={m.avg_rating} className="text-sm" />
                  <span className="text-xs text-gray-500">{m.review_count} review{m.review_count === 1 ? '' : 's'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
