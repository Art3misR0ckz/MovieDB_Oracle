// Small shared pieces used by several pages.
import { useCallback, useEffect, useState } from 'react';

// Loads data when the page opens (and again when `deps` change).
// Returns { data, error, loading, reload }.
export function useLoad(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return loader()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e) => setState({ data: null, error: e.message, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  const styles = {
    error: 'border-red-500/40 bg-red-500/10 text-red-200',
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-gray-500">Loading…</p>;
}

// Shows a rating like 4.5 as stars: ★★★★½
export function Stars({ value, className = '' }) {
  if (value === null || value === undefined) return <span className="text-sm text-gray-500">not rated</span>;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className={`whitespace-nowrap text-reel ${className}`} title={`${value} / 5`}>
      {'★'.repeat(full)}{half ? '½' : ''}
      <span className="ml-1 text-xs text-gray-400">{Number(value).toFixed(1)}</span>
    </span>
  );
}

// Coloured badge for booking / payment status
export function StatusBadge({ status }) {
  if (!status) return <span className="chip">no payment</span>;
  const colour = {
    CONFIRMED: 'border-emerald-500/50 text-emerald-300',
    SUCCESS: 'border-emerald-500/50 text-emerald-300',
    PENDING: 'border-amber-500/50 text-amber-300',
    CANCELLED: 'border-gray-500/50 text-gray-400',
    REFUNDED: 'border-sky-500/50 text-sky-300',
    FAILED: 'border-red-500/50 text-red-300',
  }[status] || '';
  return <span className={`chip ${colour}`}>{status}</span>;
}

export function Empty({ children }) {
  return <div className="card px-6 py-10 text-center text-sm text-gray-400">{children}</div>;
}
