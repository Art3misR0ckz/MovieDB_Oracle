// W6: seat map (SHOW_SEAT_STATUS view) and booking (book_seats procedure).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../UserContext.jsx';
import { Alert, Loading, useLoad } from '../components/ui.jsx';
import { fmtDateTime, rupees } from '../format.js';

const MAX_SEATS = 10;   // same limit as book_seats (-20022)

export default function SeatMapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId, user } = useUser();
  const { data: show, error, loading, reload } = useLoad(() => api.show(id), [id]);
  const [selected, setSelected] = useState([]);   // seat_ids
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !show) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  if (!show) return null;

  const started = show.started === 1;
  const rows = {};
  for (const s of show.seats) (rows[s.seat_row] ||= []).push(s);
  const chosen = show.seats.filter((s) => selected.includes(s.seat_id));
  const total = chosen.reduce((sum, s) => sum + s.seat_price, 0);

  function toggle(seat) {
    setMsg(null);
    if (seat.seat_status === 'BOOKED' || started) return;
    if (selected.includes(seat.seat_id)) setSelected(selected.filter((x) => x !== seat.seat_id));
    else if (selected.length < MAX_SEATS) setSelected([...selected, seat.seat_id]);
    else setMsg(`You can book at most ${MAX_SEATS} seats at a time.`);
  }

  async function book() {
    setBusy(true);
    setMsg(null);
    try {
      const { booking_id } = await api.book(userId, show.show_id, selected);
      navigate(`/bookings/${booking_id}/pay`);
    } catch (err) {
      // e.g. someone else took a seat a moment ago: nothing was saved, refresh the map
      setMsg(err.message);
      setSelected([]);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const seatClass = (s) => {
    if (s.seat_status === 'BOOKED') return 'cursor-not-allowed border-gray-700 bg-gray-800 text-gray-600';
    if (selected.includes(s.seat_id)) return 'border-reel bg-reel text-ink';
    if (s.seat_type === 'PREMIUM') return 'border-violet-400/70 text-violet-200 hover:bg-violet-400/20';
    return 'border-gray-500 text-gray-200 hover:bg-white/10';
  };

  return (
    <div className="space-y-6">
      <Link to={`/movies/${show.movie_id}`} className="text-sm text-gray-400 hover:text-white">← {show.title}</Link>
      <div>
        <h1 className="h1">{show.title}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {show.theatre_name}, {show.city} · Screen {show.screen_no} ({show.screen_type}) · {fmtDateTime(show.show_start)}
        </p>
      </div>

      {started && <Alert kind="info">This show has already started, so it can't be booked.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="card overflow-x-auto p-6">
          <div className="mx-auto mb-8 h-2 w-3/4 rounded-full bg-gradient-to-r from-transparent via-reel/70 to-transparent" />
          <p className="-mt-6 mb-8 text-center text-[10px] uppercase tracking-[0.3em] text-gray-500">screen this way</p>
          <div className="mx-auto w-fit space-y-3">
            {Object.entries(rows).map(([row, seats]) => (
              <div key={row} className="flex items-center gap-3">
                <span className="w-4 text-xs text-gray-500">{row}</span>
                {seats.map((s) => (
                  <button
                    key={s.seat_id}
                    onClick={() => toggle(s)}
                    disabled={s.seat_status === 'BOOKED' || started}
                    title={`${s.seat_label} · ${s.seat_type} · ${rupees(s.seat_price)}`}
                    className={`h-10 w-10 rounded-t-lg border-2 text-xs font-semibold transition ${seatClass(s)}`}
                  >
                    {s.seat_number}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border-2 border-gray-500" /> Regular {rupees(show.base_price)}</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border-2 border-violet-400/70" /> Premium {rupees(show.base_price + 100)}</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border-2 border-reel bg-reel" /> Selected</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border-2 border-gray-700 bg-gray-800" /> Booked</span>
          </div>
        </div>

        <aside className="card h-fit space-y-4 p-5">
          <h2 className="h2">Your selection</h2>
          {chosen.length === 0 ? (
            <p className="text-sm text-gray-500">Click seats on the map to select them.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {chosen.map((s) => (
                <li key={s.seat_id} className="flex justify-between">
                  <span>{s.seat_label} <span className="text-xs text-gray-500">{s.seat_type.toLowerCase()}</span></span>
                  <span>{rupees(s.seat_price)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between border-t border-ink-line pt-3 font-semibold">
            <span>Total</span><span className="text-reel">{rupees(total)}</span>
          </div>
          <button className="btn-primary w-full" onClick={book} disabled={busy || chosen.length === 0 || started || !userId}>
            {busy ? 'Booking…' : `Book as @${user?.username ?? '…'}`}
          </button>
          <Alert>{msg}</Alert>
          <p className="text-xs text-gray-500">
            Seats are held as a PENDING booking until you pay. All seats are booked together or not at all.
          </p>
        </aside>
      </div>
    </div>
  );
}
