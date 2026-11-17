// ---------- tile layouts: commands, dialogs, Properties and the tile page tools ----------
Object.assign(RI, {
  tile: '<svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.1"/><path d="M7.5 2.5v15M12.5 2.5v15M2.5 7.5h15M2.5 12.5h15" stroke="#2b3442" stroke-width="1"/><rect x="12.5" y="12.5" width="5" height="5" fill="#9fb6d8"/></svg>',
  tilenew: '<svg viewBox="0 0 20 20"><rect x="2.5" y="5" width="12" height="12" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.1"/><path d="M6.5 5v12M10.5 5v12M2.5 9h12M2.5 13h12" stroke="#2b3442" stroke-width="0.9"/><path d="M14 3.5h5M16.5 1v5" stroke="#2f7d32" stroke-width="1.6"/></svg>',
  tileadd: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" fill="#eef3fb" stroke="#1f5fbf" stroke-width="1.1" stroke-dasharray="2 1.2"/><path d="M10 6.5v7M6.5 10h7" stroke="#2f7d32" stroke-width="1.8"/></svg>',
  tilecut: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" fill="#fbeeee" stroke="#a33" stroke-width="1.1" stroke-dasharray="2 1.2"/><path d="M6.5 10h7" stroke="#a33" stroke-width="1.8"/></svg>',
  tilestart: '<svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" fill="#fff" stroke="#2b3442" stroke-width="1.1"/><path d="M10 2.5v15M2.5 10h15" stroke="#1f5fbf" stroke-width="1" stroke-dasharray="1.6 1"/><circle cx="10" cy="10" r="2.4" fill="#1f5fbf"/></svg>',
});
Object.assign(CMDS, {
  newTileLayout: ['New tile layout', 'tilenew', 'newTileLayout'], tileFromFloor: ['Tile layout', 'tile', 'tileFromFloor'], tileFromFrame: ['Tile this wall', 'tile', 'tileFromFrame'],
  tileSettingsDlg: ['Tiles and pattern', 'tile', 'tileSettingsDlg'], tilePickStart: ['Pick start point', 'tilestart', 'tilePickStart'],
  tileAddArea: ['Add area', 'tileadd', 'tileAddArea'], tileCutArea: ['Cut out area', 'tilecut', 'tileCutArea'],
  tileGoOrder: ['Tile order', 'report', 'tileGoOrder'], tileExportXlsx: ['Tile Excel', 'xlsx', 'tileExportXlsx'],
});
Object.assign(ACTIONS, {
  newTileLayout: () => newTileDlg(), tileFromFloor, tileFromFrame, tileSettingsDlg: () => tileSectionDlg('tile'), tilePickStart: () => tileTool('start'),
  tileAddArea: () => tileTool('add'), tileCutArea: () => tileTool('cut'), tileGoOrder, tileExportXlsx,
});

// ---------- settings fields, shared by the dialogs and Properties ----------
const optLen = (k, label) => ({ k, label, type: 'olen', get: T => getPath(T, k) == null ? '' : tileLen(getPath(T, k)), set: (T, raw) => { if (raw === '' || raw == null) { setPath(T, k, null); return ''; } const v = parseLength(raw); if (v == null || v < 0) return `Could not read "${raw}" as a length.`; setPath(T, k, v); return ''; } });
function tileFields(T, section) {
  const t = T.tile, F = [], f = (k, label, type, opts, extra) => F.push(Object.assign({ k, label, type, opts }, extra || {}));
  if (section === 'tile') {
    f('name', 'Name', 'text');
    f('tile.w', t.pattern === 'hex' ? 'Width across flats' : t.pattern === 'versailles' ? 'Small square (module unit)' : 'Tile width', 'len');
    if (t.pattern !== 'hex' && t.pattern !== 'versailles') f('tile.h', 'Tile height', 'len');
    f('tile.joint', 'Grout joint', 'len'); f('tile.thick', 'Tile thickness', 'len');
    f('tile.pattern', 'Pattern', 'sel', TILE_PATTERNS);
    if (t.pattern === 'bond') f('tile.bond', 'Offset', 'sel', [['0.5', 'Half a tile (1/2)'], ['0.3333', 'A third of a tile (1/3)']], { get: X => Math.abs(X.tile.bond - 1 / 3) < 0.01 ? '0.3333' : '0.5', set: (X, v) => { X.tile.bond = v === '0.3333' ? 1 / 3 : 0.5; return ''; } });
    f('tile.rot', 'Rotation (degrees)', 'deg');
  } else if (section === 'layout') {
    f('tile.start', 'Start from', 'sel', [['center', 'The middle of the area'], ['corner', 'A corner'], ['point', 'A picked point']]);
    if (t.start === 'corner') f('tile.corner', 'Corner', 'sel', [['ll', 'Lower left'], ['lr', 'Lower right'], ['ul', 'Upper left'], ['ur', 'Upper right']]);
    else {
      f('tile.on', 'On the start point', 'sel', [['joint', 'A joint (four tiles meet)'], ['tile', 'The middle of a tile']]);
      f('tile.balance', 'Balance the cuts', 'check');
    }
    if (t.start === 'point') F.push({ k: 'tile.pt', label: 'Start point (x, y)', type: 'pt', get: X => X.tile.pt ? tileLen(X.tile.pt[0]) + ', ' + tileLen(X.tile.pt[1]) : '', set: (X, raw) => { const m = String(raw).split(','); if (m.length !== 2) return 'Enter the start point as x, y, for example 3\', 2\'6".'; const a = parseLength(m[0].trim()), b = parseLength(m[1].trim()); if (a == null || b == null) return `Could not read "${raw}" as a point.`; X.tile.pt = [a, b]; return ''; } });
    F.push({ k: 'tile.minCut', label: 'Smallest cut', type: 'mc', get: X => X.tile.minCut > 0 ? tileLen(X.tile.minCut) : '1/3 tile', set: (X, raw) => { if (!raw || /1\s*\/\s*3/.test(raw)) { X.tile.minCut = 0; return ''; } const v = parseLength(raw); if (v == null || v < 0) return `Could not read "${raw}" as a length.`; X.tile.minCut = v; return ''; } });
  } else if (section === 'area') {
    F.push(optLen('z0', 'Tile from height'), optLen('z1', 'Tile up to height'));
  } else if (section === 'order') {
    F.push({ k: 'tile.perBox', label: 'Tiles per box', type: 'int', get: X => X.tile.perBox > 0 ? String(X.tile.perBox) : '', set: (X, raw) => { const v = raw === '' ? 0 : Math.round(+raw); if (!(v >= 0)) return 'Enter the number of tiles in a box, or leave it empty.'; X.tile.perBox = v; return ''; } });
    F.push({ k: 'tile.waste', label: 'Waste (%)', type: 'int', get: X => X.tile.waste > 0 ? String(X.tile.waste) : '', set: (X, raw) => { const v = raw === '' ? 0 : +raw; if (!(v >= 0 && v < 100)) return 'Enter the waste as a percentage, or leave it empty.'; X.tile.waste = v; return ''; } });
  }
  return F;
}
const TILE_SECTIONS = { tile: 'Tiles and pattern', layout: 'Start and cuts', area: 'Wall height', order: 'Order' };
const tileSections = T => T.surf === 'wall' ? ['tile', 'layout', 'area', 'order'] : ['tile', 'layout', 'order'];
const tfGet = (T, fd) => fd.get ? fd.get(T) : getPath(T, fd.k);
const tfShow = (T, fd) => { const v = tfGet(T, fd); return fd.type === 'len' ? tileLen(v) : fd.type === 'check' ? !!v : String(v ?? ''); };
function tfSet(T, fd, raw) {
  if (fd.set) return fd.set(T, raw);
  let v = raw;
  if (fd.type === 'len') { v = parseLength(raw); if (v == null || !(v > 0) && fd.k !== 'tile.joint') return `Could not read "${raw}" as a length for ${fd.label.toLowerCase()}.`; if (v < 0) return 'A length cannot be negative.'; }
  else if (fd.type === 'deg') { v = parseFloat(raw); if (!isFinite(v)) return 'Enter the rotation in degrees, for example 0 or 45.'; v = ((v % 180) + 180) % 180; }
  else if (fd.type === 'check') v = !!raw;
  setPath(T, fd.k, v); return '';
}
function tileSectionDlg(section, T) {
  T = T || tileOf(page()); if (!T) { flash('Open a tile layout first'); return; }
  const fields = tileFields(T, section);
  dialog(`${T.name}: ${TILE_SECTIONS[section]}`, fields.map(fd => [fd.k, fd.label, tfShow(T, fd), fd.type === 'check' ? 'check' : fd.opts ? 'select' : 'text', fd.opts]), v => {
    const tmp = clone(T); for (const fd of fields) { const e = tfSet(tmp, fd, v[fd.k]); if (e) { alert(e); return false; } }
    commit(() => Object.assign(T, tmp)); flash(TILE_SECTIONS[section] + ' updated');
  }, 'OK', section === 'tile' ? '<div class="note">The tile size is the face of one tile; the joint is the gap between tiles. Herringbone and basketweave use the long side as the width. A rotation of 45 lays the tiles on the diagonal.</div>' : '');
}

// ---------- new layouts ----------
function addTileLayout(T) {
  commit(() => { if (!P.tiles) P.tiles = []; P.tiles.push(T); const pg = syncTilePages(T); sortPages(); curId = pg.id; sel.clear(); });
  zoomFit(); flash('Tile layout ' + T.name + ' added');
}
function newTileDlg() {
  const m = tmet(), d = tileDefaults('floor');
  dialog('New tile layout', [['name', 'Name', 'Tile layout ' + ((P.tiles || []).length + 1)], ['surf', 'Surface', 'floor', 'select', [['floor', 'Floor'], ['wall', 'Wall']]],
    ['w', 'Width of the area', m ? '3000' : "10'"], ['h', 'Depth (or height of a wall)', m ? '2400' : "8'"], ['pts', 'Or an outline (x, y; x, y; ...)', ''],
    ['tw', 'Tile width', tileLen(d.w)], ['th', 'Tile height', tileLen(d.h)], ['pattern', 'Pattern', 'grid', 'select', TILE_PATTERNS]], v => {
    let pts;
    if (v.pts) {
      pts = v.pts.split(';').map(s => s.split(',').map(x => parseLength(x.trim())));
      if (pts.length < 3 || pts.some(p => p.length !== 2 || p.some(x => x == null))) { alert('Enter the outline as points x, y separated by semicolons, for example 0, 0; 10\', 0; 10\', 8\'; 0, 8\'.'); return false; }
    } else {
      const w = parseLength(v.w), h = parseLength(v.h); if (!(w > 0) || !(h > 0)) { alert('Enter the width and depth of the area.'); return false; }
      pts = ccwRect(0, 0, w, h);
    }
    const tw = parseLength(v.tw), th = parseLength(v.th); if (!(tw > 0) || !(th > 0)) { alert('Enter the tile size.'); return false; }
    const T = newTileLayout(v.name || 'Tile layout', v.surf, { kind: 'typed', pts: ccw(pts) }); T.tile.w = tw; T.tile.h = th; T.tile.pattern = v.pattern;
    addTileLayout(T);
  }, 'Create', '<div class="note">A typed outline is measured from its lower left corner. To tile a room or a wall that is already drawn, select it on the floor plan and use Tile layout, or open a framing wall and use Tile this wall; the layout then follows the room or wall.</div>');
}
function tileFromFloor() {
  const pg = page(); if (!isFloor(pg)) { flash('Select a room or a wall on a floor plan first'); return; }
  const fs = [...sel].map(findFp).filter(Boolean);
  const room = fs.find(f => f.kind === 'room'), wl = fs.find(f => f.kind === 'shape' && isWall(f.s));
  if (room) { addTileLayout(newTileLayout((room.r.name || 'Room') + ' floor', 'floor', { kind: 'room', level: room.lv.id, room: room.r.id })); return; }
  if (!wl) { flash('Select a room or a wall on the floor plan first'); return; }
  const lv = wl.lv, w = wl.s, ax = wallAxis(w), mid = ax.len / 2, k = lvScale(lv);
  const sideName = side => { const off = (side === 'L' ? ax.L : ax.R) + (side === 'L' ? 1 : -1) * 150 / k; const r = roomAt(lv, axPt(w, ax, mid, off)); return r ? r.name : ''; };
  const nL = sideName('L'), nR = sideName('R');
  dialog('Tile layout from a wall', [['name', 'Name', (nL || nR || 'Wall') + ' wall'], ['side', 'Side to tile', nL ? 'L' : 'R', 'select', [['L', nL ? nL + ' side' : 'Side 1'], ['R', nR ? nR + ' side' : 'Side 2']]],
    ['z0', 'Tile from height', ''], ['z1', 'Tile up to height', '']], v => {
    const T = newTileLayout(v.name || 'Wall', 'wall', { kind: 'wall', level: lv.id, wall: w.id, side: v.side, label: (v.side === 'L' ? nL : nR) ? (v.side === 'L' ? nL : nR) + ' side' : '' });
    for (const key of ['z0', 'z1']) if (v[key]) { const x = parseLength(v[key]); if (x == null) { alert(`Could not read "${v[key]}" as a height.`); return false; } T[key] = x; }
    addTileLayout(T);
  }, 'Create', '<div class="note">Doors, windows and cabinets or fixtures against the wall are left out. Leave the heights empty to tile the whole wall; a backsplash is usually from the counter (36" or 900 mm) up to the wall cabinets.</div>');
}
function tileFromFrame() {
  const pg = page(), b = bldOf(pg); if (!b || !isFrame(pg)) { flash('Open a framing wall elevation first'); return; }
  const key = frameWallKey(pg); if (pg.view === 'plan' || pg.view === 'floor' || pg.view === 'roof') { flash('Open one of the wall elevations first'); return; }
  dialog('Tile this wall', [['name', 'Name', b.name + ' ' + (WALL_NAMES[key] || 'wall').toLowerCase()], ['face', 'Face', 'in', 'select', [['in', 'Inside'], ['out', 'Outside']]], ['z0', 'Tile from height', ''], ['z1', 'Tile up to height', '']], v => {
    const T = newTileLayout(v.name || 'Wall', 'wall', { kind: 'fwall', bld: b.id, wall: key, face: v.face });
    for (const k of ['z0', 'z1']) if (v[k]) { const x = parseLength(v[k]); if (x == null) { alert(`Could not read "${v[k]}" as a height.`); return false; } T[k] = x; }
    addTileLayout(T);
  }, 'Create', '<div class="note">The layout follows the wall: change its length or move a door and the tiles follow. The inside face of the front and back walls is shorter by the side walls.</div>');
}
function tileGoOrder() {
  const T = tileOf(page()) || (P.tiles || [])[0]; if (!T) { flash('No tile layouts in the project yet'); return; }
  const r = REPORTS.find(x => x.report === 'tileorder' && x.tile === T.id); if (r) goPage(r.id); else flash('The tile order is turned off in Project properties, or the layout has a problem');
}
function tileDeleteLayout(pg) {
  const T = tileOf(pg); if (!T) { commit(() => { P.pages = P.pages.filter(p => p !== pg); curId = P.pages[0].id; }); return; }
  if (P.pages.filter(p => p.tile !== T.id).length < 1) { alert('A project needs at least one page besides this tile layout.'); return; }
  if (!confirm(`Delete the tile layout "${T.name}" with its cut list and tile order?`)) return;
  commit(() => { const i = pageIdx(pg); P.tiles = P.tiles.filter(x => x !== T); P.pages = P.pages.filter(p => p.tile !== T.id); curId = P.pages[Math.min(Math.max(0, i - 1), P.pages.length - 1)].id; sel.clear(); });
}
function tileDuplicate(pg) {
  const T = tileOf(pg); if (!T) return;
  commit(() => { const n = clone(T); n.id = uid(); n.name = T.name + ' copy'; for (const a of n.adds.concat(n.cuts)) a.id = uid(); P.tiles.push(n); const np = syncTilePages(n); sortPages(); curId = np.id; sel.clear(); });
  flash('Tile layout duplicated');
}
function tileAreaFind(T, id) { for (const k of ['adds', 'cuts']) { const a = (T[k] || []).find(x => x.id === id); if (a) return { k, a }; } return null; }
function tileDelete() {
  const T = tileOf(page()); if (!T) return; const ids = [...sel].filter(id => tileAreaFind(T, id)); if (!ids.length) return;
  commit(() => { for (const k of ['adds', 'cuts']) T[k] = T[k].filter(a => !ids.includes(a.id)); sel.clear(); });
  flash(ids.length > 1 ? ids.length + ' areas deleted' : 'Area deleted');
}

// ---------- tools on the tile page ----------
function tileTool(m) {
  const pg = page(); if (!isTile(pg)) { flash('Open a tile layout first'); return; }
  Object.assign(TLM, { mode: m, page: pg.id, a: null, cur: null, press: null });
  $('#st-mode').textContent = m === 'start' ? 'Pick start' : m === 'add' ? 'Add area' : 'Cut out';
  flash(m === 'start' ? 'Click the start point for the layout' : 'Click two corners of the area to ' + (m === 'add' ? 'add' : 'cut out'));
}
function tileEndTool() { Object.assign(TLM, { mode: null, a: null, cur: null, press: null }); $('#st-mode').textContent = 'Select'; }
function tileSurfPt(pg, mx, my) {
  const xf = FRAME_XF.get(pg.id); if (!xf) return null;
  const step = PREFS.snap ? (tmet() ? 10 : IN_MM / 2) : 1, sn = v => Math.round(v / step) * step;
  return [sn((mx - xf.ox) * xf.k), sn((xf.oy - my) * xf.k)];
}
function tileDown(e, pg, mx, my) {
  const T = tileOf(pg); if (!T) return;
  if (TLM.mode && TLM.page === pg.id) {
    const p = tileSurfPt(pg, mx, my); if (!p) return;
    if (TLM.mode === 'start') { commit(() => { T.tile.start = 'point'; T.tile.pt = p; }); tileEndTool(); flash('Start point set at ' + tileLen(p[0]) + ', ' + tileLen(p[1])); return; }
    if (!TLM.a) { TLM.a = p; TLM.cur = p; TLM.press = [e.clientX, e.clientY]; return; }
    tileFinishArea(T, p); return;
  }
  const id = hitId(e);
  if (id && tileAreaFind(T, id)) { if (e.shiftKey || e.ctrlKey) { sel.has(id) ? sel.delete(id) : sel.add(id); } else sel = new Set([id]); render(); return; }
  if (sel.size) { sel.clear(); render(); }
}
function tileFinishArea(T, p) {
  const a = TLM.a, k = TLM.mode === 'cut' ? 'cuts' : 'adds';
  if (Math.abs(p[0] - a[0]) < 1 || Math.abs(p[1] - a[1]) < 1) { flash('The area needs a width and a height'); return; }
  const r = { id: uid(), pts: ccwRect(Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[0], p[0]), Math.max(a[1], p[1])) };
  commit(() => { T[k].push(r); sel = new Set([r.id]); }); tileEndTool();
  flash(k === 'cuts' ? 'Area cut out' : 'Area added');
}
function tileMove(pg, mx, my) {
  if (!(TLM.mode && TLM.page === pg.id)) { $('#st-pos').textContent = 'Page ' + pageName(pg); return; }
  const p = tileSurfPt(pg, mx, my); if (!p) return;
  $('#st-pos').textContent = `X ${tileLen(p[0])}  Y ${tileLen(p[1])}`;
  if (TLM.a) { TLM.cur = p; renderCanvas(); }
}
function tileUp(e) {
  const pg = page(); if (!isTile(pg) || !TLM.a || !TLM.press) return false;
  const moved = Math.hypot(e.clientX - TLM.press[0], e.clientY - TLM.press[1]) > 6; TLM.press = null;
  if (moved) { const [mx, my] = toMM(e); const p = tileSurfPt(pg, mx, my); const T = tileOf(pg); if (p && T) tileFinishArea(T, p); }
  return true;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && TLM.mode) { tileEndTool(); renderCanvas(); } });

// ---------- Properties ----------
function renderTileProps(pg) {
  const el = $('#props'), T = tileOf(pg);
  if (!T) { el.innerHTML = '<div class="ident">Tile layout</div><div class="note">The tile layout for this page was deleted.</div>'; return; }
  const ids = [...sel].filter(id => tileAreaFind(T, id));
  if (ids.length) {
    const f = tileAreaFind(T, ids[0]), bb = bboxOf([f.a.pts]);
    el.innerHTML = `<div class="ident">${ids.length > 1 ? ids.length + ' areas' : f.k === 'cuts' ? 'Cut-out area' : 'Added area'}</div><div class="sub">${esc(T.name)}</div>
      ${ids.length === 1 ? `<div class="note">${tileLen(bb[2] - bb[0])} x ${tileLen(bb[3] - bb[1])}, lower left corner at ${tileLen(bb[0])}, ${tileLen(bb[1])}. Areas stay in place on the source when it changes.</div>` : ''}
      <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  const L = tileLayout(T);
  const grp = section => `<div class="pgrp"><h4>${esc(TILE_SECTIONS[section])}</h4>${tileFields(T, section).map(fd => {
    const id = 'tl.' + fd.k;
    if (fd.type === 'check') return `<div class="prow"><label>${esc(fd.label)}</label><input type="checkbox" data-k="${esc(id)}" ${tfGet(T, fd) ? 'checked' : ''} style="width:auto"></div>`;
    if (fd.opts) return row(id, esc(fd.label), '', 'select', fd.opts.map(([v, l]) => `<option value="${esc(v)}" ${String(tfGet(T, fd)) === v ? 'selected' : ''}>${esc(l)}</option>`).join(''));
    return row(id, esc(fd.label), tfShow(T, fd), 'text', fd.k === 'z0' || fd.k === 'z1' || fd.k === 'tile.perBox' || fd.k === 'tile.waste' ? 'placeholder="' + (fd.k === 'tile.waste' ? 'auto, ' + tileWaste(T.tile) + '%' : fd.k === 'tile.perBox' ? 'auto' : 'whole wall') + '"' : '');
  }).join('')}</div>`;
  const sum = L.err ? `<div class="note" style="color:var(--err)">${esc(L.err)}</div>` : `<div class="note">${L.tiles.filter(x => x.full).length} full tiles, ${L.cuts.length} cut${L.slivers.length ? `, <span style="color:var(--err)">${L.slivers.length} thinner than the smallest cut</span>` : ''}. ${fmtArea(L.area)} tiled.${L.geom.lost ? ' <span style="color:var(--warn)">The source is gone; the layout keeps its last outline.</span>' : ''}</div>`;
  el.innerHTML = `<div class="ident">${esc(T.name)}</div><div class="sub">Tile layout · ${esc(tileSrcLabel(T))}</div>${sum}
    <div class="btnrow"><button class="btn small" data-act="tilePickStart">Pick start point</button><button class="btn small" data-act="tileAddArea">Add area</button><button class="btn small" data-act="tileCutArea">Cut out area</button><button class="btn small" data-act="tileGoOrder">Tile order</button></div>
    ${tileSections(T).map(grp).join('')}`;
}
function tilePropChange(scope, key, v) {
  if (scope !== 'tl') return false;
  const T = tileOf(page()); if (!T) return true;
  const fd = tileSections(T).flatMap(s => tileFields(T, s)).find(x => x.k === key); if (!fd) return true;
  const tmp = clone(T), e = tfSet(tmp, fd, v); if (e) { flash(e); renderProps(); return true; }
  commit(() => Object.assign(T, tmp));
  return true;
}
