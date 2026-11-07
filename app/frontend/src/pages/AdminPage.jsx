// W9: admin — add a movie (with genres, one transaction) and schedule a show.
import { useState } from 'react';
import { api } from '../api.js';
import { Alert, useLoad } from '../components/ui.jsx';

const EMPTY_MOVIE = { title: '', releaseDate: '', durationMin: '', language: '', certificate: 'UA', description: '', genreIds: [] };
const EMPTY_SHOW = { movieId: '', screenId: '', showStart: '', basePrice: '' };

function useSubmit(onDone) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e, action, success) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const result = await action();
      setMsg({ kind: 'success', text: success(result) });
      onDone?.();
    } catch (err) {
      // the message comes from the Oracle constraint that failed (errors.js)
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }
  return { msg, busy, submit };
}

export default function AdminPage() {
  const meta = useLoad(() => api.meta(), []);
  const [movie, setMovie] = useState(EMPTY_MOVIE);
  const [show, setShow] = useState(EMPTY_SHOW);
  const movieForm = useSubmit(() => { setMovie(EMPTY_MOVIE); meta.reload(); });
  const showForm = useSubmit(() => { setShow(EMPTY_SHOW); meta.reload(); });

  const m = (key) => (e) => setMovie({ ...movie, [key]: e.target.value });
  const s = (key) => (e) => setShow({ ...show, [key]: e.target.value });
  const toggleGenre = (gid) => setMovie({
    ...movie,
    genreIds: movie.genreIds.includes(gid) ? movie.genreIds.filter((x) => x !== gid) : [...movie.genreIds, gid],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Admin</h1>
        <p className="mt-1 text-sm text-gray-400">
          Add movies and schedule shows. Validation is done by Oracle's constraints; the error you see is the one the database raised.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="card space-y-3 p-5"
              onSubmit={(e) => movieForm.submit(e, () => api.addMovie(movie), (r) => `Movie added with id ${r.movie_id}.`)}>
          <h2 className="h2">Add a movie</h2>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="input" value={movie.title} onChange={m('title')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="rd">Release date</label>
              <input id="rd" type="date" className="input" value={movie.releaseDate} onChange={m('releaseDate')} required />
            </div>
            <div>
              <label className="label" htmlFor="dur">Duration (min)</label>
              <input id="dur" type="number" className="input" value={movie.durationMin} onChange={m('durationMin')} required />
            </div>
            <div>
              <label className="label" htmlFor="lang">Language</label>
              <input id="lang" className="input" list="langs" value={movie.language} onChange={m('language')} required />
              <datalist id="langs">{meta.data?.languages.map((l) => <option key={l} value={l} />)}</datalist>
            </div>
            <div>
              <label className="label" htmlFor="cert">Certificate</label>
              <select id="cert" className="input" value={movie.certificate} onChange={m('certificate')}>
                {['U', 'UA', 'A', 'S'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <span className="label">Genres (at least one)</span>
            <div className="flex flex-wrap gap-2">
              {meta.data?.genres.map((g) => (
                <button type="button" key={g.genre_id} onClick={() => toggleGenre(g.genre_id)}
                        className={`rounded-full border px-3 py-1 text-xs ${movie.genreIds.includes(g.genre_id) ? 'border-reel bg-reel text-ink' : 'border-ink-line text-gray-300'}`}>
                  {g.genre_name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="desc">Description</label>
            <textarea id="desc" rows={2} maxLength={500} className="input" value={movie.description} onChange={m('description')} />
          </div>
          <button className="btn-primary" disabled={movieForm.busy}>Add movie</button>
          {movieForm.msg && <Alert kind={movieForm.msg.kind}>{movieForm.msg.text}</Alert>}
        </form>

        <form className="card space-y-3 p-5"
              onSubmit={(e) => showForm.submit(e, () => api.addShow(show), (r) => `Show scheduled with id ${r.show_id}.`)}>
          <h2 className="h2">Schedule a show</h2>
          <div>
            <label className="label" htmlFor="smovie">Movie</label>
            <select id="smovie" className="input" value={show.movieId} onChange={s('movieId')} required>
              <option value="">Choose…</option>
              {meta.data?.movies.map((mv) => <option key={mv.movie_id} value={mv.movie_id}>{mv.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sscreen">Screen</label>
            <select id="sscreen" className="input" value={show.screenId} onChange={s('screenId')} required>
              <option value="">Choose…</option>
              {meta.data?.screens.map((sc) => (
                <option key={sc.screen_id} value={sc.screen_id}>
                  {sc.theatre_name} ({sc.city}) · Screen {sc.screen_no} {sc.screen_type}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="start">Starts at</label>
              <input id="start" type="datetime-local" className="input" value={show.showStart} onChange={s('showStart')} required />
            </div>
            <div>
              <label className="label" htmlFor="price">Base price (₹)</label>
              <input id="price" type="number" className="input" value={show.basePrice} onChange={s('basePrice')} required />
            </div>
          </div>
          <p className="text-xs text-gray-500">Premium seats are charged base price + ₹100. Two shows can't start on the same screen at the same time.</p>
          <button className="btn-primary" disabled={showForm.busy}>Schedule show</button>
          {showForm.msg && <Alert kind={showForm.msg.kind}>{showForm.msg.text}</Alert>}
        </form>
      </div>
    </div>
  );
}
