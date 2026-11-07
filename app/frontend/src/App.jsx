import { NavLink, Route, Routes } from 'react-router-dom';
import { useUser } from './UserContext.jsx';
import { Alert } from './components/ui.jsx';
import MoviesPage from './pages/MoviesPage.jsx';
import MoviePage from './pages/MoviePage.jsx';
import ShowsPage from './pages/ShowsPage.jsx';
import SeatMapPage from './pages/SeatMapPage.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import BookingsPage from './pages/BookingsPage.jsx';
import WatchlistPage from './pages/WatchlistPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';

const NAV = [
  ['/', 'Movies'],
  ['/shows', 'Shows'],
  ['/watchlist', 'Watchlist'],
  ['/bookings', 'My bookings'],
  ['/reports', 'Reports'],
  ['/admin', 'Admin'],
];

function UserPicker() {
  const { users, userId, setUserId } = useUser();
  return (
    <label className="flex items-center gap-2 text-xs text-gray-400">
      <span className="hidden sm:inline">Acting as</span>
      <select
        className="rounded-lg border border-ink-line bg-ink px-2 py-1.5 text-sm text-gray-100 focus:border-reel focus:outline-none"
        value={userId ?? ''}
        onChange={(e) => setUserId(Number(e.target.value))}
      >
        {users.map((u) => (
          <option key={u.user_id} value={u.user_id}>@{u.username}</option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  const { error } = useUser();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="font-display text-2xl text-white">
            Movie<span className="text-reel">DB</span>
          </NavLink>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-ink-soft text-reel' : 'text-gray-300 hover:text-white'}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto"><UserPicker /></div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6">
            <Alert>
              Cannot reach the API: {error}. Is the backend running (<code>npm start</code> in app/backend)?
            </Alert>
          </div>
        )}
        <Routes>
          <Route path="/" element={<MoviesPage />} />
          <Route path="/movies/:id" element={<MoviePage />} />
          <Route path="/shows" element={<ShowsPage />} />
          <Route path="/shows/:id" element={<SeatMapPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/bookings/:id/pay" element={<PaymentPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<p className="text-gray-400">Page not found.</p>} />
        </Routes>
      </main>

      <footer className="border-t border-ink-line py-6 text-center text-xs text-gray-500">
        DBMS course project · Oracle 21c · Express · React
      </footer>
    </div>
  );
}
