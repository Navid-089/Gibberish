const fmt0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(n) {
  n = Number(n) || 0;
  const a = Math.abs(n);
  const s = Number.isInteger(a) ? fmt0.format(a) : fmt2.format(a);
  return (n < 0 ? '−' : '') + '৳' + s;
}

export function compact(n) {
  n = Number(n) || 0;
  const a = Math.abs(n);
  let s;
  if (a >= 1e5) s = (a / 1e5).toFixed(a % 1e5 ? 1 : 0).replace(/\.0$/, '') + 'L';
  else if (a >= 1e3) s = (a / 1e3).toFixed(a % 1e3 ? 1 : 0).replace(/\.0$/, '') + 'k';
  else s = String(Math.round(a));
  return (n < 0 ? '−' : '') + s;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const ym = (d) => ymd(d).slice(0, 7);
export const todayStr = () => ymd(new Date());

export function monthLabel(m, opts = { month: 'long', year: 'numeric' }) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', opts);
}
export function shiftMonth(m, d) {
  const [y, mo] = m.split('-').map(Number);
  return ym(new Date(y, mo - 1 + d, 1));
}
export function daysIn(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export function dayLabel(ds) {
  const t = new Date();
  if (ds === ymd(t)) return 'Today';
  t.setDate(t.getDate() - 1);
  if (ds === ymd(t)) return 'Yesterday';
  const [Y, M, D] = ds.split('-').map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function shortDate(ds) {
  const [Y, M, D] = ds.split('-').map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// "120+80" -> 200. Digits and + - * / ( ) only.
export function parseAmount(s) {
  s = String(s ?? '').replace(/,/g, '').replace(/৳/g, '').trim();
  if (!s) return NaN;
  if (!/^[\d.\s+\-*/()]+$/.test(s)) return NaN;
  try {
    const v = Function('"use strict";return (' + s + ')')();
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
  } catch { return NaN; }
}
export const isExpression = (s) => /[+\-*/]/.test(String(s).replace(/^\s*-/, ''));

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export function addDays(ds, n) {
  const [Y, M, D] = ds.split('-').map(Number);
  return ymd(new Date(Y, M - 1, D + n));
}
export function dow(ds) {
  const [Y, M, D] = ds.split('-').map(Number);
  return new Date(Y, M - 1, D).getDay(); // 0 = Sunday
}
export function longDay(ds) {
  const [Y, M, D] = ds.split('-').map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
