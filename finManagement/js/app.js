import * as db from './db.js';
import { money, compact, esc, ym, ymd, todayStr, monthLabel, shiftMonth, daysIn, uid, dayLabel, shortDate, parseAmount, isExpression, debounce, isIOS, isStandalone, addDays, dow, longDay } from './util.js';
import { renderDaily } from './charts.js';
import { icon, ICON_NAMES } from './icons.js';

/* ---------------- Defaults & state ---------------- */
// Category defaults are public. Incomes, fixed outflows, accounts and first-run entries come from
// js/personal.js (gitignored), falling back to js/personal.example.js on a fresh clone.
const CATEGORY_DEFAULTS = [
  { id: 'food', name: 'Food', icon: 'utensils' },
  { id: 'transport', name: 'Transport', icon: 'car' },
  { id: 'groceries', name: 'Groceries', icon: 'cart' },
  { id: 'shopping', name: 'Shopping', icon: 'bag' },
  { id: 'bills', name: 'Bills', icon: 'receipt' },
  { id: 'health', name: 'Health', icon: 'cross' },
  { id: 'fun', name: 'Fun', icon: 'film' },
  { id: 'other', name: 'Other', icon: 'sparkles' },
  { id: 'fixed', name: 'Fixed', icon: 'repeat', fixed: true },
];
let DEFAULTS = { incomes: [], fixed: [], accounts: [], categories: CATEGORY_DEFAULTS, routines: [], theme: 'dark' };
let FIRST_RUN_TX = [];

async function loadPersonal() {
  let mod;
  try { mod = await import('./personal.js'); }
  catch { mod = await import('./personal.example.js'); }
  const p = mod.PERSONAL || {};
  DEFAULTS = { ...DEFAULTS, incomes: p.incomes || [], fixed: p.fixed || [], accounts: p.accounts || [] };
  FIRST_RUN_TX = (p.firstRun || []).map((t) => ({ ...t, account: null, createdAt: 1, updatedAt: 1 }));
}

const TYPE_LABEL = { expense: 'Expense', income: 'Income', transfer: 'Transfer', lend: 'Lend', repay: 'Repayment', borrow: 'Borrow', settle: 'Pay back' };
const OUT_TYPES = new Set(['expense', 'lend', 'settle']);
const IN_TYPES = new Set(['income', 'repay', 'borrow']);

const state = {
  view: 'home',
  month: ym(new Date()),
  settings: null,
  all: [],
  overrides: {},     // month -> { incomes:{id:amt}, fixed:{id:amt} }
  filter: null,      // category id | 'type:income' | 'type:transfer' | 'type:lending'
  search: '',
  day: null,         // YYYY-MM-DD when the history view is zoomed to one day
};

const $ = (s, r = document) => r.querySelector(s);
const el = {
  topbar: $('#topbar'), view: $('#view'), tabbar: $('#tabbar'), fab: $('#fab'),
  backdrop: $('#backdrop'), sheet: $('#sheet'), toast: $('#toast'), importFile: $('#importFile'),
};

const ICON = {
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

/* ---------------- Derived data ---------------- */
const cats = () => state.settings.categories;
const accounts = () => state.settings.accounts;
const catById = (id) => cats().find((c) => c.id === id) || { id: '?', name: 'Uncategorised', icon: 'help' };
const accById = (id) => accounts().find((a) => a.id === id) || { id: '?', name: 'Unassigned', icon: 'help' };
const txType = (e) => e.type || 'expense';
const isFixedCat = (id) => !!catById(id).fixed;
function catColor(id) {
  const i = cats().findIndex((c) => c.id === id);
  return i >= 0 && i < 8 ? `var(--s${i + 1})` : 'var(--s0)';
}
const ACC_TONES = { banknote: 'var(--good)', bank: 'var(--s7)', smartphone: 'var(--s5)', card: 'var(--s2)', piggy: 'var(--s3)', wallet: 'var(--s4)', coins: 'var(--s4)', home: 'var(--s8)' };
const accColor = (id) => ACC_TONES[accById(id).icon] || 'var(--accent)';
const cicon = (name, color) => `<span class="ci" style="color:${color}">${icon(name)}</span>`;
const sortTx = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
const monthTx = (m = state.month) => state.all.filter((e) => e.date.startsWith(m)).sort(sortTx);
const personKey = (p) => String(p || '').trim().toLowerCase();

function balances() {
  const b = Object.fromEntries(accounts().map((a) => [a.id, Number(a.opening) || 0]));
  for (const e of state.all) {
    const t = txType(e);
    if (OUT_TYPES.has(t)) { if (e.account in b) b[e.account] -= e.amount; }
    else if (IN_TYPES.has(t)) { if (e.account in b) b[e.account] += e.amount; }
    else if (t === 'transfer') { if (e.account in b) b[e.account] -= e.amount; if (e.toAccount in b) b[e.toAccount] += e.amount; }
  }
  return b;
}
function owed() {
  const m = {};
  for (const e of state.all) {
    const t = txType(e);
    if (t !== 'lend' && t !== 'repay') continue;
    const k = personKey(e.person);
    if (!k) continue;
    m[k] = m[k] || { person: e.person.trim(), amt: 0, doubtful: false };
    m[k].amt += t === 'lend' ? e.amount : -e.amount;
    if (t === 'lend' && e.doubtful) m[k].doubtful = true;
  }
  return Object.values(m).filter((x) => x.amt > 0.004).sort((a, b) => (a.doubtful - b.doubtful) || b.amt - a.amt);
}
const routines = () => state.settings.routines;
const routineById = (id) => routines().find((r) => r.id === id);
const routineRuns = (d) => (r) => r.days === 'weekdays' ? dow(d) <= 4 : true; // BD weekdays: Sun-Thu
function debts() {
  const m = {};
  for (const e of state.all) {
    const t = txType(e);
    if (t !== 'borrow' && t !== 'settle') continue;
    const k = personKey(e.person);
    if (!k) continue;
    m[k] = m[k] || { person: e.person.trim(), amt: 0 };
    m[k].amt += t === 'borrow' ? e.amount : -e.amount;
  }
  return Object.values(m).filter((x) => x.amt > 0.004).sort((a, b) => b.amt - a.amt);
}
const people = () => [...new Set(state.all.filter((e) => e.person).map((e) => e.person.trim()))].sort();

function figures(m = state.month) {
  const ov = state.overrides[m] || {};
  const income = state.settings.incomes.reduce((s, i) => s + ((ov.incomes?.[i.id] ?? Number(i.amount)) || 0), 0);
  const fixed = state.settings.fixed.reduce((s, i) => s + ((ov.fixed?.[i.id] ?? Number(i.amount)) || 0), 0);
  const all = monthTx(m);
  const list = all.filter((e) => txType(e) === 'expense' && !isFixedCat(e.category));
  const fixedPaid = all.filter((e) => txType(e) === 'expense' && isFixedCat(e.category)).reduce((s, e) => s + e.amount, 0);
  const received = all.filter((e) => txType(e) === 'income').reduce((s, e) => s + e.amount, 0);
  const spent = list.reduce((s, e) => s + e.amount, 0);
  const budget = income - fixed;
  const left = budget - spent;
  const days = daysIn(m);
  const today = new Date();
  const isCurrent = m === ym(today);
  const isPast = m < ym(today);
  const todayDay = isCurrent ? today.getDate() : null;
  const daysLeft = isCurrent ? days - todayDay + 1 : null;
  const perDay = isCurrent ? Math.max(left, 0) / daysLeft : isPast ? spent / days : budget / days;
  const daily = Array.from({ length: days }, () => 0);
  for (const e of list) daily[Number(e.date.slice(8, 10)) - 1] += e.amount;
  const byCat = {};
  for (const e of list) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  const catRows = Object.entries(byCat).map(([id, amt]) => ({ id, amt })).sort((a, b) => b.amt - a.amt);
  return { income, fixed, fixedPaid, received, spent, budget, left, days, isCurrent, isPast, todayDay, daysLeft, perDay, daily, catRows, list, all, hasOverride: !!(ov.incomes || ov.fixed) };
}

/* ---------------- Rendering ---------------- */
function render() {
  renderTopbar();
  renderTabs();
  if (state.view === 'home') renderHome();
  else if (state.view === 'history') renderHistory();
  else if (state.view === 'accounts') renderAccounts();
  else renderSettings();
  el.fab.classList.toggle('hide', state.view === 'settings');
  window.scrollTo({ top: 0 });
}

function renderTopbar() {
  if (state.view === 'settings' || state.view === 'accounts') {
    el.topbar.innerHTML = `<div class="title">${state.view === 'settings' ? 'Settings' : 'Accounts'}</div>`;
    return;
  }
  const isNow = state.month === ym(new Date());
  el.topbar.innerHTML = `
    <div class="month-nav">
      <button class="icon-btn" data-action="prev-month" aria-label="Previous month">${ICON.chevL}</button>
      <button class="month-label" data-action="this-month" title="Jump to this month">${monthLabel(state.month)}${isNow ? '' : '<span class="sub">tap for current</span>'}</button>
      <button class="icon-btn" data-action="next-month" aria-label="Next month">${ICON.chevR}</button>
    </div>`;
}

function renderTabs() {
  el.tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === state.view));
}

function txRow(e) {
  const t = txType(e);
  let ico, color = 'var(--s0)', title, sub, amt = money(e.amount), amtCls = '';
  const acc = (id) => esc(accById(id).name);
  if (t === 'expense') {
    const c = catById(e.category);
    ico = icon(c.icon); color = catColor(e.category);
    title = esc(e.note) || esc(c.name);
    sub = `${e.note ? esc(c.name) + ' · ' : ''}${e.account ? acc(e.account) + ' · ' : ''}${shortDate(e.date)}`;
  } else if (t === 'income') {
    ico = icon('coins'); color = 'var(--good)';
    title = esc(e.note) || 'Income';
    sub = `Into ${acc(e.account)} · ${shortDate(e.date)}`;
    amt = '+' + amt; amtCls = ' in';
  } else if (t === 'transfer') {
    ico = icon('arrows'); color = 'var(--accent)';
    title = esc(e.note) || 'Transfer';
    sub = `${acc(e.account)} → ${acc(e.toAccount)} · ${shortDate(e.date)}`;
    amtCls = ' muted';
  } else if (t === 'lend') {
    ico = icon('hand'); color = 'var(--warn)';
    title = `Lent to ${esc(e.person)}${e.doubtful ? ' · unlikely' : ''}`;
    sub = `${e.note ? esc(e.note) + ' · ' : ''}${e.account ? 'From ' + acc(e.account) + ' · ' : ''}${shortDate(e.date)}`;
  } else if (t === 'borrow') {
    ico = icon('user'); color = 'var(--s8)';
    title = `Borrowed from ${esc(e.person)}`;
    sub = `${e.note ? esc(e.note) + ' \u00b7 ' : ''}${e.account ? 'Into ' + acc(e.account) + ' \u00b7 ' : ''}${shortDate(e.date)}`;
    amt = '+' + amt; amtCls = ' in';
  } else if (t === 'settle') {
    ico = icon('user'); color = 'var(--s8)';
    title = `Paid back ${esc(e.person)}`;
    sub = `${e.note ? esc(e.note) + ' \u00b7 ' : ''}${e.account ? 'From ' + acc(e.account) + ' \u00b7 ' : ''}${shortDate(e.date)}`;
  } else {
    ico = icon('hand'); color = 'var(--good)';
    title = `${esc(e.person)} paid back`;
    sub = `${e.note ? esc(e.note) + ' · ' : ''}${e.account ? 'Into ' + acc(e.account) + ' · ' : ''}${shortDate(e.date)}`;
    amt = '+' + amt; amtCls = ' in';
  }
  return `
    <button class="tx" data-action="edit-tx" data-id="${e.id}">
      <span class="tx-ico" style="--c:${color}">${ico}</span>
      <span class="tx-main"><span class="tx-title">${title}</span><span class="tx-sub">${sub}</span></span>
      <span class="tx-amt${amtCls}">${amt}</span>
    </button>`;
}

function renderHome() {
  const f = figures();
  const pct = f.budget > 0 ? (f.spent / f.budget) * 100 : f.spent > 0 ? 100 : 0;
  const level = pct >= 100 ? 'crit' : pct >= 75 ? 'warn' : 'ok';
  const over = f.left < 0;
  const mShort = monthLabel(state.month, { month: 'short' });
  const showHint = isIOS() && !isStandalone() && !localStorage.getItem('hintDismissed');
  const bal = balances();
  const owedTotal = owed().filter((o) => !o.doubtful).reduce((s, o) => s + o.amt, 0);
  const debtTotal = debts().reduce((s, o) => s + o.amt, 0);

  const perDayLabel = f.isCurrent ? 'Safe per day' : f.isPast ? 'Avg per day' : 'Budget per day';
  const perDaySub = f.isCurrent ? `${f.daysLeft} day${f.daysLeft === 1 ? '' : 's'} left` : f.isPast ? `${f.days} days` : 'if nothing changes';

  el.view.innerHTML = `
    ${showHint ? `<div class="hint"><span class="e">${icon('share')}</span><span>Install: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span><button class="x" data-action="dismiss-hint" aria-label="Dismiss">${ICON.x}</button></div>` : ''}

    <section class="card hero">
      <div class="hero-label">${over ? `${icon('alert')} Over budget` : 'Left to spend'} · ${mShort}</div>
      <div class="hero-value${over ? ' over' : ''}">${money(f.left)}</div>
      <div class="meter" data-level="${level}"><div class="meter-fill" data-w="${Math.min(100, pct).toFixed(1)}"></div></div>
      <div class="meter-row"><span>${money(f.spent)} spent of ${money(f.budget)}</span><span>${Math.round(pct)}%</span></div>
    </section>

    <div class="tiles">
      <button class="tile tap" data-action="edit-override" data-kind="incomes">
        <span class="tile-label">Income ${f.hasOverride ? '<span class="dot" title="Adjusted this month"></span>' : ''}</span>
        <span class="tile-value">${money(f.income)}</span>
        <span class="tile-sub">${f.received > 0 ? `${money(f.received)} received` : esc(state.settings.incomes.map((i) => i.name).join(' + ')) || 'Tap to set'}</span>
      </button>
      <button class="tile tap" data-action="edit-override" data-kind="fixed">
        <span class="tile-label">Fixed</span>
        <span class="tile-value">${money(f.fixed)}</span>
        <span class="tile-sub">${f.fixedPaid > 0 ? `${money(f.fixedPaid)} paid` : esc(state.settings.fixed.map((i) => i.name).join(', ')) || 'Tap to set'}</span>
      </button>
      <div class="tile">
        <span class="tile-label">Spent</span>
        <span class="tile-value">${money(f.spent)}</span>
        <span class="tile-sub">${f.list.length} expense${f.list.length === 1 ? '' : 's'}</span>
      </div>
      <div class="tile">
        <span class="tile-label">${perDayLabel}</span>
        <span class="tile-value">${money(Math.round(f.perDay))}</span>
        <span class="tile-sub">${perDaySub}</span>
      </div>
    </div>

    <div class="acct-strip">
      ${accounts().map((a) => `<button class="acct-pill" data-action="tab" data-tab="accounts"><span class="e" style="color:${accColor(a.id)}">${icon(a.icon)}</span><span><span class="acct-name">${esc(a.name)}</span><span class="acct-bal">${money(bal[a.id])}</span></span></button>`).join('')}
      ${owedTotal > 0 ? `<button class="acct-pill" data-action="tab" data-tab="accounts"><span class="e" style="color:var(--s4)">${icon('hand')}</span><span><span class="acct-name">Owed to me</span><span class="acct-bal">${money(owedTotal)}</span></span></button>` : ''}
      ${debtTotal > 0 ? `<button class="acct-pill" data-action="tab" data-tab="accounts"><span class="e" style="color:var(--s8)">${icon('user')}</span><span><span class="acct-name">I owe</span><span class="acct-bal">${money(debtTotal)}</span></span></button>` : ''}
    </div>

    ${routines().length ? `<section class="card">
      <h3>Daily routine <button class="link" data-action="tab" data-tab="settings">Edit</button></h3>
      <div class="chips wrap">${routines().map((r) => {
        const n = state.all.filter((e) => e.routineId === r.id && e.date === todayStr()).length;
        return `<button class="chip routine${n ? ' done' : ''}" data-action="routine-tap" data-id="${r.id}"><span class="e" style="color:${catColor(r.category)}">${icon(catById(r.category).icon)}</span>${esc(r.name)} \u00b7 ${money(r.amount)}${n ? `<span class="tick">\u2713${n > 1 ? n : ''}</span>` : ''}${r.mode === 'auto' ? '<span class="auto">auto</span>' : ''}</button>`;
      }).join('')}</div>
    </section>` : ''}

    <div class="home-grid">
      <section class="card">
        <h3>Daily spend</h3>
        <div class="chart" id="dailyChart"></div>
      </section>
      <section class="card">
        <h3>By category</h3>
        <div id="catBars">${f.catRows.length ? f.catRows.map((r) => {
          const c = catById(r.id);
          const w = (r.amt / f.catRows[0].amt) * 100;
          return `<div class="cat-row">
            <span class="e" style="color:${catColor(r.id)}">${icon(c.icon)}</span>
            <span class="cat-name">${esc(c.name)}</span>
            <span class="cat-amt">${money(r.amt)}<span class="cat-pct">${Math.round((r.amt / f.spent) * 100)}%</span></span>
            <div class="cat-bar"><div class="cat-fill" style="--c:${catColor(r.id)}" data-w="${w.toFixed(1)}"></div></div>
          </div>`;
        }).join('') : `<div class="empty"><div class="big">${icon('leaf')}</div>Nothing logged in ${mShort} yet.</div>`}</div>
      </section>
    </div>

    <section class="card">
      <h3>Recent <button class="link" data-action="tab" data-tab="history">See all</button></h3>
      <div class="tx-list">${f.all.length ? f.all.slice(0, 6).map(txRow).join('') : `<div class="empty">Tap <b>+</b> to log your first expense.</div>`}</div>
    </section>`;

  renderDaily($('#dailyChart'), { values: f.daily, todayDay: f.todayDay, monthShort: mShort, onPick: (i) => { state.day = `${state.month}-${String(i + 1).padStart(2, '0')}`; state.view = 'history'; render(); } });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.view.querySelectorAll('[data-w]').forEach((n) => { n.style.width = n.dataset.w + '%'; });
  }));
}

function calendarHTML() {
  const f = figures();
  const days = f.days;
  const max = Math.max(0, ...f.daily);
  const first = dow(`${state.month}-01`);
  const today = todayStr();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<span class="cal-blank"></span>');
  for (let d = 1; d <= days; d++) {
    const ds = `${state.month}-${String(d).padStart(2, '0')}`;
    const v = f.daily[d - 1];
    const bin = v > 0 && max > 0 ? Math.min(5, Math.max(1, Math.ceil((v / max) * 5))) : 0;
    const cls = ['cal-day', bin ? `h${bin}` : '', ds === today ? 'today' : '', ds === state.day ? 'sel' : '', ds > today ? 'future' : ''].filter(Boolean).join(' ');
    cells.push(`<button class="${cls}" data-action="pick-day" data-date="${ds}" aria-label="${longDay(ds)}"><b>${d}</b><small>${v > 0 ? compact(v) : ''}</small></button>`);
  }
  return `
    <section class="card cal">
      <h3>Calendar <span class="legend">less <i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><i class="h5"></i> more</span></h3>
      <div class="cal-grid">
        ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => `<span class="cal-dow">${x}</span>`).join('')}
        ${cells.join('')}
      </div>
    </section>`;
}

function renderHistory() {
  const chip = (val, label) => `<button class="chip${state.filter === val ? ' on' : ''}" data-action="filter" data-f="${val || ''}">${label}</button>`;
  el.view.innerHTML = `
    ${calendarHTML()}
    <div class="search">${ICON.search}<input class="input" id="search" type="search" placeholder="Search notes and people" value="${esc(state.search)}" autocomplete="off"></div>
    <div class="chips">
      ${chip(null, 'All')}
      ${cats().map((c) => chip(c.id, `${cicon(c.icon, catColor(c.id))} ${esc(c.name)}`)).join('')}
      ${chip('type:income', `${cicon('coins', 'var(--good)')} Income`)}${chip('type:transfer', `${cicon('arrows', 'var(--accent)')} Transfers`)}${chip('type:lending', `${cicon('hand', 'var(--s4)')} People`)}
    </div>
    <div id="histList"></div>`;
  renderHistoryList();
}

function renderHistoryList() {
  const q = state.search.trim().toLowerCase();
  let list = monthTx();
  if (state.day) list = list.filter((e) => e.date === state.day);
  const f = state.filter;
  if (f === 'type:income') list = list.filter((e) => txType(e) === 'income');
  else if (f === 'type:transfer') list = list.filter((e) => txType(e) === 'transfer');
  else if (f === 'type:lending') list = list.filter((e) => ['lend', 'repay', 'borrow', 'settle'].includes(txType(e)));
  else if (f) list = list.filter((e) => txType(e) === 'expense' && e.category === f);
  if (q) list = list.filter((e) => (e.note || '').toLowerCase().includes(q) || (e.person || '').toLowerCase().includes(q) || (txType(e) === 'expense' && catById(e.category).name.toLowerCase().includes(q)));
  const out = list.filter((e) => OUT_TYPES.has(txType(e))).reduce((s, e) => s + e.amount, 0);
  const inn = list.filter((e) => IN_TYPES.has(txType(e))).reduce((s, e) => s + e.amount, 0);
  const groups = [];
  for (const e of list) {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e); else groups.push({ date: e.date, items: [e] });
  }
  const dayTotal = (items) => items.filter((e) => txType(e) === 'expense').reduce((s, e) => s + e.amount, 0);
  const dayNav = state.day ? `
    <div class="day-nav">
      <button class="icon-btn" data-action="shift-day" data-n="-1" aria-label="Previous day">${ICON.chevL}</button>
      <div class="day-nav-mid"><b>${dayLabel(state.day)}</b><span>${longDay(state.day)}</span></div>
      <button class="icon-btn" data-action="shift-day" data-n="1" aria-label="Next day">${ICON.chevR}</button>
    </div>
    <div class="row">
      <button class="btn sm" data-action="add-on-day">+ Add on this day</button>
      <button class="btn sm ghost" data-action="clear-day">Whole month</button>
    </div>` : '';
  const scope = state.day ? 'that day' : `in ${monthLabel(state.month, { month: 'long' })}`;
  $('#histList').innerHTML = `
    ${dayNav}
    <div class="summary"><b>${list.length}</b> item${list.length === 1 ? '' : 's'} \u00b7 out <b>${money(out)}</b>${inn ? ` \u00b7 in <b>${money(inn)}</b>` : ''} ${scope}</div>
    ${groups.length ? groups.map((g) => `
      ${state.day ? '' : `<div class="day-head"><span>${dayLabel(g.date)}</span><b>${dayTotal(g.items) ? money(dayTotal(g.items)) : ''}</b></div>`}
      <div class="group tx-list">${g.items.map(txRow).join('')}</div>`).join('')
    : `<div class="empty"><div class="big">${icon('search')}</div>Nothing ${state.day ? 'logged on this day' : 'here'}.</div>`}`;
  el.view.querySelectorAll('.cal-day').forEach((c) => c.classList.toggle('sel', c.dataset.date === state.day));
}

function renderAccounts() {
  const bal = balances();
  const ow = owed();
  const owedTotal = ow.filter((o) => !o.doubtful).reduce((s, o) => s + o.amt, 0);
  const doubtTotal = ow.filter((o) => o.doubtful).reduce((s, o) => s + o.amt, 0);
  const dl = debts();
  const debtTotal = dl.reduce((s, o) => s + o.amt, 0);
  const inAcc = accounts().reduce((s, a) => s + bal[a.id], 0);
  const mt = monthTx(ym(new Date()));
  const flow = (id) => {
    let i = 0, o = 0;
    for (const e of mt) {
      const t = txType(e);
      if (OUT_TYPES.has(t) && e.account === id) o += e.amount;
      else if (IN_TYPES.has(t) && e.account === id) i += e.amount;
      else if (t === 'transfer') { if (e.account === id) o += e.amount; if (e.toAccount === id) i += e.amount; }
    }
    return { i, o };
  };
  el.view.innerHTML = `
    <section class="card hero">
      <div class="hero-label">Net worth</div>
      <div class="hero-value${inAcc + owedTotal - debtTotal < 0 ? ' over' : ''}">${money(inAcc + owedTotal - debtTotal)}</div>
      <div class="net-row"><span><b>${money(inAcc)}</b> in accounts</span><span><b>${money(owedTotal)}</b> owed to you</span>${debtTotal ? `<span><b>\u2212${money(debtTotal)}</b> you owe</span>` : ''}${doubtTotal ? `<span><b>${money(doubtTotal)}</b> unlikely</span>` : ''}</div>
    </section>
    <div class="actions">
      <button class="action" data-action="new-tx" data-type="income"><span class="e" style="color:var(--good)">${icon('coins')}</span>Add money</button>
      <button class="action" data-action="new-tx" data-type="expense"><span class="e" style="color:var(--s2)">${icon('receipt')}</span>Expense</button>
      <button class="action" data-action="new-tx" data-type="lend"><span class="e" style="color:var(--s4)">${icon('hand')}</span>Lend</button>
    </div>
    <section class="card">
      <h3>Balances <button class="link" data-action="tab" data-tab="settings">Edit</button></h3>
      ${accounts().length ? accounts().map((a) => { const f = flow(a.id); return `
        <div class="acct-row">
          <span class="tx-ico" style="--c:${accColor(a.id)}">${icon(a.icon)}</span>
          <span class="tx-main"><span class="tx-title">${esc(a.name)}</span><span class="tx-sub">This month: +${money(f.i)} · −${money(f.o)}</span></span>
          <span class="tx-amt${bal[a.id] < 0 ? ' neg' : ''}">${money(bal[a.id])}</span>
        </div>`; }).join('') : `<div class="empty">No accounts yet. Add some in Settings.</div>`}
      <p class="help">Balances start from each account’s opening amount in Settings and move with every transaction you log.</p>
    </section>
    <section class="card">
      <h3>Owed to me</h3>
      ${ow.length ? ow.map((o) => `
        <div class="owe-row">
          <span class="tx-ico" style="--c:var(--s7)">${icon('user')}</span>
          <span class="tx-main"><span class="tx-title">${esc(o.person)}</span>${o.doubtful ? '<span class="tx-sub">Unlikely to come back</span>' : ''}</span>
          <span class="tx-amt${o.doubtful ? ' muted' : ''}">${money(o.amt)}</span>
          <button class="btn tiny" data-action="new-tx" data-type="repay" data-person="${esc(o.person)}" data-amount="${o.amt}">Got it back</button>
        </div>`).join('') : `<div class="empty"><div class="big">${icon('smile')}</div>Nobody owes you anything.</div>`}
    </section>
    <section class="card">
      <h3>I owe <button class="link" data-action="new-tx" data-type="borrow">+ Borrowed money</button></h3>
      ${dl.length ? dl.map((o) => `
        <div class="owe-row">
          <span class="tx-ico" style="--c:var(--s8)">${icon('user')}</span>
          <span class="tx-main"><span class="tx-title">${esc(o.person)}</span></span>
          <span class="tx-amt">${money(o.amt)}</span>
          <button class="btn tiny" data-action="new-tx" data-type="settle" data-person="${esc(o.person)}" data-amount="${o.amt}">Pay back</button>
        </div>`).join('') : `<div class="empty"><div class="big">${icon('check')}</div>You don\u2019t owe anyone. Keep it that way.</div>`}
    </section>`;
}

function settingsRows(kind) {
  return state.settings[kind].map((r) => `
    <div class="srow">
      <input class="input sm" data-kind="${kind}" data-id="${r.id}" data-field="name" value="${esc(r.name)}" placeholder="Name">
      <input class="input sm num" data-kind="${kind}" data-id="${r.id}" data-field="amount" inputmode="decimal" value="${r.amount}" placeholder="0">
      <button class="x" data-action="remove-row" data-kind="${kind}" data-id="${r.id}" aria-label="Remove">${ICON.x}</button>
    </div>`).join('');
}

function renderSettings() {
  const t = state.settings.theme;
  el.view.innerHTML = `
    <section class="card">
      <h3>Accounts</h3>
      ${accounts().map((a) => `
        <div class="srow acct">
          <button class="x ico-btn" type="button" data-action="pick-icon" data-kind="accounts" data-id="${a.id}" aria-label="Change icon" style="color:${accColor(a.id)}">${icon(a.icon)}</button>
          <input class="input sm" data-kind="accounts" data-id="${a.id}" data-field="name" value="${esc(a.name)}" placeholder="Name">
          <input class="input sm num" data-kind="accounts" data-id="${a.id}" data-field="opening" inputmode="decimal" value="${a.opening}" placeholder="0" title="Opening balance">
          <button class="x" data-action="remove-row" data-kind="accounts" data-id="${a.id}" aria-label="Remove">${ICON.x}</button>
        </div>`).join('')}
      <button class="btn sm" data-action="add-row" data-kind="accounts">+ Add account</button>
      <p class="help">The last column is the opening balance: what was in the account when you started logging. Savings like DPS can be an account too; log the monthly deposit as a transfer.</p>
    </section>
    <section class="card">
      <h3>Income sources</h3>
      ${settingsRows('incomes')}
      <button class="btn sm" data-action="add-row" data-kind="incomes">+ Add source</button>
      <p class="help">Expected monthly amounts for the budget. Tap the Income tile on Home to adjust a single month. When the money actually lands, log it with “Add money” on the Accounts tab.</p>
    </section>
    <section class="card">
      <h3>Fixed outflows</h3>
      ${settingsRows('fixed')}
      <button class="btn sm" data-action="add-row" data-kind="fixed">+ Add outflow</button>
      <p class="help">Reserved before the variable budget: driver, DPS, rent. Log the actual payment in the Fixed category (or as a transfer for savings) so it moves your balance without eating the budget twice.</p>
    </section>
    <section class="card">
      <h3>Daily routine</h3>
      ${routines().length ? routines().map((r) => `
        <div class="crow tap" data-action="edit-routine" data-id="${r.id}">
          <span class="e" style="color:${catColor(r.category)}">${icon(catById(r.category).icon)}</span>
          <span><span class="tx-title">${esc(r.name)} \u00b7 ${money(r.amount)}</span><span class="tx-sub">${esc(catById(r.category).name)} \u00b7 ${esc(accById(r.account).name)} \u00b7 ${r.mode === 'auto' ? 'Automatic' : 'One tap'}${r.days === 'weekdays' ? ', Sun\u2013Thu' : ', every day'}</span></span>
          <button class="x" data-action="remove-routine" data-id="${r.id}" aria-label="Remove">${ICON.x}</button>
        </div>`).join('') : '<p class="help" style="margin-top:0">Things you spend on most days: lunch, commute, tea. One-tap items show on Home as a button. Automatic ones are logged for you every day.</p>'}
      <button class="btn sm" data-action="add-routine">+ Add routine</button>
    </section>
    <section class="card">
      <h3>Categories</h3>
      ${cats().map((c, i) => `
        <div class="crow">
          <button class="e ico-btn" type="button" data-action="pick-icon" data-kind="categories" data-id="${c.id}" aria-label="Change icon" style="color:${catColor(c.id)}">${icon(c.icon)}</button>
          <span><span class="sw" style="--c:${i < 8 ? `var(--s${i + 1})` : 'var(--s0)'}"></span>${esc(c.name)}${c.fixed ? '<span class="badge">not in budget</span>' : ''}</span>
          <button class="x" data-action="remove-cat" data-id="${c.id}" aria-label="Remove">${ICON.x}</button>
        </div>`).join('')}
      <button class="btn sm" data-action="add-cat">+ Add category</button>
      <p class="help">Tap an icon to change it. The first eight categories get their own colour in charts. Expenses in a removed category move to Other.</p>
    </section>
    <section class="card">
      <h3>Appearance</h3>
      <div class="seg">
        <button class="${t === 'dark' ? 'on' : ''}" data-action="theme" data-theme="dark">Dark</button>
        <button class="${t === 'auto' ? 'on' : ''}" data-action="theme" data-theme="auto">Auto</button>
        <button class="${t === 'light' ? 'on' : ''}" data-action="theme" data-theme="light">Light</button>
      </div>
    </section>
    <section class="card">
      <h3>Data</h3>
      <div class="stat-line"><span>Transactions stored</span><span>${state.all.length}</span></div>
      <div class="stat-line"><span>Total ever spent</span><span>${money(state.all.filter((e) => txType(e) === 'expense').reduce((s, e) => s + e.amount, 0))}</span></div>
      <div class="row">
        <button class="btn sm" data-action="export">Export JSON</button>
        <button class="btn sm" data-action="import">Import JSON</button>
      </div>
      <button class="btn sm danger block" data-action="clear">Delete all data</button>
      <p class="help">Everything lives on this device only. Export now and then so a lost phone doesn’t mean lost history.</p>
    </section>
    <section class="card">
      <h3>About</h3>
      <p class="help" style="margin-top:0">Khoroch · a daily expense tracker. ${isStandalone() ? 'Installed as an app.' : 'Add to Home Screen from Safari’s Share menu for the full-screen version.'}</p>
    </section>`;
}

/* ---------------- Sheets ---------------- */
let sheetOpen = false;
function openSheet(html, onMount) {
  el.sheet.innerHTML = `<div class="handle"></div>${html}`;
  el.backdrop.classList.add('show');
  el.sheet.classList.add('show');
  sheetOpen = true;
  onMount?.(el.sheet);
}
function closeSheet() {
  if (!sheetOpen) return;
  sheetOpen = false;
  el.backdrop.classList.remove('show');
  el.sheet.classList.remove('show');
  el.sheet.style.transform = '';
  const active = document.activeElement;
  if (active && el.sheet.contains(active)) active.blur();
  setTimeout(() => { if (!sheetOpen) el.sheet.innerHTML = ''; }, 400);
}

const accChips = (name, sel, label) => `
  <div class="field"><label>${label}</label>
    <div class="chips" data-pick="${name}">${accounts().map((a) => `<button class="chip${a.id === sel ? ' on' : ''}" type="button" data-val="${a.id}">${cicon(a.icon, accColor(a.id))} ${esc(a.name)}</button>`).join('')}</div>
  </div>`;

function openTxSheet(tx, preset = {}) {
  const isEdit = !!tx;
  let type = tx ? txType(tx) : (preset.type || 'expense');
  const ls = (k) => localStorage.getItem(k);
  const pick = {
    category: tx?.category && cats().some((c) => c.id === tx.category) ? tx.category : (cats().some((c) => c.id === ls('lastCat')) ? ls('lastCat') : cats()[0]?.id),
    account: tx?.account && accounts().some((a) => a.id === tx.account) ? tx.account : (accounts().some((a) => a.id === ls('lastAcc')) ? ls('lastAcc') : accounts()[0]?.id),
    toAccount: tx?.toAccount || accounts().find((a) => a.id !== (tx?.account || ls('lastAcc') || accounts()[0]?.id))?.id || accounts()[0]?.id,
  };
  const vals = { amount: tx ? String(tx.amount) : (preset.amount ? String(preset.amount) : ''), note: tx?.note || '', date: tx?.date || preset.date || todayStr(), person: tx?.person || preset.person || '', doubtful: !!tx?.doubtful };

  const body = () => {
    const nonFixed = cats();
    if (type === 'expense') return `
      <div class="cat-grid" id="catGrid">${nonFixed.map((c) => `<button class="cat-opt${c.id === pick.category ? ' on' : ''}" data-cat="${c.id}" type="button"><span class="e" style="color:${catColor(c.id)}">${icon(c.icon)}</span>${esc(c.name)}</button>`).join('')}</div>
      ${accChips('account', pick.account, 'Paid from')}`;
    if (type === 'income') return accChips('account', pick.account, 'Into');
    if (type === 'transfer') return accChips('account', pick.account, 'From') + accChips('toAccount', pick.toAccount, 'To');
    const ppl = people();
    const who = { lend: 'Who', repay: 'Who paid you back', borrow: 'Borrowed from', settle: 'Paying back' }[type];
    const outgoing = type === 'lend' || type === 'settle';
    return `
      <div class="field"><label for="person">${who}</label><input class="input" id="person" list="peopleList" placeholder="Name" autocomplete="off" value="${esc(vals.person)}"><datalist id="peopleList">${ppl.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
      ${accChips('account', pick.account, outgoing ? 'From' : 'Into')}
      ${type === 'lend' ? `<div class="quick"><button class="chip${vals.doubtful ? ' on' : ''}" type="button" id="doubtful">${icon('help')} Unlikely to get it back</button></div>` : ''}`;
  };
  const noteHint = { expense: 'What was it?', income: 'PU salary, Limbics, bonus\u2026', transfer: 'ATM, bKash top-up\u2026', lend: 'Why (optional)', repay: 'Note (optional)', borrow: 'What for (optional)', settle: 'Note (optional)' };

  openSheet(`
    <div class="sheet-head">
      <h2 id="sheetTitle">${isEdit ? 'Edit ' + TYPE_LABEL[type].toLowerCase() : 'New ' + TYPE_LABEL[type].toLowerCase()}</h2>
      ${isEdit ? `<button class="icon-btn danger" data-sheet="delete" aria-label="Delete">${ICON.trash}</button>` : `<button class="icon-btn" data-sheet="close" aria-label="Close">${ICON.x}</button>`}
    </div>
    ${isEdit || type === 'repay' || type === 'settle' ? '' : `<div class="seg five" id="typeSeg">${['expense', 'income', 'transfer', 'lend', 'borrow'].map((k) => `<button type="button" class="${k === type ? 'on' : ''}" data-type="${k}">${TYPE_LABEL[k]}</button>`).join('')}</div>`}
    <div class="amount"><span class="cur">৳</span><input id="amt" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="done" value="${esc(vals.amount)}"></div>
    <div class="amount-hint" id="amtHint"></div>
    <div id="body">${body()}</div>
    <div class="field"><label for="note">Note</label><input class="input" id="note" placeholder="${noteHint[type]}" autocomplete="off" enterkeyhint="done" value="${esc(vals.note)}"></div>
    <div class="field"><label for="date">Date</label><input class="input" type="date" id="date" value="${vals.date}"></div>
    <div class="quick"><button class="chip" type="button" data-day="0">Today</button><button class="chip" type="button" data-day="-1">Yesterday</button></div>
    <button class="btn primary block" id="saveTx">${isEdit ? 'Save changes' : 'Add ' + TYPE_LABEL[type].toLowerCase()}</button>
  `, (s) => {
    const amt = $('#amt', s), hint = $('#amtHint', s), note = $('#note', s), date = $('#date', s), save = $('#saveTx', s), bodyEl = $('#body', s);
    const refresh = () => {
      const v = parseAmount(amt.value);
      hint.innerHTML = isExpression(amt.value) && !isNaN(v) ? `= <b>${money(v)}</b>` : (amt.value && isNaN(v) ? 'Numbers only' : '');
      save.disabled = !(v > 0);
    };
    amt.addEventListener('input', refresh);
    refresh();

    bodyEl.addEventListener('click', (e) => {
      const c = e.target.closest('.cat-opt');
      if (c) { bodyEl.querySelectorAll('.cat-opt').forEach((x) => x.classList.toggle('on', x === c)); pick.category = c.dataset.cat; return; }
      if (e.target.closest('#doubtful')) { vals.doubtful = !vals.doubtful; e.target.closest('#doubtful').classList.toggle('on', vals.doubtful); return; }
      const ch = e.target.closest('.chip');
      if (ch) { const grp = ch.closest('[data-pick]'); grp.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === ch)); pick[grp.dataset.pick] = ch.dataset.val; }
    });
    bodyEl.addEventListener('input', (e) => { if (e.target.id === 'person') vals.person = e.target.value; });

    $('#typeSeg', s)?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-type]'); if (!b || b.dataset.type === type) return;
      type = b.dataset.type;
      s.querySelectorAll('#typeSeg button').forEach((x) => x.classList.toggle('on', x === b));
      $('#sheetTitle', s).textContent = 'New ' + TYPE_LABEL[type].toLowerCase();
      save.textContent = 'Add ' + TYPE_LABEL[type].toLowerCase();
      note.placeholder = noteHint[type];
      bodyEl.innerHTML = body();
    });

    s.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
      const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.day)); date.value = ymd(d);
    }));

    const submit = async () => {
      const v = parseAmount(amt.value);
      if (!(v > 0)) { amt.focus(); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { date.focus(); return; }
      const rec = { id: tx?.id || uid(), type, amount: v, note: note.value.trim(), date: date.value, createdAt: tx?.createdAt || Date.now(), updatedAt: Date.now() };
      if (type === 'expense') { rec.category = pick.category; rec.account = pick.account; }
      else if (type === 'income') rec.account = pick.account;
      else if (type === 'transfer') {
        if (pick.account === pick.toAccount) { toast('Pick two different accounts'); return; }
        rec.account = pick.account; rec.toAccount = pick.toAccount;
      } else {
        const p = ($('#person', s)?.value || '').trim();
        if (!p) { $('#person', s)?.focus(); return; }
        rec.person = p; rec.account = tx && tx.account === null ? null : pick.account;
        if (type === 'lend' && vals.doubtful) rec.doubtful = true;
      }
      await db.putExpense(rec);
      state.all = state.all.filter((e) => e.id !== rec.id).concat(rec);
      if (rec.category) localStorage.setItem('lastCat', rec.category);
      if (rec.account && type !== 'transfer') localStorage.setItem('lastAcc', rec.account);
      closeSheet();
      if (!isEdit && !rec.date.startsWith(state.month) && (state.view === 'home' || state.view === 'history')) state.month = rec.date.slice(0, 7);
      render();
      const msg = { expense: `${money(v)} on ${catById(rec.category).name}`, income: `${money(v)} into ${accById(rec.account).name}`, transfer: `${money(v)} moved to ${accById(rec.toAccount).name}`, lend: `${money(v)} lent to ${rec.person}`, repay: `${rec.person} paid back ${money(v)}`, borrow: `Borrowed ${money(v)} from ${rec.person}`, settle: `Paid ${rec.person} back ${money(v)}` };
      toast(isEdit ? 'Saved' : msg[type]);
    };
    save.addEventListener('click', submit);
    [amt, note].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }));
    s.querySelector('[data-sheet="close"]')?.addEventListener('click', closeSheet);
    s.querySelector('[data-sheet="delete"]')?.addEventListener('click', () => { closeSheet(); deleteTx(tx.id); });
    if (!isEdit && !preset.person) amt.focus();
  });
}

function openOverrideSheet(kind) {
  const rows = state.settings[kind];
  const ov = state.overrides[state.month]?.[kind] || {};
  const title = kind === 'incomes' ? 'Income' : 'Fixed outflows';
  openSheet(`
    <div class="sheet-head"><h2>${title} · ${monthLabel(state.month, { month: 'short', year: 'numeric' })}</h2><button class="icon-btn" data-sheet="close" aria-label="Close">${ICON.x}</button></div>
    <p class="sheet-sub">Only for this month. Defaults live in Settings.</p>
    ${rows.length ? rows.map((r) => `
      <div class="field"><label>${esc(r.name)}</label><input class="input num" inputmode="decimal" data-id="${r.id}" value="${ov[r.id] ?? r.amount}"></div>`).join('')
    : `<div class="empty">Nothing set up yet. Add sources in Settings.</div>`}
    <div class="row" style="margin-top:18px">
      <button class="btn" data-sheet="reset">Use defaults</button>
      <button class="btn primary" data-sheet="save">Save</button>
    </div>
  `, (s) => {
    s.querySelector('[data-sheet="close"]').addEventListener('click', closeSheet);
    s.querySelector('[data-sheet="reset"]').addEventListener('click', async () => {
      await setOverride(kind, null); closeSheet(); render(); toast('Back to defaults');
    });
    s.querySelector('[data-sheet="save"]').addEventListener('click', async () => {
      const map = {};
      s.querySelectorAll('input[data-id]').forEach((i) => {
        const def = rows.find((r) => r.id === i.dataset.id);
        const v = parseAmount(i.value);
        if (!isNaN(v) && v !== Number(def.amount)) map[i.dataset.id] = v;
      });
      await setOverride(kind, Object.keys(map).length ? map : null);
      closeSheet(); render(); toast(`${title} updated for ${monthLabel(state.month, { month: 'long' })}`);
    });
  });
}

async function setOverride(kind, map) {
  const cur = { ...(state.overrides[state.month] || {}) };
  if (map) cur[kind] = map; else delete cur[kind];
  if (Object.keys(cur).length) { state.overrides[state.month] = cur; await db.kvSet('month:' + state.month, cur); }
  else { delete state.overrides[state.month]; await db.kvDel('month:' + state.month); }
}

function openRoutineSheet(r) {
  const isEdit = !!r;
  const pick = { category: r?.category || cats()[0]?.id, account: r?.account || accounts()[0]?.id, mode: r?.mode || 'tap', days: r?.days || 'all' };
  const seg = (name, opts) => `<div class="seg two" data-pick="${name}">${opts.map(([v, l]) => `<button type="button" class="${pick[name] === v ? 'on' : ''}" data-val="${v}">${l}</button>`).join('')}</div>`;
  openSheet(`
    <div class="sheet-head"><h2>${isEdit ? 'Edit routine' : 'New routine'}</h2><button class="icon-btn" data-sheet="close" aria-label="Close">${ICON.x}</button></div>
    <div class="row">
      <div class="field"><label for="rName">Name</label><input class="input" id="rName" placeholder="Lunch" autocomplete="off" value="${esc(r?.name || '')}"></div>
      <div class="field" style="flex:0 0 130px"><label for="rAmt">Amount</label><input class="input num" id="rAmt" inputmode="decimal" placeholder="0" value="${r ? r.amount : ''}"></div>
    </div>
    <div class="field"><label>Category</label>
      <div class="cat-grid" id="rCats">${cats().map((c) => `<button class="cat-opt${c.id === pick.category ? ' on' : ''}" data-cat="${c.id}" type="button"><span class="e" style="color:${catColor(c.id)}">${icon(c.icon)}</span>${esc(c.name)}</button>`).join('')}</div>
    </div>
    ${accChips('account', pick.account, 'Paid from')}
    <div class="field"><label>How</label>${seg('mode', [['tap', 'One tap on Home'], ['auto', 'Automatic']])}</div>
    <div class="field"><label>Which days</label>${seg('days', [['all', 'Every day'], ['weekdays', 'Sun\u2013Thu']])}</div>
    <p class="help">Automatic items are logged every matching day when you open the app (up to a week back). You can still edit or delete any of them.</p>
    <button class="btn primary block" data-sheet="save">${isEdit ? 'Save routine' : 'Add routine'}</button>
  `, (s) => {
    s.querySelector('[data-sheet="close"]').addEventListener('click', closeSheet);
    s.addEventListener('click', (e) => {
      const c = e.target.closest('.cat-opt');
      if (c) { s.querySelectorAll('.cat-opt').forEach((x) => x.classList.toggle('on', x === c)); pick.category = c.dataset.cat; return; }
      const b = e.target.closest('[data-pick] [data-val]');
      if (b) { const grp = b.closest('[data-pick]'); grp.querySelectorAll('[data-val]').forEach((x) => x.classList.toggle('on', x === b)); pick[grp.dataset.pick] = b.dataset.val; }
    });
    s.querySelector('[data-sheet="save"]').addEventListener('click', async () => {
      const name = $('#rName', s).value.trim();
      const amount = parseAmount($('#rAmt', s).value);
      if (!name) { $('#rName', s).focus(); return; }
      if (!(amount > 0)) { $('#rAmt', s).focus(); return; }
      const rec = { id: r?.id || uid(), name, amount, category: pick.category, account: pick.account, mode: pick.mode, days: pick.days, since: r?.since || todayStr() };
      if (isEdit) state.settings.routines = routines().map((x) => (x.id === rec.id ? rec : x)); else state.settings.routines.push(rec);
      await saveSettings();
      const n = await applyAutoRoutines();
      closeSheet(); render();
      toast(isEdit ? 'Routine saved' : `${name} added${n ? ' \u00b7 logged for today' : ''}`);
    });
    if (!isEdit) $('#rName', s).focus();
  });
}

async function logRoutine(r, date) {
  const rec = { id: uid(), type: 'expense', amount: r.amount, category: r.category, account: r.account, note: r.name, date, routineId: r.id, createdAt: Date.now(), updatedAt: Date.now() };
  await db.putExpense(rec);
  state.all.push(rec);
  return rec;
}

// Logs automatic routines for every matching day since they were created (max 7 days back). Returns how many were added.
async function applyAutoRoutines() {
  const today = todayStr();
  const added = [];
  for (const r of routines().filter((x) => x.mode === 'auto')) {
    const from = r.since > addDays(today, -6) ? r.since : addDays(today, -6);
    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (!routineRuns(d)(r)) continue;
      if (state.all.some((e) => e.routineId === r.id && e.date === d)) continue;
      added.push({ id: uid(), type: 'expense', amount: r.amount, category: r.category, account: r.account, note: r.name, date: d, routineId: r.id, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  if (added.length) { await db.bulkPutExpenses(added); state.all.push(...added); }
  return added.length;
}

const iconGrid = (sel) => `<div class="icon-grid">${ICON_NAMES.map((n) => `<button class="icon-opt${n === sel ? ' on' : ''}" type="button" data-icon="${n}" aria-label="${n}">${icon(n)}</button>`).join('')}</div>`;
function bindIconGrid(s, pick) {
  s.querySelector('.icon-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.icon-opt'); if (!b) return;
    s.querySelectorAll('.icon-opt').forEach((x) => x.classList.toggle('on', x === b));
    pick(b.dataset.icon);
  });
}

function openCatSheet() {
  let sel = 'tag';
  openSheet(`
    <div class="sheet-head"><h2>New category</h2><button class="icon-btn" data-sheet="close" aria-label="Close">${ICON.x}</button></div>
    <div class="field"><label for="cName">Name</label><input class="input" id="cName" placeholder="Gifts" autocomplete="off" enterkeyhint="done"></div>
    <div class="field"><label>Icon</label>${iconGrid(sel)}</div>
    <button class="btn primary block" data-sheet="save">Add category</button>
  `, (s) => {
    s.querySelector('[data-sheet="close"]').addEventListener('click', closeSheet);
    bindIconGrid(s, (n) => { sel = n; });
    const save = async () => {
      const name = $('#cName', s).value.trim();
      if (!name) { $('#cName', s).focus(); return; }
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid();
      if (cats().some((c) => c.id === id)) { toast('That category already exists'); return; }
      state.settings.categories.push({ id, name, icon: sel });
      await saveSettings(); closeSheet(); render(); toast(`${name} added`);
    };
    s.querySelector('[data-sheet="save"]').addEventListener('click', save);
    $('#cName', s).addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    $('#cName', s).focus();
  });
}

function openIconPicker(kind, id) {
  const row = state.settings[kind].find((r) => r.id === id);
  if (!row) return;
  openSheet(`
    <div class="sheet-head"><h2>Icon for ${esc(row.name || 'item')}</h2><button class="icon-btn" data-sheet="close" aria-label="Close">${ICON.x}</button></div>
    ${iconGrid(row.icon)}
  `, (s) => {
    s.querySelector('[data-sheet="close"]').addEventListener('click', closeSheet);
    bindIconGrid(s, async (n) => { row.icon = n; await saveSettings(); closeSheet(); renderSettings(); });
  });
}

/* ---------------- Actions ---------------- */
async function deleteTx(id) {
  const tx = state.all.find((e) => e.id === id);
  if (!tx) return;
  state.all = state.all.filter((e) => e.id !== id);
  await db.deleteExpense(id);
  render();
  toast('Deleted', { action: 'Undo', onAction: async () => { state.all.push(tx); await db.putExpense(tx); render(); } });
}

const saveSettings = () => db.kvSet('settings', state.settings);
const saveSettingsDebounced = debounce(saveSettings, 400);

async function exportData() {
  const kv = await db.kvAll();
  const overrides = Object.fromEntries(Object.entries(kv).filter(([k]) => k.startsWith('month:')).map(([k, v]) => [k.slice(6), v]));
  const payload = { app: 'khoroch', version: 2, exportedAt: new Date().toISOString(), settings: state.settings, overrides, transactions: [...state.all].sort(sortTx) };
  const json = JSON.stringify(payload, null, 2);
  const name = `khoroch-${todayStr()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Khoroch backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    const rows = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data?.expenses) ? data.expenses : null;
    if (!rows) throw new Error('bad');
    const clean = rows.filter((e) => e && e.id && typeof e.amount === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''));
    await db.bulkPutExpenses(clean);
    const ids = new Set(clean.map((e) => e.id));
    state.all = state.all.filter((e) => !ids.has(e.id)).concat(clean);
    if (data.settings && Array.isArray(data.settings.categories)) { state.settings = normalizeSettings(data.settings); await saveSettings(); applyTheme(); }
    if (data.overrides && typeof data.overrides === 'object') {
      for (const [m, v] of Object.entries(data.overrides)) { state.overrides[m] = v; await db.kvSet('month:' + m, v); }
    }
    render();
    toast(`Imported ${clean.length} transaction${clean.length === 1 ? '' : 's'}`);
  } catch { toast('That file is not a Khoroch backup'); }
}

async function clearData() {
  if (!confirm('Delete every transaction and all settings on this device? This cannot be undone.')) return;
  await db.clearAll();
  state.all = []; state.overrides = {}; state.settings = normalizeSettings(null);
  localStorage.removeItem('lastCat'); localStorage.removeItem('lastAcc');
  applyTheme(); render(); toast('Everything deleted');
}

/* ---------------- Toast ---------------- */
let toastTimer, toastAction = null;
function toast(msg, opts = {}) {
  clearTimeout(toastTimer);
  toastAction = opts.onAction || null;
  el.toast.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<button id="toastAct">${esc(opts.action)}</button>` : ''}`;
  el.toast.classList.add('show');
  toastTimer = setTimeout(hideToast, opts.action ? 5000 : 2200);
}
function hideToast() { el.toast.classList.remove('show'); toastAction = null; }

/* ---------------- Theme ---------------- */
function applyTheme() {
  const t = ['dark', 'light', 'auto'].includes(state.settings.theme) ? state.settings.theme : 'dark';
  document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0d0d0d' : '#f9f9f7'));
}

/* ---------------- Events ---------------- */
function bind() {
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action],[data-tab]');
    if (!t || el.sheet.contains(t)) return;
    const a = t.dataset.action || 'tab';
    switch (a) {
      case 'tab': state.view = t.dataset.tab; render(); break;
      case 'prev-month': state.month = shiftMonth(state.month, -1); state.day = null; render(); break;
      case 'next-month': state.month = shiftMonth(state.month, 1); state.day = null; render(); break;
      case 'this-month': state.month = ym(new Date()); state.day = null; render(); break;
      case 'edit-tx': openTxSheet(state.all.find((x) => x.id === t.dataset.id)); break;
      case 'new-tx': openTxSheet(null, { type: t.dataset.type, person: t.dataset.person, amount: t.dataset.amount }); break;
      case 'edit-override': openOverrideSheet(t.dataset.kind); break;
      case 'filter': state.filter = t.dataset.f || null; renderHistory(); break;
      case 'pick-day': state.day = state.day === t.dataset.date ? null : t.dataset.date; renderHistoryList(); break;
      case 'clear-day': state.day = null; renderHistoryList(); break;
      case 'shift-day': {
        state.day = addDays(state.day, Number(t.dataset.n));
        if (!state.day.startsWith(state.month)) { state.month = state.day.slice(0, 7); render(); } else renderHistoryList();
        break;
      }
      case 'add-on-day': openTxSheet(null, { date: state.day }); break;
      case 'routine-tap': {
        const r = routineById(t.dataset.id); if (!r) break;
        const rec = await logRoutine(r, todayStr());
        state.month = ym(new Date()); state.day = null;
        render();
        toast(`${r.name} \u00b7 ${money(r.amount)} logged`, { action: 'Undo', onAction: async () => { state.all = state.all.filter((e) => e.id !== rec.id); await db.deleteExpense(rec.id); render(); } });
        break;
      }
      case 'add-routine': openRoutineSheet(null); break;
      case 'edit-routine': openRoutineSheet(routineById(t.dataset.id)); break;
      case 'remove-routine': {
        const r = routineById(t.dataset.id); if (!r) break;
        state.settings.routines = routines().filter((x) => x.id !== r.id);
        await saveSettings(); renderSettings(); toast(`${r.name} removed \u00b7 logged entries kept`);
        break;
      }
      case 'dismiss-hint': localStorage.setItem('hintDismissed', '1'); t.closest('.hint').remove(); break;
      case 'theme': state.settings.theme = t.dataset.theme; applyTheme(); await saveSettings(); renderSettings(); break;
      case 'add-row': {
        const k = t.dataset.kind;
        state.settings[k].push(k === 'accounts' ? { id: uid(), name: '', icon: 'wallet', opening: 0 } : { id: uid(), name: '', amount: 0 });
        await saveSettings(); renderSettings();
        const inputs = el.view.querySelectorAll(`[data-kind="${k}"][data-field="name"]`); inputs[inputs.length - 1]?.focus();
        break;
      }
      case 'remove-row': state.settings[t.dataset.kind] = state.settings[t.dataset.kind].filter((r) => r.id !== t.dataset.id); await saveSettings(); renderSettings(); break;
      case 'add-cat': openCatSheet(); break;
      case 'pick-icon': openIconPicker(t.dataset.kind, t.dataset.id); break;
      case 'remove-cat': {
        const id = t.dataset.id;
        if (cats().length <= 1) { toast('Keep at least one category'); break; }
        const name = catById(id).name;
        state.settings.categories = cats().filter((c) => c.id !== id);
        const fallback = cats().find((c) => c.id === 'other')?.id || cats()[0].id;
        const moved = state.all.filter((x) => txType(x) === 'expense' && x.category === id).map((x) => ({ ...x, category: fallback }));
        if (moved.length) { await db.bulkPutExpenses(moved); const ids = new Set(moved.map((m) => m.id)); state.all = state.all.filter((x) => !ids.has(x.id)).concat(moved); }
        await saveSettings(); renderSettings(); toast(`${name} removed${moved.length ? ` · ${moved.length} moved to ${catById(fallback).name}` : ''}`);
        break;
      }
      case 'export': exportData(); break;
      case 'import': el.importFile.value = ''; el.importFile.click(); break;
      case 'clear': clearData(); break;
    }
  });

  document.addEventListener('input', (e) => {
    const i = e.target;
    if (i.id === 'search') { state.search = i.value; renderHistoryList(); return; }
    if (i.dataset.kind && i.dataset.field && !el.sheet.contains(i)) {
      const row = state.settings[i.dataset.kind].find((r) => r.id === i.dataset.id);
      if (!row) return;
      const f = i.dataset.field;
      row[f] = (f === 'amount' || f === 'opening') ? (parseAmount(i.value) || 0) : i.value;
      saveSettingsDebounced();
    }
  });

  el.fab.addEventListener('click', () => openTxSheet(null));
  el.backdrop.addEventListener('click', closeSheet);
  el.importFile.addEventListener('change', () => { if (el.importFile.files[0]) importData(el.importFile.files[0]); });
  el.toast.addEventListener('click', (e) => { if (e.target.id === 'toastAct' && toastAction) { const f = toastAction; hideToast(); f(); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
    if (e.key === 'n' && !sheetOpen && !/input|textarea/i.test(document.activeElement?.tagName || '')) openTxSheet(null);
  });

  // Drag the sheet down to dismiss.
  let startY = null, dy = 0;
  el.sheet.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.handle, .sheet-head') || e.target.closest('button')) return;
    startY = e.clientY; dy = 0; el.sheet.classList.add('dragging'); el.sheet.setPointerCapture(e.pointerId);
  });
  el.sheet.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    el.sheet.style.transform = `translateY(${dy}px)`;
  });
  const endDrag = () => {
    if (startY == null) return;
    el.sheet.classList.remove('dragging');
    startY = null;
    if (dy > 90) closeSheet(); else el.sheet.style.transform = '';
  };
  el.sheet.addEventListener('pointerup', endDrag);
  el.sheet.addEventListener('pointercancel', endDrag);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  document.addEventListener('visibilitychange', async () => { if (document.hidden || sheetOpen) return; const n = await applyAutoRoutines().catch(() => 0); render(); if (n) toast(`${n} routine item${n === 1 ? '' : 's'} logged automatically`); });
}

/* ---------------- Boot ---------------- */
function normalizeSettings(saved) {
  const base = JSON.parse(JSON.stringify(DEFAULTS));
  const s = { ...base, ...(saved || {}) };
  for (const k of ['incomes', 'fixed', 'categories', 'accounts', 'routines']) if (!Array.isArray(s[k])) s[k] = base[k];
  if (saved && !s.categories.some((c) => c.fixed)) s.categories.push(base.categories.find((c) => c.fixed));
  const byId = { bank: 'bank', bkash: 'smartphone', card: 'card', dps: 'piggy', nagad: 'smartphone', ...Object.fromEntries([...base.categories, ...base.accounts].map((x) => [x.id, x.icon])) };
  for (const c of s.categories) { if (!c.icon) c.icon = byId[c.id] || 'tag'; delete c.emoji; }
  for (const a of s.accounts) { if (!a.icon) a.icon = byId[a.id] || 'wallet'; delete a.emoji; }
  return s;
}

async function init() {
  await loadPersonal().catch(() => {});
  try {
    const saved = await db.kvGet('settings');
    state.settings = normalizeSettings(saved);
    state.all = await db.getAllExpenses();
    if (!saved && state.all.length === 0) {
      await db.bulkPutExpenses(FIRST_RUN_TX);
      await saveSettings();
      state.all = [...FIRST_RUN_TX];
    }
    const kv = await db.kvAll();
    for (const [k, v] of Object.entries(kv)) if (k.startsWith('month:')) state.overrides[k.slice(6)] = v;
  } catch (err) {
    console.error(err);
    state.settings = normalizeSettings(null);
    toast('Storage unavailable. Data will not be saved.');
  }
  applyTheme();
  bind();
  const n = await applyAutoRoutines().catch(() => 0);
  const hash = location.hash.slice(1);
  if (['home', 'history', 'accounts', 'settings'].includes(hash)) state.view = hash;
  render();
  if (hash === 'add') openTxSheet(null);
  if (n) toast(`${n} routine item${n === 1 ? '' : 's'} logged automatically`);
  if ('serviceWorker' in navigator) {
    // Reload once when a newer version takes over, so changes show up on the next launch without a double reload.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js').then((reg) => reg.update()).catch(() => {});
  }
}
init();
