// The API sends dates as plain "2026-11-08T18:30" strings (formatted in SQL),
// so we only reformat the text here and never convert time zones.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${day} ${d} ${MONTHS[m - 1]}`;
}

export const fmtTime = (s) => (s ? s.slice(11, 16) : '');
export const fmtDateTime = (s) => `${fmtDate(s)}, ${fmtTime(s)}`;
export const rupees = (n) => '₹' + Number(n ?? 0).toLocaleString('en-IN');
export const hours = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;
