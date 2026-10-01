import { money, compact } from './util.js';

function niceCeil(v) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * Single-series column chart of daily spend for one month.
 * values: number[] (index 0 = day 1). todayDay: day number if month is current, else null.
 */
export function renderDaily(el, { values, todayDay, monthShort, onPick }) {
  const n = values.length;
  const W = 640, H = 180, padL = 40, padR = 8, padT = 22, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB, base = padT + ih;
  const lastDay = todayDay ?? n;
  const shown = values.slice(0, lastDay);
  const max = Math.max(0, ...shown);
  const top = niceCeil(max);
  const y = (v) => base - (v / top) * ih;
  const slot = iw / n;
  const bw = Math.max(2, Math.min(24, slot - 2));
  const cx = (i) => padL + i * slot + slot / 2;

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily spend">`;

  // gridlines + ticks (2 lines; baseline separate)
  for (const t of [top / 2, top]) {
    s += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>`;
    s += `<text class="tick" x="${padL - 8}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${compact(t)}</text>`;
  }
  s += `<line class="base" x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}"/>`;

  // bars
  let maxI = -1;
  shown.forEach((v, i) => {
    if (v > max - 1e-9 && v > 0 && maxI < 0) maxI = i;
    if (v <= 0) return;
    const x = cx(i) - bw / 2, yt = y(v), h = base - yt;
    const r = Math.min(4, bw / 2, h);
    s += `<path class="bar" data-i="${i}" d="M${x.toFixed(1)},${base} V${(yt + r).toFixed(1)} Q${x.toFixed(1)},${yt.toFixed(1)} ${(x + r).toFixed(1)},${yt.toFixed(1)} H${(x + bw - r).toFixed(1)} Q${(x + bw).toFixed(1)},${yt.toFixed(1)} ${(x + bw).toFixed(1)},${(yt + r).toFixed(1)} V${base} Z"/>`;
  });

  // single direct label: the peak day
  if (maxI >= 0) {
    s += `<text class="dlabel" x="${cx(maxI).toFixed(1)}" y="${(y(shown[maxI]) - 6).toFixed(1)}" text-anchor="middle">${compact(shown[maxI])}</text>`;
  }

  // x ticks
  const ticks = new Set([1, 5, 10, 15, 20, 25, 30].filter((d) => d <= n));
  if (todayDay) ticks.add(todayDay);
  for (const d of ticks) {
    if (todayDay && Math.abs(d - todayDay) < 2 && d !== todayDay) continue;
    s += `<text class="tick${d === todayDay ? ' today' : ''}" x="${cx(d - 1).toFixed(1)}" y="${base + 15}" text-anchor="middle">${d}</text>`;
  }

  // hit targets (full-height, whole slot) for hover/touch
  for (let i = 0; i < lastDay; i++) {
    s += `<rect class="hit" data-i="${i}" x="${(padL + i * slot).toFixed(1)}" y="${padT - 10}" width="${slot.toFixed(2)}" height="${ih + 10}"/>`;
  }
  s += '</svg><div class="chart-tip"></div>';
  el.innerHTML = s;

  const tip = el.querySelector('.chart-tip');
  const svg = el.querySelector('svg');
  let cur = null;
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    svg.querySelectorAll('.bar.hov').forEach((b) => b.classList.remove('hov'));
    if (i == null) { tip.classList.remove('show'); return; }
    const bar = svg.querySelector(`.bar[data-i="${i}"]`);
    if (bar) bar.classList.add('hov');
    const box = el.getBoundingClientRect();
    const sb = svg.getBoundingClientRect();
    const sx = sb.width / W, sy = sb.height / H;
    const px = sb.left - box.left + cx(i) * sx;
    const py = sb.top - box.top + y(values[i]) * sy;
    tip.innerHTML = `${i + 1} ${monthShort} · <b>${money(values[i])}</b>`;
    tip.style.left = px + 'px';
    tip.style.top = Math.max(py, 24) + 'px';
    tip.classList.add('show');
  };
  const pick = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const i = t && t.dataset && t.dataset.i != null ? Number(t.dataset.i) : null;
    show(i);
  };
  el.onpointermove = pick;
  el.onpointerdown = pick;
  el.onpointerleave = () => show(null);
  el.onclick = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (t && t.dataset && t.dataset.i != null && onPick) onPick(Number(t.dataset.i));
  };
}
