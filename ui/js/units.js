// ---------- units, lengths and drawing scale (floor plans) ----------
// Floor plan geometry is stored in sheet millimetres ("plan units"). A level's scale is the ratio of real size to
// drawn size (48 means 1/4" = 1'). Real lengths are always handled in millimetres, and shown in the project's units.
const IN_MM = 25.4;
const SCALE_IMPERIAL = [['1/8" = 1\'', 96], ['3/16" = 1\'', 64], ['1/4" = 1\'', 48], ['3/8" = 1\'', 32], ['1/2" = 1\'', 24], ['3/4" = 1\'', 16], ['1" = 1\'', 12], ['1 1/2" = 1\'', 8], ['3" = 1\'', 4]];
const SCALE_METRIC = [['1:20', 20], ['1:25', 25], ['1:50', 50], ['1:75', 75], ['1:100', 100], ['1:200', 200]];
const unitsOf = () => (P && P.units) === 'metric' ? 'metric' : 'imperial';
const defaultScale = u => (u || unitsOf()) === 'metric' ? 50 : 48;
const lvScale = lv => (lv && lv.scale > 0) ? lv.scale : defaultScale();
const toRealMm = (lv, planMm) => planMm * lvScale(lv);
const toPlanMm = (lv, realMm) => realMm / lvScale(lv);

// Parses a typed length into millimetres, or returns null. Accepts 12'6", 12' 6 1/2", 12'-6", 150", 6 1/2", 1/2",
// 12', 12ft 6in, 3.5 m, 30 cm, 300 mm. A bare number uses def ('in' for imperial projects, 'mm' for metric ones).
function parseLength(str, units, def) {
  let s = String(str == null ? '' : str).toLowerCase().replace(/[′’`]/g, "'").replace(/[″”]/g, '"').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  units = units || unitsOf(); def = def || (units === 'metric' ? 'mm' : 'in');
  let sign = 1; if (s[0] === '-') { sign = -1; s = s.slice(1).trim(); } else if (s[0] === '+') s = s.slice(1).trim();
  let m = /^(\d*\.?\d+)\s*(mm|cm|m)$/.exec(s);
  if (m) return sign * parseFloat(m[1]) * { mm: 1, cm: 10, m: 1000 }[m[2]];
  const inches = t => {
    t = t.trim(); if (!t) return 0;
    const r = /^(?:(\d*\.?\d+)\s*)?(?:(\d+)\s*\/\s*(\d+))?\s*(?:"|in|inch|inches)?$/.exec(t);
    if (!r || (r[1] == null && r[2] == null)) return null;
    if (r[3] !== undefined && +r[3] === 0) return null;
    return (r[1] ? parseFloat(r[1]) : 0) + (r[2] ? +r[2] / +r[3] : 0);
  };
  m = /^(\d*\.?\d+)\s*(?:'|ft|feet|foot)\s*-?\s*(.*)$/.exec(s);
  if (m) { const i = inches(m[2]); return i == null ? null : sign * (parseFloat(m[1]) * 12 + i) * IN_MM; }
  if (/["']|in|inch|\//.test(s)) { const i = inches(s); return i == null ? null : sign * i * IN_MM; }
  m = /^(\d*\.?\d+)$/.exec(s);
  if (m) { const v = parseFloat(m[1]); return sign * v * { in: IN_MM, ft: 12 * IN_MM, mm: 1, cm: 10, m: 1000 }[def]; }
  return null;
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
// Formats millimetres for display: 12'-6 1/2" in imperial projects, 3.75 m or 450 mm in metric ones.
function formatLength(mm, units, o = {}) {
  units = units || unitsOf();
  if (!isFinite(mm)) return '';
  if (units === 'metric') {
    const a = Math.abs(mm); const sg = mm < 0 && Math.round(a) ? '-' : '';
    return a >= 1000 ? sg + (+(a / 1000).toFixed(3)) + ' m' : sg + (+a.toFixed(o.dec == null ? 1 : o.dec)) + ' mm';
  }
  const den = o.den || (P && P.prec) || 16;
  let n = Math.round(Math.abs(mm) / IN_MM * den); const sg = mm < 0 && n ? '-' : '';
  const whole = Math.floor(n / den), fr = n % den; const g = fr ? gcd(fr, den) : 1;
  const ft = Math.floor(whole / 12), inch = whole % 12;
  const frac = fr ? ` ${fr / g}/${den / g}` : '';
  if (ft) return `${sg}${ft}'-${inch}${frac}"`;
  return `${sg}${inch || !fr ? inch : ''}${frac}"`.replace(/^(-?) /, '$1');
}
// area in the project's units: sq ft or m2
function formatArea(mm2, units) {
  units = units || unitsOf();
  return units === 'metric' ? (+(mm2 / 1e6).toFixed(2)) + ' m²' : Math.round(mm2 / (IN_MM * IN_MM * 144)) + ' sq ft';
}

// ---------- drawing scale ----------
// "1/4\" = 1'" or "1:50" or "1/4 = 1" (left side drawn, right side real); returns the ratio or null.
function parseScale(str) {
  const s = String(str || '').trim(); if (!s) return null;
  let m = /^1\s*:\s*(\d*\.?\d+)$/.exec(s); if (m) return +m[1] > 0 ? +m[1] : null;
  m = /^(.+?)\s*=\s*(.+)$/.exec(s);
  if (m) {
    const a = parseLength(m[1], 'imperial', 'in'), b = parseLength(m[2], 'imperial', 'ft');
    if (a && b && a > 0 && b > 0) return Math.round(b / a * 1000) / 1000;
    return null;
  }
  m = /^(\d*\.?\d+)$/.exec(s); return m && +m[1] > 0 ? +m[1] : null;
}
function formatScale(ratio, units) {
  units = units || unitsOf();
  const list = units === 'metric' ? SCALE_METRIC : SCALE_IMPERIAL;
  const hit = list.find(x => Math.abs(x[1] - ratio) < 0.01) || SCALE_IMPERIAL.find(x => Math.abs(x[1] - ratio) < 0.01);
  if (hit) return hit[0];
  return '1:' + (+ratio.toFixed(2));
}
const scaleOptions = units => (units === 'metric' ? SCALE_METRIC : SCALE_IMPERIAL);

// ---------- real coordinates on a floor plan ----------
// Typed and displayed coordinates have their origin at the lower left corner of the page's drawing area, Y up.
const fpOrigin = () => [DA.x0, DA.y1];
function planToReal(pg, p) { const lv = levelOf(pg), o = fpOrigin(); return [toRealMm(lv, p[0] - o[0]), toRealMm(lv, o[1] - p[1])]; }
function realToPlan(pg, r) { const lv = levelOf(pg), o = fpOrigin(); return [o[0] + toPlanMm(lv, r[0]), o[1] - toPlanMm(lv, r[1])]; }
const fmtXY = (pg, p) => { const r = planToReal(pg, p); return `X ${formatLength(r[0])}  Y ${formatLength(r[1])}`; };

// ---------- changing units and scale ----------
function setUnits(u) {
  u = u === 'metric' ? 'metric' : 'imperial'; if (u === unitsOf()) return;
  const old = defaultScale(unitsOf());
  commit(() => { P.units = u; for (const lv of P.levels || []) if (Math.abs(lvScale(lv) - old) < 0.001) lv.scale = defaultScale(u); });
}
function setLevelScale(lv, ratio) { commit(() => { lv.scale = ratio; }); }
function scaleDlg(lv) {
  lv = lv || levelOf(page()); if (!lv) return;
  const cur = formatScale(lvScale(lv)); const opts = scaleOptions(unitsOf()).map(x => [x[0], x[0]]); if (!opts.some(o => o[0] === cur)) opts.unshift([cur, cur]);
  dialog('Drawing scale of ' + lv.name, [['scale', 'Scale', cur, 'select', opts], ['custom', 'Or type a scale', '']], v => {
    const r = parseScale(v.custom || v.scale); if (!r) { alert('Could not read that scale. Try 1/4" = 1\' or 1:50.'); return false; }
    setLevelScale(lv, r);
  }, 'OK', '<div class="note">The scale tells OpenSchem how big the drawing is in real life. Rooms keep their size on the page; their real size is the drawn size times the scale. Examples: 1/4" = 1\', 3/8" = 1\', 1:50.</div>');
}
