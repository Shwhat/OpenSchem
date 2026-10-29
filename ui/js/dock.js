// ---------- dockable panels and workspaces ----------
// Panels (Pages, Devices, Symbols, To-do, Properties) live in three dock areas (left, right, bottom) or float over the
// canvas. An area is a row of columns; a column is a stack of groups; a group holds panels as tabs. Drag a tab to move
// a panel: onto another group to tab it or split beside it, to a window edge to dock, or onto the canvas to float it.
// Floating windows stick to each other and to the docked panels, and join another panel when dropped on its tab bar.
// Layouts are saved as named workspaces in the user preferences (prefs.json).
const PANELS = {
  pages: { title: 'Pages', el: '#tab-pages', home: 'left' },
  devices: { title: 'Devices', el: '#tab-devices', home: 'left' },
  symbols: { title: 'Symbols', el: '#tab-symbols', home: 'left' },
  todo: { title: 'To-do', el: '#tab-todo', home: 'left' },
  props: { title: 'Properties', el: '#props', home: 'right' },
};
const PANEL_IDS = Object.keys(PANELS);
const PANEL_BADGE = {};
const DOCK_AREAS = ['left', 'right', 'bottom'];
const DOCK_SIZE = { left: 250, right: 270, bottom: 200 };
let DOCK = null, dockZ = 10;

const dG = (tabs, active, h = 1) => ({ h, tabs, active: active || tabs[0] });
const dC = (groups, w = 1) => ({ w, groups });
const dLayout = (left, right, bottom) => ({ left: { size: DOCK_SIZE.left, cols: left || [] }, right: { size: DOCK_SIZE.right, cols: right || [] }, bottom: { size: DOCK_SIZE.bottom, cols: bottom || [] }, floats: [] });
const DOCK_PRESETS = {
  'Schematic': () => dLayout([dC([dG(['pages', 'devices', 'symbols', 'todo'], 'pages')])], [dC([dG(['props'])])]),
  'Floor plan': () => dLayout([dC([dG(['symbols', 'devices'], 'symbols', 3), dG(['pages'], 'pages', 2)])], [dC([dG(['props'])])]),
  'Home wiring': () => dLayout([dC([dG(['pages'], 'pages', 2), dG(['devices', 'symbols'], 'devices', 3)])], [dC([dG(['props'], 'props', 3), dG(['todo'], 'todo', 1)])]),
  'Reports': () => dLayout([dC([dG(['pages', 'todo'], 'pages')])], [dC([dG(['props'])])]),
};
const PRESET_NAMES = Object.keys(DOCK_PRESETS);

// ---------- layout model ----------
function dockNormalize() {
  const seen = new Set();
  const cleanGroup = g => {
    g.tabs = (g.tabs || []).filter(id => PANELS[id] && !seen.has(id) && seen.add(id));
    if (!g.tabs.includes(g.active)) g.active = g.tabs[0];
    g.h = g.h > 0 ? g.h : 1; return g.tabs.length > 0;
  };
  for (const a of DOCK_AREAS) {
    const area = DOCK[a] = DOCK[a] || { size: DOCK_SIZE[a], cols: [] };
    area.size = area.size > 80 ? area.size : DOCK_SIZE[a];
    area.cols = (area.cols || []).filter(c => { c.w = c.w > 0 ? c.w : 1; c.groups = (c.groups || []).filter(cleanGroup); return c.groups.length > 0; });
  }
  DOCK.floats = (DOCK.floats || []).filter(f => { f.id = f.id || uid(); f.w = Math.max(180, +f.w || 320); f.h = Math.max(120, +f.h || 360); f.x = isFinite(f.x) ? f.x : 120; f.y = isFinite(f.y) ? f.y : 120; f.z = f.z || ++dockZ; f.h = f.h; return cleanGroup(f); });
}
// where a panel is: { group, area, ci, gi } or { group, float } or null when closed
function dockWhere(id) {
  for (const a of DOCK_AREAS) DOCK[a].cols.forEach((c, ci) => c.groups.forEach((g, gi) => { if (g.tabs.includes(id)) dockWhere.r = { group: g, area: a, ci, gi }; }));
  for (const f of DOCK.floats) if (f.tabs.includes(id)) dockWhere.r = { group: f, float: f };
  const r = dockWhere.r || null; dockWhere.r = null; return r;
}
const panelOpen = id => !!dockWhere(id);
function dockParent(group) {
  for (const a of DOCK_AREAS) for (let ci = 0; ci < DOCK[a].cols.length; ci++) { const gi = DOCK[a].cols[ci].groups.indexOf(group); if (gi >= 0) return { area: a, ci, gi }; }
  return null;
}
function dockRemove(id) {
  const w = dockWhere(id); if (!w) return;
  const g = w.group; g.tabs = g.tabs.filter(t => t !== id); if (g.active === id) g.active = g.tabs[0];
  if (g.tabs.length) return;
  if (w.float) DOCK.floats = DOCK.floats.filter(f => f !== g);
  else { const col = DOCK[w.area].cols[w.ci]; col.groups.splice(w.gi, 1); if (!col.groups.length) DOCK[w.area].cols.splice(w.ci, 1); }
}
// t: { t: 'tab', group } | { t: 'split', group, side } | { t: 'area', area } | { t: 'float', x, y }
function dockPlace(id, t) {
  if (t.t === 'tab') { t.group.tabs.push(id); t.group.active = id; return; }
  if (t.t === 'split') {
    const p = dockParent(t.group);
    if (!p) { t.group.tabs.push(id); t.group.active = id; return; }
    const col = DOCK[p.area].cols[p.ci], ng = dG([id], id, t.group.h);
    if (t.side === 'top' || t.side === 'bottom') col.groups.splice(p.gi + (t.side === 'bottom' ? 1 : 0), 0, ng);
    else DOCK[p.area].cols.splice(p.ci + (t.side === 'right' ? 1 : 0), 0, dC([ng], col.w));
    return;
  }
  if (t.t === 'area') {
    const a = DOCK[t.area]; if (!a.cols.length) a.size = DOCK_SIZE[t.area];
    const col = dC([dG([id], id)]); if (t.area === 'left') a.cols.unshift(col); else a.cols.push(col); return;
  }
  DOCK.floats.push({ id: uid(), x: t.x, y: t.y, w: 320, h: 380, z: ++dockZ, tabs: [id], active: id });
}
function dockMove(id, t) {
  if (t.group && t.group.tabs.length === 1 && t.group.tabs[0] === id && t.t !== 'float') return;
  if (t.t === 'tab' && t.group.tabs.includes(id)) { t.group.active = id; dockCommit(); return; }
  dockRemove(id); dockPlace(id, t); dockCommit();
}
function dockCommit() { dockNormalize(); PREFS.dock = clone(DOCK); savePrefs(); dockRender(); dockRefresh(); }
function dockRefresh() {
  if (!P) return;
  if (panelOpen('devices') && !$('#tab-devices').classList.contains('hidden')) renderDevices();
  renderTodo(); renderProps();
}

// ---------- rendering ----------
const dEl = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
const panelLabel = id => esc(PANELS[id].title) + (PANEL_BADGE[id] ? ` <span class="tcount">${PANEL_BADGE[id]}</span>` : '');
function dockGroupEl(g, floatWin) {
  const ge = dEl('dgroup'); ge._g = g;
  const tabs = dEl('dtabs');
  tabs.innerHTML = g.tabs.map(id => `<button type="button" class="tab${id === g.active ? ' active' : ''}" data-tab="${id}" data-dtab="${id}">${panelLabel(id)}${id === g.active ? `<span class="tabx" data-dclose="${id}" title="Close panel">×</span>` : ''}</button>`).join('');
  if (floatWin) { const gr = dEl('dgrip'); gr.title = 'Drag to move. Drop on another tab bar to join it. Alt: no snapping.'; tabs.appendChild(gr); }
  const body = dEl('dgbody');
  for (const id of g.tabs) { const el = $(PANELS[id].el); el.classList.toggle('hidden', id !== g.active); body.appendChild(el); }
  ge.append(tabs, body); return ge;
}
function dockRender() {
  const store = $('#dockstore');
  for (const id of PANEL_IDS) { const el = $(PANELS[id].el); el.classList.add('dpanel'); el.classList.add('hidden'); store.appendChild(el); }
  for (const a of DOCK_AREAS) {
    const area = DOCK[a], el = $('#dock-' + a); el.innerHTML = '';
    el.classList.toggle('hidden', !area.cols.length); if (!area.cols.length) continue;
    if (a === 'bottom') { el.style.height = area.size + 'px'; el.style.width = ''; } else { el.style.width = area.size + 'px'; el.style.height = ''; }
    area.cols.forEach((col, ci) => {
      if (ci) { const s = dEl('dsplit v'); s.dataset.split = `c:${a}:${ci}`; el.appendChild(s); }
      const ce = dEl('dcol'); ce.style.flex = `${col.w} 1 0`;
      col.groups.forEach((g, gi) => {
        if (gi) { const s = dEl('dsplit h'); s.dataset.split = `g:${a}:${ci}:${gi}`; ce.appendChild(s); }
        const ge = dockGroupEl(g); ge.style.flex = `${g.h} 1 0`; ce.appendChild(ge);
      });
      el.appendChild(ce);
    });
    const edge = dEl('dedge ' + a); edge.dataset.split = 'area:' + a; el.appendChild(edge);
  }
  const fl = $('#dockfloat'); fl.innerHTML = '';
  for (const f of DOCK.floats) {
    const fe = dEl('dfloat'); fe.dataset.fid = f.id;
    fe.style.cssText = `left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px;z-index:${f.z}`;
    fe.appendChild(dockGroupEl(f, true));
    for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) { const h = dEl('drs ' + d); h.dataset.rs = d; fe.appendChild(h); }
    fl.appendChild(fe);
  }
  requestAnimationFrame(() => { if (P && P.pages) applyView(); });
}
function dockActivate(id) {
  const w = dockWhere(id); if (!w) return;
  w.group.active = id; if (w.float) w.group.z = ++dockZ;
  PREFS.dock = clone(DOCK); savePrefs(); dockRender(); dockRefresh();
}
function showPanel(id) {
  if (!PANELS[id]) return;
  if (panelOpen(id)) { dockActivate(id); return; }
  const home = PANELS[id].home, a = DOCK[home];
  if (a.cols.length) { const g = a.cols[0].groups[0]; g.tabs.push(id); g.active = id; } else dockPlace(id, { t: 'area', area: home });
  dockCommit();
}
function closePanel(id) { if (!panelOpen(id)) return; dockRemove(id); dockCommit(); }
function togglePanel(id) { if (panelOpen(id)) closePanel(id); else showPanel(id); }

// ---------- mouse: tab clicks, tab drags, splitters, floating windows ----------
let dockDrag = null, dockSplit = null, dockWin = null, dockClickBlock = false;
document.addEventListener('click', e => {
  const x = e.target.closest('[data-dclose]'); if (x) { e.stopPropagation(); closePanel(x.dataset.dclose); return; }
  const t = e.target.closest('.tab[data-dtab]'); if (t) { if (dockClickBlock) { dockClickBlock = false; return; } dockActivate(t.dataset.dtab); }
}, true);
document.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const rs = e.target.closest('.drs');
  if (rs) { const fe = rs.closest('.dfloat'), f = DOCK.floats.find(x => x.id === fe.dataset.fid); if (f) { f.z = ++dockZ; fe.style.zIndex = f.z; dockWin = { f, fe, mode: 'resize', dir: rs.dataset.rs, sx: e.clientX, sy: e.clientY, o: { x: f.x, y: f.y, w: f.w, h: f.h } }; e.preventDefault(); } return; }
  const sp = e.target.closest('[data-split]');
  if (sp) { dockSplitStart(e, sp); e.preventDefault(); return; }
  const tab = e.target.closest('.tab[data-dtab]');
  if (tab && !e.target.closest('[data-dclose]')) { dockDrag = { id: tab.dataset.dtab, sx: e.clientX, sy: e.clientY, on: false }; return; }
  const bar = e.target.closest('.dfloat .dtabs');
  if (bar) { const fe = bar.closest('.dfloat'), f = DOCK.floats.find(x => x.id === fe.dataset.fid); if (f) { f.z = ++dockZ; fe.style.zIndex = f.z; dockWin = { f, fe, mode: 'move', sx: e.clientX, sy: e.clientY, o: { x: f.x, y: f.y } }; e.preventDefault(); } return; }
  const fe = e.target.closest('.dfloat'); if (fe) { const f = DOCK.floats.find(x => x.id === fe.dataset.fid); if (f) { f.z = ++dockZ; fe.style.zIndex = f.z; } }
});
window.addEventListener('mousemove', e => {
  if (dockWin) {
    const w = dockWin, dx = e.clientX - w.sx, dy = e.clientY - w.sy, f = w.f;
    if (w.mode === 'move') {
      f.x = Math.max(-f.w + 60, Math.min(innerWidth - 60, w.o.x + dx)); f.y = Math.max(0, Math.min(innerHeight - 30, w.o.y + dy));
      w.merge = e.shiftKey ? null : dockMergeTarget(e.clientX, e.clientY, f);
      if (w.merge) dockShowHint(w.merge); else { $('#dockhint').classList.add('hidden'); if (!e.altKey) dockMagnetMove(f); }
    } else {
      const d = w.dir;
      if (d.includes('e')) f.w = Math.max(180, w.o.w + dx);
      if (d.includes('s')) f.h = Math.max(120, w.o.h + dy);
      if (d.includes('w')) { f.w = Math.max(180, w.o.w - dx); f.x = w.o.x + w.o.w - f.w; }
      if (d.includes('n')) { f.h = Math.max(120, w.o.h - dy); f.y = Math.max(0, w.o.y + w.o.h - f.h); }
      if (!e.altKey) dockMagnetResize(f, d);
    }
    w.fe.style.cssText = `left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px;z-index:${f.z}`; return;
  }
  if (dockSplit) { dockSplitMove(e); return; }
  if (!dockDrag) return;
  const d = dockDrag;
  if (!d.on) { if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return; d.on = true; const gh = dEl('dragghost'); gh.textContent = PANELS[d.id].title; document.body.appendChild(gh); d.ghost = gh; }
  d.ghost.style.left = (e.clientX + 10) + 'px'; d.ghost.style.top = (e.clientY + 10) + 'px';
  d.t = dockTarget(e.clientX, e.clientY); dockShowHint(d.t);
});
window.addEventListener('mouseup', e => {
  if (dockWin) {
    const w = dockWin; dockWin = null; $('#dockhint').classList.add('hidden');
    if (w.mode === 'move' && w.merge) { dockMergeFloat(w.f, w.merge.group); return; }
    PREFS.dock = clone(DOCK); savePrefs(); return;
  }
  if (dockSplit) { dockSplitEnd(); return; }
  if (!dockDrag) return;
  const d = dockDrag; dockDrag = null;
  if (!d.on) return;
  dockClickBlock = true; setTimeout(() => { dockClickBlock = false; }, 0);
  d.ghost.remove(); $('#dockhint').classList.add('hidden');
  if (d.t) dockMove(d.id, d.t);
});
window.addEventListener('keydown', e => { if (e.key === 'Escape' && dockDrag && dockDrag.on) { dockDrag.ghost.remove(); $('#dockhint').classList.add('hidden'); dockDrag = null; dockClickBlock = true; setTimeout(() => { dockClickBlock = false; }, 0); } }, true);

// where would a dragged panel land at this point?
function dockTarget(x, y) {
  const els = document.elementsFromPoint(x, y);
  const fe = els.find(n => n.classList && n.classList.contains('dfloat'));
  const gel = (fe || els.find(n => n.classList && n.classList.contains('dgroup') && !n.closest('.dfloat'))) && (fe ? fe.querySelector('.dgroup') : els.find(n => n.classList && n.classList.contains('dgroup')));
  if (gel && gel._g) {
    const r = gel.getBoundingClientRect(), tr = gel.querySelector('.dtabs').getBoundingClientRect();
    if (fe || y <= tr.bottom) return { t: 'tab', group: gel._g, rect: r };
    const fx = (x - r.left) / r.width, fy = (y - r.top) / r.height;
    if (fx > 0.28 && fx < 0.72 && fy > 0.28 && fy < 0.72) return { t: 'tab', group: gel._g, rect: r };
    const dl = fx, dr = 1 - fx, dt = fy, db = 1 - fy, m = Math.min(dl, dr, dt, db);
    const side = m === dl ? 'left' : m === dr ? 'right' : m === dt ? 'top' : 'bottom';
    const half = side === 'left' ? { left: r.left, top: r.top, width: r.width / 2, height: r.height } : side === 'right' ? { left: r.left + r.width / 2, top: r.top, width: r.width / 2, height: r.height } : side === 'top' ? { left: r.left, top: r.top, width: r.width, height: r.height / 2 } : { left: r.left, top: r.top + r.height / 2, width: r.width, height: r.height / 2 };
    return { t: 'split', group: gel._g, side, rect: half };
  }
  const m = $('#main').getBoundingClientRect(), edge = 70;
  if (x >= m.left && x <= m.right && y >= m.top && y <= m.bottom) {
    if (x < m.left + edge) return { t: 'area', area: 'left', rect: { left: m.left, top: m.top, width: DOCK_SIZE.left, height: m.height } };
    if (x > m.right - edge) return { t: 'area', area: 'right', rect: { left: m.right - DOCK_SIZE.right, top: m.top, width: DOCK_SIZE.right, height: m.height } };
    if (y > m.bottom - edge) return { t: 'area', area: 'bottom', rect: { left: m.left, top: m.bottom - DOCK_SIZE.bottom, width: m.width, height: DOCK_SIZE.bottom } };
  }
  const fx = Math.max(0, Math.min(innerWidth - 340, x - 40)), fy = Math.max(0, Math.min(innerHeight - 400, y - 12));
  return { t: 'float', x: fx, y: fy, rect: { left: fx, top: fy, width: 320, height: 380 } };
}
function dockShowHint(t) {
  const h = $('#dockhint'); if (!t || !t.rect) { h.classList.add('hidden'); return; }
  h.classList.remove('hidden'); h.style.left = t.rect.left + 'px'; h.style.top = t.rect.top + 'px'; h.style.width = t.rect.width + 'px'; h.style.height = t.rect.height + 'px';
}

// ---------- magnetic floating panels ----------
// A floating panel being moved or resized sticks to the edges of other floating panels, the docked panels and the
// work area when it comes within DOCK_MAGNET pixels. Hold Alt to place it freely. Dropping it with the pointer on
// another panel's tab bar puts its tabs into that panel (hold Shift to stop that).
const DOCK_MAGNET = 10;
const rectOf = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
function dockMagnetRects(f) {
  const out = DOCK.floats.filter(o => o !== f).map(o => ({ l: o.x, t: o.y, r: o.x + o.w, b: o.y + o.h }));
  for (const a of DOCK_AREAS) { const el = $('#dock-' + a); if (el && !el.classList.contains('hidden')) out.push(rectOf(el)); }
  const m = $('#main'); if (m) out.push(Object.assign(rectOf(m), { inside: true }));
  return out;
}
// best shift (smallest distance within the magnet) that brings one of the moving edges onto one of the targets
function magnetPick(edges, targets) {
  let best = null;
  for (const e of edges) for (const t of targets) { const d = t - e; if (Math.abs(d) <= DOCK_MAGNET && (best === null || Math.abs(d) < Math.abs(best))) best = d; }
  return best;
}
const overlaps = (a0, a1, b0, b1) => a0 < b1 + DOCK_MAGNET && b0 < a1 + DOCK_MAGNET;
function dockMagnetTargets(f, axis) {
  const R = dockMagnetRects(f), out = [];
  for (const o of R) {
    if (axis === 'x') { if (!overlaps(f.y, f.y + f.h, o.t, o.b)) continue; out.push(o.l, o.r); }
    else { if (!overlaps(f.x, f.x + f.w, o.l, o.r)) continue; out.push(o.t, o.b); }
  }
  return out;
}
function dockMagnetMove(f) {
  const dx = magnetPick([f.x, f.x + f.w], dockMagnetTargets(f, 'x')); if (dx !== null) f.x += dx;
  const dy = magnetPick([f.y, f.y + f.h], dockMagnetTargets(f, 'y')); if (dy !== null) f.y = Math.max(0, f.y + dy);
  f.x = Math.round(f.x); f.y = Math.round(f.y);
}
function dockMagnetResize(f, d) {
  if (d.includes('e')) { const k = magnetPick([f.x + f.w], dockMagnetTargets(f, 'x')); if (k !== null && f.w + k >= 180) f.w += k; }
  if (d.includes('w')) { const k = magnetPick([f.x], dockMagnetTargets(f, 'x')); if (k !== null && f.w - k >= 180) { f.x += k; f.w -= k; } }
  if (d.includes('s')) { const k = magnetPick([f.y + f.h], dockMagnetTargets(f, 'y')); if (k !== null && f.h + k >= 120) f.h += k; }
  if (d.includes('n')) { const k = magnetPick([f.y], dockMagnetTargets(f, 'y')); if (k !== null && f.h - k >= 120 && f.y + k >= 0) { f.y += k; f.h -= k; } }
}
// a floating window dragged by its bar onto another panel's tab bar joins that panel
function dockMergeTarget(x, y, f) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!el.classList || !el.classList.contains('dtabs')) continue;
    const ge = el.closest('.dgroup'), fe = el.closest('.dfloat');
    if (!ge || !ge._g || ge._g === f || (fe && fe.dataset.fid === f.id)) continue;
    const r = ge.getBoundingClientRect(); return { t: 'tab', group: ge._g, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
  }
  return null;
}
function dockMergeFloat(f, group) {
  DOCK.floats = DOCK.floats.filter(o => o !== f);
  for (const id of f.tabs) if (!group.tabs.includes(id)) group.tabs.push(id);
  group.active = f.active || f.tabs[0]; if (group.z !== undefined) group.z = ++dockZ;
  dockCommit();
}

// ---------- splitters ----------
function dockSplitStart(e, sp) {
  const [kind, a, i, j] = sp.dataset.split.split(':');
  if (kind === 'area') { const el = $('#dock-' + a); dockSplit = { kind, a, r: el.getBoundingClientRect(), el }; return; }
  const area = DOCK[a], ci = +i;
  if (kind === 'c') {
    const els = [...$('#dock-' + a).children].filter(n => n.classList.contains('dcol'));
    dockSplit = { kind, a, sx: e.clientX, i: ci, A: area.cols[ci - 1], B: area.cols[ci], ea: els[ci - 1], eb: els[ci], wa: els[ci - 1].getBoundingClientRect().width, wb: els[ci].getBoundingClientRect().width };
  } else {
    const col = area.cols[ci], gi = +j; const els = [...$('#dock-' + a).querySelectorAll('.dcol')[ci].children].filter(n => n.classList.contains('dgroup'));
    dockSplit = { kind, a, sy: e.clientY, A: col.groups[gi - 1], B: col.groups[gi], ea: els[gi - 1], eb: els[gi], wa: els[gi - 1].getBoundingClientRect().height, wb: els[gi].getBoundingClientRect().height };
  }
}
function dockSplitMove(e) {
  const s = dockSplit;
  if (s.kind === 'area') {
    const main = $('#main').getBoundingClientRect(); let v;
    if (s.a === 'left') v = e.clientX - s.r.left; else if (s.a === 'right') v = s.r.right - e.clientX; else v = s.r.bottom - e.clientY;
    v = Math.max(140, Math.min(s.a === 'bottom' ? main.height * 0.7 : main.width * 0.6, v));
    DOCK[s.a].size = Math.round(v); if (s.a === 'bottom') s.el.style.height = v + 'px'; else s.el.style.width = v + 'px'; return;
  }
  const d = s.kind === 'c' ? e.clientX - s.sx : e.clientY - s.sy, min = 70;
  const da = Math.max(min - s.wa, Math.min(s.wb - min, d)); const na = s.wa + da, nb = s.wb - da;
  if (s.kind === 'c') { s.A.w = na; s.B.w = nb; } else { s.A.h = na; s.B.h = nb; }
  s.ea.style.flex = `${na} 1 0`; s.eb.style.flex = `${nb} 1 0`;
}
function dockSplitEnd() { dockSplit = null; PREFS.dock = clone(DOCK); savePrefs(); if (P && P.pages) applyView(); }

// ---------- workspaces ----------
const workspaceNames = () => PRESET_NAMES.concat(Object.keys(PREFS.workspaces || {}).filter(n => !PRESET_NAMES.includes(n)));
const workspaceLayout = name => (PREFS.workspaces && PREFS.workspaces[name]) ? clone(PREFS.workspaces[name]) : (DOCK_PRESETS[name] ? DOCK_PRESETS[name]() : null);
function dockApply(layout) { DOCK = clone(layout); DOCK.floats = DOCK.floats || []; dockNormalize(); PREFS.dock = clone(DOCK); savePrefs(); dockRender(); dockRefresh(); }
function switchWorkspace(name) {
  const l = workspaceLayout(name); if (!l) return;
  PREFS.workspace = name; dockApply(l); renderToolbar(); if (P && P.pages) zoomFit(); flash('Workspace: ' + name);
}
function saveWorkspace(name) {
  PREFS.workspaces = PREFS.workspaces || {}; PREFS.workspaces[name] = clone(DOCK); PREFS.workspace = name; savePrefs(); renderToolbar();
}
function saveWorkspaceDlg() {
  dialog('Save workspace', [['name', 'Workspace name', PRESET_NAMES.includes(PREFS.workspace) ? 'My workspace' : (PREFS.workspace || 'My workspace')]], v => {
    if (!v.name) return false;
    if (workspaceNames().includes(v.name) && !confirm(`Replace the workspace "${v.name}"?`)) return false;
    saveWorkspace(v.name); flash('Saved workspace ' + v.name);
  }, 'Save', '<div class="note">A workspace remembers which panels are open and where they are. It is kept for all projects.</div>');
}
function manageWorkspacesDlg() {
  const draw = () => {
    const rows = workspaceNames().map(n => {
      const mine = !!(PREFS.workspaces && PREFS.workspaces[n]), preset = PRESET_NAMES.includes(n);
      return `<div class="wsrow"><span class="wsn">${esc(n)}${preset ? ' <span class="note">(built in' + (mine ? ', changed' : '') + ')</span>' : ''}</span>${mine ? `<button type="button" class="btn small" data-wsdel="${esc(n)}">${preset ? 'Restore built-in' : 'Delete'}</button>` : ''}</div>`;
    }).join('');
    $('#dlgbody').innerHTML = rows + '<div class="note" style="margin-top:8px">Switch workspaces from the ribbon list or View > Workspace. Use View > Save workspace to keep the current panel arrangement.</div>';
  };
  dialog('Manage workspaces', [], null, 'OK'); draw();
  $('#dlgbody').onclick = e => {
    const b = e.target.closest('[data-wsdel]'); if (!b) return;
    delete PREFS.workspaces[b.dataset.wsdel]; if (PREFS.workspace === b.dataset.wsdel && !workspaceLayout(PREFS.workspace)) PREFS.workspace = 'Schematic';
    savePrefs(); renderToolbar(); draw();
  };
}
function resetPanels() { switchWorkspace(workspaceLayout(PREFS.workspace) ? PREFS.workspace : 'Schematic'); }
function dockMenuItems() {
  const items = ['-'];
  for (const id of PANEL_IDS) items.push([() => (panelOpen(id) ? '✓ ' : '  ') + PANELS[id].title + ' panel', 'panel_' + id]);
  items.push('-', [() => (PREFS.cmdline ? '✓ ' : '  ') + 'Command line', 'toggleCmdline']);
  items.push('-');
  for (const n of workspaceNames()) items.push([() => (PREFS.workspace === n ? '✓ ' : '  ') + 'Workspace: ' + n, 'ws:' + n]);
  items.push(['Save workspace...', 'saveWorkspaceDlg'], ['Manage workspaces...', 'manageWorkspacesDlg'], ['Reset panel layout', 'resetPanels']);
  return items;
}
function workspaceSelectHTML() {
  const cur = workspaceNames().includes(PREFS.workspace) ? PREFS.workspace : '';
  return `<div class="wsbox"><label for="wsselect">Workspace</label><select id="wsselect">${workspaceNames().map(n => `<option value="${esc(n)}" ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="__save">Save current layout as...</option></select></div>`;
}
document.addEventListener('change', e => {
  if (e.target.id !== 'wsselect') return;
  const v = e.target.value; if (v === '__save') { renderToolbar(); saveWorkspaceDlg(); return; }
  switchWorkspace(v);
});

// ---------- startup ----------
function dockInit() {
  DOCK = PREFS.dock && PREFS.dock.left ? clone(PREFS.dock) : (workspaceLayout(PREFS.workspace) || DOCK_PRESETS['Schematic']());
  dockNormalize(); dockRender();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (P && P.pages) applyView(); }).observe($('#canvaswrap'));
}
