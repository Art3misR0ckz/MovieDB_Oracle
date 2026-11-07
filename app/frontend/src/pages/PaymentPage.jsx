// W7: simulated payment (make_payment procedure: PAYMENT row + booking CONFIRMED)
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../UserContext.jsx';
import { Alert, Loading, StatusBadge, useLoad } from '../components/ui.jsx';
import { fmtDateTime, rupees } from '../format.js';

const METHODS = [
  ['UPI', 'UPI'],
  ['CARD', 'Credit / debit card'],
  ['NETBANKING', 'Net banking'],
  ['WALLET', 'Wallet'],
];

export default function PaymentPage() {
  const { id } = useParams();
  const { userId } = useUser();
  const { data: b, error, loading, reload } = useLoad(() => api.booking(id, userId), [id, userId]);
  const [method, setMethod] = useState('UPI');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !b) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  if (!b) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="h1">{b.booking_status === 'PENDING' ? 'Payment' : 'Booking #' + b.booking_id}</h1>

      <div className="card space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">{b.title}</div>
            <div className="text-sm text-gray-400">{b.theatre_name}</div>
            <div className="text-sm text-gray-400">{fmtDateTime(b.show_start)}</div>
          </div>
          <StatusBadge status={b.booking_status} />
        </div>
        <div className="flex justify-between border-t border-ink-line pt-3 text-sm">
          <span className="text-gray-400">Seats</span><span>{b.seats || '—'}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span><span className="text-reel">{rupees(b.total_amount)}</span>
        </div>
      </div>

      {b.booking_status === 'PENDING' && (
        <div className="card space-y-4 p-5">
          <h2 className="h2">Pay with</h2>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(([value, label]) => (
              <label key={value}
                     className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${method === value ? 'border-reel text-white' : 'border-ink-line text-gray-300'}`}>
                <input type="radio" name="method" value={value} checked={method === value}
                       onChange={() => setMethod(value)} className="mr-2 accent-amber-400" />
                {label}
              </label>
            ))}
          </div>
          <button className="btn-primary w-full" disabled={busy}
                  onClick={() => run(() => api.pay(b.booking_id, userId, method))}>
            Pay {rupees(b.total_amount)}
          </button>
          <button className="btn-ghost w-full" disabled={busy}
                  onClick={() => run(() => api.cancel(b.booking_id, userId))}>
            Cancel and release seats
          </button>
          <p className="text-xs text-gray-500">Payment is simulated: no real money moves.</p>
        </div>
      )}

      {b.booking_status === 'CONFIRMED' && (
        <Alert kind="success">
          Paid {rupees(b.amount_charged)}. Your seats are confirmed. Enjoy the movie!
        </Alert>
      )}
      {b.booking_status === 'CANCELLED' && (
        <Alert kind="info">This booking was cancelled and its seats were released.</Alert>
      )}
      <Alert>{msg}</Alert>

      <Link to="/bookings" className="btn-ghost">Go to my bookings</Link>
    </div>
  );
}
