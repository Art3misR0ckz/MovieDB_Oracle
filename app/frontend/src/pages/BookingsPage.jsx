// W8: my bookings (BOOKING_SUMMARY view) and cancel (cancel_booking procedure)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../UserContext.jsx';
import { Alert, Empty, Loading, StatusBadge, useLoad } from '../components/ui.jsx';
import { fmtDateTime, rupees } from '../format.js';

function BookingCard({ b, onCancel, busy }) {
  const canCancel = b.upcoming === 1 && b.booking_status !== 'CANCELLED';
  return (
    <div className={`card flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${b.booking_status === 'CANCELLED' ? 'opacity-60' : ''}`}>
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">{b.title}</span>
          <StatusBadge status={b.booking_status} />
          {b.payment_status && b.payment_status !== 'SUCCESS' && <StatusBadge status={b.payment_status} />}
        </div>
        <div className="text-sm text-gray-400">{b.theatre_name} · {fmtDateTime(b.show_start)}</div>
        <div className="text-xs text-gray-500">
          Booking #{b.booking_id} · {b.seat_count > 0 ? `Seats ${b.seats}` : 'no seats (released)'}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold text-reel">
          {rupees(b.booking_status === 'CANCELLED' ? b.amount_charged : b.total_amount)}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          {b.booking_status === 'PENDING' && b.upcoming === 1 && (
            <Link to={`/bookings/${b.booking_id}/pay`} className="btn-primary">Pay</Link>
          )}
          {canCancel && (
            <button className="btn-danger" disabled={busy} onClick={() => onCancel(b)}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const { userId, user } = useUser();
  const { data, error, loading, reload } = useLoad(() => (userId ? api.bookings(userId) : Promise.resolve([])), [userId]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function cancel(b) {
    if (!window.confirm(`Cancel booking #${b.booking_id} for ${b.title}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.cancel(b.booking_id, userId);
      setMsg({ kind: 'success', text: `Booking #${b.booking_id} cancelled. Seats released${b.booking_status === 'CONFIRMED' ? ', payment refunded' : ''}.` });
      reload();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const upcoming = (data || []).filter((b) => b.upcoming === 1);
  const past = (data || []).filter((b) => b.upcoming !== 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">My bookings</h1>
        {user && <p className="mt-1 text-sm text-gray-400">Tickets booked by @{user.username}</p>}
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <Alert>{error}</Alert>
      {loading && !data ? <Loading /> : data?.length === 0 ? (
        <Empty>No bookings yet. <Link to="/shows" className="text-reel">Find a show</Link>.</Empty>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="h2">Upcoming</h2>
            {upcoming.length === 0 && <p className="text-sm text-gray-500">Nothing coming up.</p>}
            {upcoming.map((b) => <BookingCard key={b.booking_id} b={b} onCancel={cancel} busy={busy} />)}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="h2">Past</h2>
              {past.map((b) => <BookingCard key={b.booking_id} b={b} onCancel={cancel} busy={busy} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
