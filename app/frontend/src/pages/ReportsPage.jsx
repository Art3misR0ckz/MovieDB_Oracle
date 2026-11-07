// Reports: a few project queries run live on Oracle, with their SQL shown.
import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Loading, useLoad } from '../components/ui.jsx';

function ReportTable({ rows }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">no rows selected</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink-line text-xs uppercase tracking-wide text-gray-400">
            {cols.map((c) => <th key={c} className="py-2 pr-4 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink-line/50 last:border-0">
              {cols.map((c) => (
                <td key={c} className={`py-1.5 pr-4 ${typeof r[c] === 'number' ? 'tabular-nums' : ''}`}>{r[c] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const { data, error, loading } = useLoad(() => api.reports(), []);
  const [openSql, setOpenSql] = useState({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Reports</h1>
        <p className="mt-1 text-sm text-gray-400">Some of the project's SQL queries, run live against the database.</p>
      </div>
      <Alert>{error}</Alert>
      {loading && !data ? <Loading /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.map((r) => (
            <section key={r.id} className="card space-y-3 p-5">
              <div>
                <h2 className="h2">{r.title}</h2>
                <span className="chip mt-1 border-reel/40 text-reel">{r.concept}</span>
              </div>
              <ReportTable rows={r.rows} />
              <button className="text-xs text-gray-400 hover:text-white"
                      onClick={() => setOpenSql({ ...openSql, [r.id]: !openSql[r.id] })}>
                {openSql[r.id] ? 'Hide SQL' : 'Show SQL'}
              </button>
              {openSql[r.id] && (
                <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-xs leading-relaxed text-emerald-200">{r.sql}</pre>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
