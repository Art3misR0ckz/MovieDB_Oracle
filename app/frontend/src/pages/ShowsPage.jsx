// W5: find shows by city and date (THEATRE_SHOW_SCHEDULE view + seats_left function)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Empty, Loading, useLoad } from '../components/ui.jsx';
import { fmtDate, fmtTime, rupees } from '../format.js';

export default function ShowsPage() {
  const [city, setCity] = useState('');
  const [date, setDate] = useState('');
  const [movieId, setMovieId] = useState('');
  const meta = useLoad(() => api.meta(), []);
  const shows = useLoad(() => api.shows({ city, date, movieId }), [city, date, movieId]);

  // group by theatre: { "Cineplex Central": { city, movies: { title: [shows] } } }
  const theatres = {};
  for (const s of shows.data || []) {
    const t = (theatres[s.theatre_name] ||= { city: s.city, movies: {} });
    (t.movies[s.title] ||= { movie: s, shows: [] }).shows.push(s);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Shows</h1>
        <p className="mt-1 text-sm text-gray-400">Upcoming screenings. Pick a time to open the seat map.</p>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="city">City</label>
          <select id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {meta.data?.cities.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <select id="date" className="input" value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">Any day</option>
            {meta.data?.showDates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="movie">Movie</label>
          <select id="movie" className="input" value={movieId} onChange={(e) => setMovieId(e.target.value)}>
            <option value="">Any movie</option>
            {meta.data?.movies.map((m) => <option key={m.movie_id} value={m.movie_id}>{m.title}</option>)}
          </select>
        </div>
      </div>

      <Alert>{shows.error}</Alert>
      {shows.loading && !shows.data ? <Loading /> : Object.keys(theatres).length === 0 ? (
        <Empty>
          No upcoming shows for this filter. If the list is empty everywhere, run
          <code className="mx-1 text-reel">08_upcoming_shows.sql</code>, which adds shows for the next 4 days.
        </Empty>
      ) : (
        Object.entries(theatres).map(([name, t]) => (
          <section key={name} className="card p-5">
            <h2 className="h2">{name} <span className="text-sm font-normal text-gray-500">· {t.city}</span></h2>
            <div className="mt-4 divide-y divide-ink-line">
              {Object.entries(t.movies).map(([title, { movie, shows: list }]) => (
                <div key={title} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="sm:w-56">
                    <Link to={`/movies/${movie.movie_id}`} className="font-semibold text-white hover:text-reel">{title}</Link>
                    <div className="text-xs text-gray-500">{movie.movie_language} · {movie.certificate}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((s) => (
                      <Link key={s.show_id} to={`/shows/${s.show_id}`}
                            className={`rounded-lg border px-3 py-1.5 text-center text-sm hover:border-reel ${s.seats_left === 0 ? 'border-red-500/40 opacity-60' : 'border-ink-line'}`}>
                        <div className="font-semibold text-reel">{fmtTime(s.show_start)}</div>
                        <div className="text-[11px] text-gray-400">
                          {date ? '' : fmtDate(s.show_start) + ' · '}Scr {s.screen_no} {s.screen_type}
                        </div>
                        <div className="text-[11px] text-gray-500">{rupees(s.base_price)} · {s.seats_left} left</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
