// ---------- dynamic input (floor plans) ----------
// While a floor plan command waits for a point, a box beside the cursor shows the command prompt and the values the
// next click would give: X and Y for a first point, length and angle for the next point, width and height for a
// rectangle or room, a radius, an angle or a number when the command asks for one. Typing goes into the active value;
// Tab locks it (the cursor then moves only the free value) and moves to the next one; Enter accepts. A comma switches to
// X,Y entry (relative to the last point, or absolute when the first value starts with #). Down arrow lists the prompt's
// options. F12 or DYN in the status bar turns the input off; the box then only shows the values, and typing goes to
// the command line.
const DYN = { key: '', typed: ['', ''], locked: [null, null], act: 0, xy: false, abs: false, menu: -1, cx: 0, cy: 0, inside: false };
const dynOn = () => PREFS.dyn !== false;
function toggleDyn() { PREFS.dyn = !dynOn(); savePrefs(); dynReset(); renderStatus(); renderToolbar(); dynUpdate(); flash('Dynamic input ' + (dynOn() ? 'on' : 'off')); }
function dynReset() { DYN.typed = ['', '']; DYN.locked = [null, null]; DYN.act = 0; DYN.xy = false; DYN.abs = false; DYN.menu = -1; }

// ---------- what the command is asking for ----------
// fields: [{ k: kind, label }]. Kinds: x y (absolute), dx dy (relative), len, ang, w, h, dia, num, fac.
function dynCtx() {
  const aw = fpAwaiting(); if (!aw) return null;
  const pg = page(), lv = levelOf(pg); const last = aw.last || null;
  const F = (k, label) => ({ k, label });
  const pair = () => {
    if (DYN.xy) return [F(DYN.abs || !last ? 'x' : 'dx', 'X'), F(DYN.abs || !last ? 'y' : 'dy', 'Y')];
    if (!last) return [F('x', 'X'), F('y', 'Y')];
    return [F('len', 'Length'), F('ang', 'Angle')];
  };
  let fields;
  if (aw.kind === 'draw') {
    const D = DRAW;
    if (D.want === 'number') fields = [F('num', D.id === 'polygon' ? 'Sides' : 'Number')];
    else if (D.want === 'angle') fields = [F('ang', 'Angle')];
    else if (D.want === 'dist') fields = [F('len', dynDistLabel(D))];
    else if (!DYN.xy && last && D.T.pointKind && D.T.pointKind(D) === 'box') fields = [F('w', 'Width'), F('h', 'Height')];
    else fields = pair();
  } else if (aw.kind === 'grip') {
    const op = gripOp;
    if (op.wantBase) fields = [F('x', 'X'), F('y', 'Y')];
    else if (op.mode === 'rotate') fields = [F('ang', 'Angle')];
    else if (op.mode === 'scale') fields = [F('fac', 'Scale')];
    else fields = pair();
  } else if (aw.kind === 'box') fields = last && !DYN.xy ? [F('w', 'Width'), F('h', 'Height')] : pair();
  else if (aw.kind === 'circle') fields = last ? [F('dia', 'Diameter')] : pair();
  else fields = pair();
  return { aw, pg, lv, last, fields };
}
function dynDistLabel(D) {
  if (D.id === 'circle') return D.sub === 'cd' ? 'Diameter' : 'Radius';
  if (D.id === 'polygon' || D.stage === 'r' || D.stage === 'f') return 'Radius';
  if (D.id === 'ellipse') return 'Other axis';
  if (D.stage === 'ch' || D.stage === 'd1' || D.stage === 'd2') return 'Distance';
  if (D.stage === 'w0' || D.stage === 'w1') return 'Width';
  return 'Distance';
}
// live value of a field with the cursor at q: lengths in real millimetres, angles in degrees
function dynLive(c, f, q) {
  if (!q) return null;
  const real = v => toRealMm(c.lv, v), last = c.last;
  if (f.k === 'x' || f.k === 'y') { const r = planToReal(c.pg, q); return f.k === 'x' ? r[0] : r[1]; }
  if (!last) return null;
  if (f.k === 'dx') return real(q[0] - last[0]);
  if (f.k === 'dy') return real(last[1] - q[1]);
  if (f.k === 'w') return real(Math.abs(q[0] - last[0]));
  if (f.k === 'h') return real(Math.abs(q[1] - last[1]));
  if (f.k === 'dia') return real(2 * Math.max(Math.abs(q[0] - last[0]), Math.abs(q[1] - last[1])));
  if (f.k === 'ang') return ptDist(last, q) < 1e-6 ? 0 : ptAngle(last, q);
  if (f.k === 'fac') return gripOp ? ptDist(gripOp.base, q) / gripOp.ref : 1;
  if (f.k === 'num') return DRAW && DRAW.id === 'polygon' ? DRAW.n : null;
  if (f.k === 'len') {
    const D = DRAW && c.aw.kind === 'draw' ? DRAW : null;
    if (D && D.id === 'ellipse' && D.pts.length === 2) return real(D.T.other(D, q));
    const d = ptDist(last, q); return real(D && D.id === 'circle' && D.sub === 'cd' ? 2 * d : d);
  }
  return null;
}
const dynAngFmt = a => (Math.round(a * 10) / 10) + '°';
function dynFmt(f, v) {
  if (v == null || !isFinite(v)) return '';
  if (f.k === 'ang') return dynAngFmt(v);
  if (f.k === 'fac') return String(Math.round(v * 100) / 100);
  if (f.k === 'num') return String(v);
  return formatLength(v);
}
// a typed value as a number (real millimetres, degrees or a plain number), or null
function dynParse(f, t) {
  t = String(t || '').trim(); if (!t) return null;
  if (f.k === 'ang' || f.k === 'fac' || f.k === 'num') { const n = parseFloat(t.replace(/°$/, '')); return isFinite(n) ? n : null; }
  return parseLength(t.replace(/^[#@]/, ''));
}

// ---------- locked values steer the cursor ----------
function dynLock(p) {
  if (!dynOn() || (DYN.locked[0] == null && DYN.locked[1] == null)) return null;
  const c = dynCtx(); if (!c || c.fields.length < 2) return null;
  const [A, B] = c.fields, la = DYN.locked[0], lb = DYN.locked[1], last = c.last, P2 = v => toPlanMm(c.lv, v);
  if (A.k === 'len' && last) {
    const ang = lb != null ? lb : (ptDist(last, p) < 1e-6 ? 0 : ptAngle(last, p));
    let d = la != null ? P2(Math.abs(la)) : null;
    if (d == null) { const u = [Math.cos(ang * D2R), -Math.sin(ang * D2R)]; d = Math.max(0, (p[0] - last[0]) * u[0] + (p[1] - last[1]) * u[1]); }
    return rp(polarPt(last, d, ang));
  }
  if (A.k === 'w' && last) {
    const x = la != null ? last[0] + (p[0] >= last[0] ? 1 : -1) * P2(Math.abs(la)) : p[0];
    const y = lb != null ? last[1] + (p[1] >= last[1] ? 1 : -1) * P2(Math.abs(lb)) : p[1];
    return rp([x, y]);
  }
  if (A.k === 'x') { const r = planToReal(c.pg, p); return rp(realToPlan(c.pg, [la != null ? la : r[0], lb != null ? lb : r[1]])); }
  if (A.k === 'dx' && last) return rp([la != null ? last[0] + P2(la) : p[0], lb != null ? last[1] - P2(lb) : p[1]]);
  return null;
}

// ---------- the box beside the cursor ----------
function dynEl() {
  let el = $('#dyn');
  if (!el) {
    el = document.createElement('div'); el.id = 'dyn'; el.className = 'hidden'; document.body.appendChild(el);
    el.addEventListener('mousedown', e => { const it = e.target.closest('[data-dynopt]'); e.preventDefault(); e.stopPropagation(); if (it) dynPickOption(it.dataset.dynopt); });
  }
  return el;
}
// the options of a prompt: "Specify first corner [Fillet/Chamfer]" gives Fillet and Chamfer
function dynOptions() {
  const m = /\[([^\]]+)\]/.exec(fpPromptText()); if (!m) return [];
  return m[1].split('/').map(s => s.trim()).filter(Boolean);
}
const dynOptWord = o => /^\d-point$/i.test(o) ? o[0] + 'P' : o.split(/\s+/)[0].toUpperCase();
function dynPickOption(o) { DYN.menu = -1; dynReset(); fpTyped(dynOptWord(o)); cmdSync(); dynUpdate(); }
function dynUpdate(q) {
  const el = dynEl(); const c = P && isFloor(page()) ? dynCtx() : null;
  if (!c || (!DYN.inside && !DYN.typed.some(Boolean))) { el.className = 'hidden'; if (!c) { DYN.key = ''; dynReset(); } return; }
  const key = [c.aw.kind, c.last ? c.last.join(',') : '', DRAW ? [DRAW.id, DRAW.stage, DRAW.pts.length, DRAW.want].join(':') : '', gripOp ? gripOp.mode + (gripOp.wantBase ? 'b' : '') : ''].join('|');
  if (key !== DYN.key) { DYN.key = key; dynReset(); }
  q = q || fAim;
  const on = dynOn(); const opts = on ? dynOptions() : [];
  const cells = c.fields.map((f, i) => {
    const typed = DYN.typed[i], lock = DYN.locked[i] != null, live = dynFmt(f, dynLive(c, f, q));
    const val = typed || (lock ? dynFmt(f, DYN.locked[i]) : live);
    const cls = 'dynf' + (on && i === DYN.act ? ' act' : '') + (typed ? ' typed' : '') + (lock ? ' lock' : '');
    return `<span class="${cls}" data-dynf="${i}"><i>${esc(f.label)}</i><b>${esc(val)}${on && i === DYN.act && !lock ? '<u></u>' : ''}</b>${lock ? '<svg viewBox="0 0 10 12" class="dynlock"><rect x="1" y="5" width="8" height="6" rx="1"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none"/></svg>' : ''}</span>`;
  }).join('');
  let html = '';
  if (on) html += `<div class="dynp">${esc(fpPromptText().replace(/^[A-Z ]+: /, ''))}${opts.length ? ' <span class="dynarr" title="Down arrow for options">&#9662;</span>' : ''}</div>`;
  html += `<div class="dynrow">${cells}</div>`;
  if (on && DYN.menu >= 0 && opts.length) html += `<div class="dynmenu">${opts.map((o, i) => `<div class="dynopt${i === DYN.menu ? ' on' : ''}" data-dynopt="${esc(o)}">${esc(o)}</div>`).join('')}</div>`;
  el.innerHTML = html;
  el.className = (on ? '' : 'ro ') + (sheetDark() ? 'dk' : '');
  const w = el.offsetWidth || 200, h = el.offsetHeight || 40;
  let x = DYN.cx + 18, y = DYN.cy + 20;
  if (x + w > window.innerWidth - 4) x = DYN.cx - w - 12;
  if (y + h > window.innerHeight - 4) y = DYN.cy - h - 12;
  el.style.left = Math.max(2, x) + 'px'; el.style.top = Math.max(2, y) + 'px';
}

// ---------- keys ----------
// returns true when the key was used by dynamic input
function dynKey(e) {
  if (!dynOn() || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (!P || !isFloor(page())) return false;
  const c = dynCtx(); if (!c) return false;
  const k = e.key, n = c.fields.length, typedAny = DYN.typed.some(Boolean) || DYN.locked.some(v => v != null);
  const opts = dynOptions();
  const done = () => { e.preventDefault(); e.stopPropagation(); dynUpdate(); return true; };
  if (DYN.menu >= 0) {
    if (k === 'ArrowDown') { DYN.menu = (DYN.menu + 1) % opts.length; return done(); }
    if (k === 'ArrowUp') { DYN.menu = (DYN.menu + opts.length - 1) % opts.length; return done(); }
    if (k === 'Enter') { const o = opts[DYN.menu]; e.preventDefault(); e.stopPropagation(); if (o) dynPickOption(o); return true; }
    if (k === 'Escape') { DYN.menu = -1; return done(); }
    DYN.menu = -1;
  }
  if (k === 'ArrowDown' && opts.length && !DYN.typed[DYN.act]) { DYN.menu = 0; return done(); }
  const letters = !!(DRAW || gripOp || c.aw.kind === 'poly');
  if (k.length === 1 && (/^[0-9.'"@#<\-\/]$/.test(k) || (letters && /^[a-z]$/i.test(k)) || (k === ' ' && DYN.typed[DYN.act]))) {
    if (k === '#' && !DYN.typed[DYN.act] && DYN.act === 0 && n === 2) DYN.abs = true;
    DYN.typed[DYN.act] += k; DYN.locked[DYN.act] = null; return done();
  }
  if (k === ',') {
    if (n === 2 && DYN.act === 0 && DYN.typed[0]) {
      DYN.abs = DYN.abs || DYN.typed[0].trim()[0] === '#'; DYN.xy = true; DYN.typed[0] = DYN.typed[0].replace(/^[#@]/, ''); DYN.typed[1] = ''; DYN.locked = [null, null]; DYN.act = 1; return done();
    }
    DYN.typed[DYN.act] += ','; return done();
  }
  if (k === 'Backspace') { if (DYN.typed[DYN.act]) { DYN.typed[DYN.act] = DYN.typed[DYN.act].slice(0, -1); return done(); } if (DYN.locked[DYN.act] != null) { DYN.locked[DYN.act] = null; return done(); } return false; }
  if (k === 'Tab') {
    if (n < 2) { e.preventDefault(); return true; }
    const f = c.fields[DYN.act], t = DYN.typed[DYN.act];
    if (t) { const v = dynParse(f, t); if (v == null) { flash(`Could not read "${t}"`); return done(); } DYN.locked[DYN.act] = v; DYN.typed[DYN.act] = ''; }
    DYN.act = (DYN.act + 1) % n; return done();
  }
  if (k === 'Enter') { if (!typedAny) return false; e.preventDefault(); e.stopPropagation(); dynSubmit(c); return true; }
  if (k === 'Escape') { if (!typedAny) return false; dynReset(); return done(); }
  return false;
}
// builds the typed text the command understands and sends it
function dynText(c) {
  const t = DYN.typed.map(x => String(x || '').trim()), L = DYN.locked, f = c.fields;
  const has = i => !!t[i] || L[i] != null;
  // a single value, an option word or full syntax goes as typed
  if (f.length === 1) return t[0] || (L[0] != null ? dynFmt(f[0], L[0]) : '');
  if (t[0] && (/^[a-z]/i.test(t[0]) || /^[@#]/.test(t[0]) || /[<,]/.test(t[0]) || (f[0].k === 'len' && !has(1)))) return t[0];
  const q = fAim; const val = i => { const v = t[i] ? dynParse(f[i], t[i]) : L[i] != null ? L[i] : dynLive(c, f[i], q); return v; };
  const a = val(0), b = val(1); if (a == null || b == null) return t[0] || t[1] || '';
  const len = v => formatLength(v, null, { den: 256, dec: 3 });
  if (f[0].k === 'len') return `${len(Math.abs(a))}<${r2(b * 1000) / 1000}`;
  if (f[0].k === 'w') return `${len(Math.abs(a))},${len(Math.abs(b))}`;
  if (f[0].k === 'x') return `#${len(a)},${len(b)}`;
  if (f[0].k === 'dx') return `@${len(a)},${len(b)}`;
  return t[0];
}
function dynSubmit(c) {
  const text = dynText(c); dynReset(); DYN.key = '';
  if (text) fpTyped(text);
  cmdSync(); dynUpdate();
}

// ---------- wiring ----------
ACTIONS.toggleDyn = toggleDyn;
svg.addEventListener('mousemove', e => { DYN.cx = e.clientX; DYN.cy = e.clientY; DYN.inside = true; });
svg.addEventListener('mouseleave', () => { DYN.inside = false; if (!DYN.typed.some(Boolean)) dynEl().className = 'hidden'; });
