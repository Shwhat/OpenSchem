// ---------- framing: dialogs, properties, ribbon commands and dragging openings ----------
Object.assign(RI, {
  fbldg: '<svg viewBox="0 0 20 20"><path d="M3 9l7-6 7 6v8H3z" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 17v-5h4v5" fill="#fff" stroke="#2b3442" stroke-width="1.1"/></svg>',
  fwall: '<svg viewBox="0 0 20 20"><rect x="2.5" y="3" width="15" height="14" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1.1"/><path d="M6.5 3v14M10 3v14M13.5 3v14M2.5 5h15M2.5 15h15" stroke="#8a6d1d" stroke-width="1"/></svg>',
  fdoor: '<svg viewBox="0 0 20 20"><path d="M5 18V3h10v15" fill="#fff" stroke="#2b3442" stroke-width="1.2"/><circle cx="12.5" cy="11" r="0.9" fill="#2b3442"/><path d="M14 5.5h4M16 3.5v4" stroke="#2f7d32" stroke-width="1.5"/></svg>',
  fwin: '<svg viewBox="0 0 20 20"><rect x="3" y="5" width="12" height="10" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.2"/><path d="M9 5v10M3 10h12" stroke="#2b3442" stroke-width="1"/><path d="M15 3.5h4M17 1.5v4" stroke="#2f7d32" stroke-width="1.5"/></svg>',
  ffloor: '<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="12" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1.1"/><path d="M6 4v12M9.5 4v12M13 4v12" stroke="#8a6d1d" stroke-width="1.1"/></svg>',
  froof: '<svg viewBox="0 0 20 20"><path d="M1.5 12L10 4l8.5 8" fill="none" stroke="#2b3442" stroke-width="1.6" stroke-linejoin="round"/><path d="M4.5 10v7h11v-7" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.1"/></svg>',
  fsheath: '<svg viewBox="0 0 20 20"><rect x="3" y="2.5" width="9" height="15" fill="#e8d6ad" stroke="#8a6d1d" stroke-width="1.1"/><rect x="8" y="2.5" width="9" height="15" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1.1"/><path d="M10 6l2 1M13 9l2 1M10 12l2 1" stroke="#b08a3a" stroke-width="0.8"/></svg>',
  flumber: '<svg viewBox="0 0 20 20"><rect x="2" y="12" width="16" height="4" fill="#f4d58d" stroke="#8a6d1d" stroke-width="1.1"/><rect x="2" y="8" width="13" height="4" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1.1"/><rect x="2" y="4" width="10" height="4" fill="#f4d58d" stroke="#8a6d1d" stroke-width="1.1"/></svg>',
  f3d: '<svg viewBox="0 0 20 20"><path d="M10 2.5l7 3.5v8l-7 3.5-7-3.5v-8z" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.1" stroke-linejoin="round"/><path d="M3 6l7 3.5 7-3.5M10 9.5v8" fill="none" stroke="#2b3442" stroke-width="1.1"/></svg>',
  fmkfloor: '<svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" fill="#fff" stroke="#2b3442" stroke-width="2"/><path d="M10 2.5v7h7.5M7 17.5v-4" stroke="#2b3442" stroke-width="1.4"/></svg>',
  ffromroom: '<svg viewBox="0 0 20 20"><rect x="2" y="9" width="8" height="8" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.1"/><path d="M10 9l3.5-5 3.5 5v8h-7" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1.1" stroke-linejoin="round"/></svg>',
});
Object.assign(CMDS, {
  newBuilding: ['New building', 'fbldg', 'newBuilding'], newFramedWall: ['New framed wall', 'fwall', 'newFramedWall'],
  frameSizeDlg: ['Size and walls', 'fwall', 'frameSizeDlg'], frameFloorDlg: ['Floor', 'ffloor', 'frameFloorDlg'], frameRoofDlg: ['Roof', 'froof', 'frameRoofDlg'],
  frameCoverDlg: ['Sheathing', 'fsheath', 'frameCoverDlg'], frameLumberDlg: ['Lumber', 'flumber', 'frameLumberDlg'],
  frameAddDoor: ['Add door', 'fdoor', 'frameAddDoor'], frameAddWindow: ['Add window', 'fwin', 'frameAddWindow'],
  frameToFloor: ['Make floor plan', 'fmkfloor', 'frameToFloor'], frameFromRoom: ['Building from room', 'ffromroom', 'frameFromRoom'],
  view3D: ['3D view', 'f3d', 'view3D'], frameGoLumber: ['Lumber list', 'report', 'frameGoLumber'], frameExportXlsx: ['Materials Excel', 'xlsx', 'frameExportXlsx'],
});

// ---------- field lists shared by the dialogs and the Properties panel ----------
const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
const spOpts = (cur) => { const l = LC().sp.map(v => [String(v), fmtCut(v) + ' on center']); if (!l.some(x => Math.abs(+x[0] - cur) < 0.01)) l.push([String(cur), fmtCut(cur) + ' on center']); return l; };
const sizeOpts = n => LC().sizes.slice(0, n).map((s, i) => [String(i), s]);
const sheetLabel = l => lumberKey() === 'na' ? `4' x ${Math.round(l / IN_MM / 12)}'` : `${LC().sheetW} x ${Math.round(l)} mm`;
function frameFields(b, section) {
  const bld = b.mode === 'building', F = [];
  const f = (k, label, type, opts, extra) => F.push(Object.assign({ k, label, type, opts }, extra || {}));
  if (section === 'size') {
    f('name', 'Name', 'text');
    if (bld) { f('w', 'Width (front and back walls)', 'len'); f('d', 'Depth (side walls)', 'len'); }
    else f('len', 'Wall length', 'len');
    f('studLen', 'Stud length', 'len'); f('plates', 'Top plate', 'num', [['2', 'Double'], ['1', 'Single']]);
    f('sp', 'Stud spacing', 'num', spOpts(b.sp)); f('stud', 'Stud size', 'num', sizeOpts(2));
  } else if (section === 'floor') {
    f('floor.on', 'Frame a floor', 'check'); f('floor.joist', 'Joists', 'num', sizeOpts(4)); f('floor.sp', 'Joist spacing', 'num', spOpts(b.floor.sp));
    f('floor.pt', 'Treated joists', 'check'); f('floor.skids', 'Skids', 'num', [['0', 'None'], ['2', '2'], ['3', '3'], ['4', '4']]);
    f('floor.skid', 'Skid size', 'num', LC().posts.map((s, i) => [String(i), s])); f('floor.deck', 'Decking', 'text');
  } else if (section === 'roof') {
    f('roof.on', 'Frame a roof', 'check'); f('roof.type', 'Roof style', 'sel', [['gable', 'Gable'], ['shed', 'Shed (single slope)']]);
    if (b.roof.type === 'gable') f('roof.ends', 'Gable ends on', 'sel', [['frontback', 'Front and back walls'], ['leftright', 'Left and right walls']]);
    else f('roof.low', 'Low side', 'sel', [['back', 'Back wall'], ['front', 'Front wall'], ['left', 'Left wall'], ['right', 'Right wall']]);
    f('roof.pitch', 'Pitch (rise in 12)', 'pitch'); f('roof.rafter', 'Rafters', 'num', sizeOpts(4)); f('roof.sp', 'Rafter spacing', 'num', spOpts(b.roof.sp));
    f('roof.eave', 'Eave overhang', 'len'); f('roof.rake', 'Rake overhang', 'len');
    if (b.roof.type === 'gable') f('roof.ties', 'Rafter ties', 'sel', [['every', 'Every pair'], ['other', 'Every other pair'], ['none', 'None']]);
  } else if (section === 'cover') {
    const sh = LC().sheets.map((l, i) => [String(i), sheetLabel(l)]);
    f('cover.wall', 'Cover the walls', 'check'); f('cover.wallMat', 'Wall material', 'text'); f('cover.wallSheet', 'Wall sheet size', 'num', sh);
    if (bld) { f('cover.roof', 'Cover the roof', 'check'); f('cover.roofMat', 'Roof material', 'text'); f('cover.roofSheet', 'Roof sheet size', 'num', sh); f('cover.roofDir', 'Long side of roof sheets', 'sel', [['along', 'Along the ridge (sheathing)'], ['down', 'Down the slope (panels)']]); }
  } else if (section === 'lumber') {
    f('stock.pre', 'Buy studs precut to stud length', 'check');
    LC().stock.forEach((l, i) => f('len:' + i, 'Boards of ' + (lumberKey() === 'na' ? Math.round(l / IN_MM / 12) + "'" : (+(l / 1000).toFixed(1)) + ' m'), 'check', null, { get: bb => (bb.stock.lens || []).includes(i), set: (bb, v) => { const s = new Set(bb.stock.lens || []); if (v) s.add(i); else s.delete(i); bb.stock.lens = [...s].sort((a, c) => a - c); } }));
    f('kerf', 'Saw kerf', 'len');
  }
  return F;
}
const FRAME_SECTIONS = { size: 'Size and walls', floor: 'Floor', roof: 'Roof', cover: 'Sheathing and panels', lumber: 'Lumber' };
const fieldGet = (b, fd) => fd.get ? fd.get(b) : getPath(b, fd.k);
const fieldShow = (b, fd) => { const v = fieldGet(b, fd); return fd.type === 'len' ? fmtCut(v) : fd.type === 'pitch' ? String(+(+v).toFixed(3)) : fd.type === 'check' ? !!v : String(v ?? ''); };
// returns an error message, or applies the value
function fieldSet(b, fd, raw) {
  let v = raw;
  if (fd.type === 'len') { v = parseLength(raw); if (v == null || v < 0) return `Could not read "${raw}" as a length for ${fd.label.toLowerCase()}.`; }
  else if (fd.type === 'num') v = +raw;
  else if (fd.type === 'pitch') { v = parseFloat(String(raw).replace(/\s*\/\s*12$/, '').replace(/in 12$/, '')); if (!(v > 0) || v > 30) return 'Enter the roof pitch as the rise in 12, for example 4 or 6.'; }
  if (fd.set) fd.set(b, v); else setPath(b, fd.k, v);
  return '';
}
function frameSectionDlg(section, b) {
  b = b || bldOf(page()); if (!b) { flash('Open a framing page first'); return; }
  if (b.mode === 'wall' && (section === 'floor' || section === 'roof')) { flash('A single framed wall has no floor or roof'); return; }
  const fields = frameFields(b, section);
  dialog(`${b.name}: ${FRAME_SECTIONS[section]}`, fields.map(fd => [fd.k, fd.label, fieldShow(b, fd), fd.type === 'check' ? 'check' : fd.opts ? 'select' : 'text', fd.opts]), v => {
    const tmp = clone(b); for (const fd of fields) { const e = fieldSet(tmp, fd, v[fd.k]); if (e) { alert(e); return false; } }
    const M = frameModel0(tmp); if (M.errs && M.errs.length && !confirm('These settings have a problem:\n\n' + M.errs.join('\n') + '\n\nKeep them anyway?')) return false;
    commit(() => { const i = P.buildings.indexOf(b); P.buildings[i] = Object.assign(b, tmp); syncFramePages(b); if (!P.pages.includes(page())) curId = (P.pages.find(p => p.bld === b.id) || P.pages[0]).id; });
    flash(FRAME_SECTIONS[section] + ' updated');
  }, 'OK', section === 'roof' ? '<div class="note">The pitch is the rise for every 12 of run: 4 is a low slope, 6 is common for sheds, 12 is 45 degrees. Overhangs are measured level from the outside of the walls.</div>'
    : section === 'size' ? '<div class="note">Sizes are the outside of the framing. The stud length does not include the plates.</div>'
    : section === 'lumber' ? '<div class="note">The lumber list uses the fewest boards from the lengths you can buy. The lumber catalog (North American or metric) is in Project properties.</div>' : '');
}

// ---------- new buildings ----------
function newBuildingDlg(mode, from) {
  const m = lumberKey() === 'metric', c = LC();
  const def = newBuilding(mode);
  const fields = mode === 'wall'
    ? [['name', 'Name', 'Wall ' + ((P.buildings || []).length + 1)], ['len', 'Wall length', fmtCut(def.len)], ['studLen', 'Stud length', fmtCut(def.studLen), 'select', c.studs.map(s => [fmtCut(s), fmtCut(s)])], ['door', 'Start with a door in the middle', true, 'check']]
    : [['name', 'Name', from ? from.name : 'Shed ' + ((P.buildings || []).length + 1)], ['w', 'Width (front and back walls)', formatLength(from ? from.w : def.w)], ['d', 'Depth (side walls)', formatLength(from ? from.d : def.d)],
      ['studLen', 'Stud length', fmtCut(def.studLen), 'select', c.studs.map(s => [fmtCut(s), fmtCut(s)])], ['floor', 'Frame a floor', !from, 'check'],
      ['roof', 'Roof', 'gable', 'select', [['gable', 'Gable'], ['shed', 'Shed (single slope)'], ['none', 'No roof']]], ...(from ? [] : [['door', 'Start with a door in the front wall', true, 'check']])];
  dialog(mode === 'wall' ? 'New framed wall' : 'New building', fields, v => {
    const len = k => { const x = parseLength(v[k]); if (x == null || x <= 0) { alert(`Could not read "${v[k]}" as a length.`); return null; } return x; };
    const o = { name: v.name || (mode === 'wall' ? 'Wall' : 'Shed'), bare: true };
    if (mode === 'wall') { o.len = len('len'); if (o.len == null) return false; } else { o.w = len('w'); o.d = len('d'); if (o.w == null || o.d == null) return false; }
    o.studLen = len('studLen'); if (o.studLen == null) return false;
    const b = newBuilding(mode, o);
    if (mode === 'building') { b.floor.on = !!v.floor; b.roof.on = v.roof !== 'none'; if (v.roof === 'shed') b.roof.type = 'shed'; if (v.roof === 'shed') b.roof.pitch = 2; }
    if (v.door) (mode === 'wall' ? b.walls.single : b.walls.front).ops.push(newFrameOpening('door', mode === 'wall' ? b.len : b.w));
    if (from && from.ops) for (const k of WALL_KEYS) b.walls[k].ops = from.ops[k] || [];
    const M = frameModel0(b); if (M.errs && M.errs.length) { alert(M.errs.join('\n')); return false; }
    commit(() => { P.buildings.push(b); syncFramePages(b); sortPages(); curId = P.pages.find(p => p.bld === b.id).id; sel.clear(); });
    zoomFit(); flash((mode === 'wall' ? 'Wall ' : 'Building ') + b.name + ' added');
  }, 'Create', mode === 'wall' ? '<div class="note">A single framed wall gets one elevation page and its own lumber list.</div>'
    : '<div class="note">Sizes are the outside of the framing. The building gets a framing plan, one page per wall, the floor and the roof, plus a lumber list, cut list and cutting plan under Reports.</div>');
}

// ---------- openings ----------
function frameWallKey(pg) { return pg.view === 'wall' ? 'single' : WALL_KEYS.includes(pg.view) ? pg.view : 'front'; }
function frameOpFind(id) { for (const b of P.buildings || []) for (const [k, w] of Object.entries(b.walls)) { const o = (w.ops || []).find(x => x.id === id); if (o) return { b, k, o, list: w.ops }; } return null; }
function frameAddOpening(type) {
  const pg = page(), b = bldOf(pg); if (!b) { flash('Open a framing page first'); return; }
  const k = frameWallKey(pg), M = frameModel(b); const fw = M.walls && M.walls.find(w => w.key === k);
  const len = fw ? fw.len : (k === 'single' ? b.len : (k === 'front' || k === 'back') ? b.w : b.d - 2 * sizeDepth(b.stud));
  const o = newFrameOpening(type, len);
  // find room for it: centered if free, otherwise the first gap that fits
  if (fw && fw.ops.length) {
    const T = M.T, need = o.w + 4 * T; const occ = fw.ops.map(x => [x.roL - 2 * T, x.roR + 2 * T]).sort((a, c) => a[0] - c[0]);
    const gaps = []; let s = T; for (const [a, c] of occ) { if (a - s >= need) gaps.push([s, a]); s = Math.max(s, c); } if (len - T - s >= need) gaps.push([s, len - T]);
    if (!gaps.length) { flash('There is no room for another ' + type + ' in this wall'); return; }
    const g = gaps.sort((a, c) => (c[1] - c[0]) - (a[1] - a[0]))[0]; o.ctr = false; o.x = Math.round(((g[0] + g[1]) / 2 - o.w / 2) / 10) * 10;
  }
  commit(() => { b.walls[k].ops.push(o); if (pg.view === 'plan') curId = (P.pages.find(p => p.bld === b.id && p.view === k) || pg).id; sel = new Set([o.id]); });
  flash((type === 'door' ? 'Door' : 'Window') + ' added to the ' + WALL_NAMES[k].toLowerCase());
}
function frameDelete() {
  const ids = [...sel].filter(id => frameOpFind(id)); if (!ids.length) return;
  commit(() => { for (const id of ids) { const f = frameOpFind(id); if (f) f.list.splice(f.list.indexOf(f.o), 1); } sel.clear(); });
  flash(ids.length > 1 ? ids.length + ' openings deleted' : 'Opening deleted');
}
function frameDeleteBuilding(pg) {
  const b = bldOf(pg); if (!b) { commit(() => { P.pages = P.pages.filter(p => p !== pg); curId = P.pages[0].id; }); return; }
  if (P.pages.filter(p => p.bld !== b.id).length < 1) { alert('A project needs at least one page besides this building.'); return; }
  if (!confirm(`Delete ${b.mode === 'wall' ? 'the wall' : 'the building'} "${b.name}" with all its framing pages and its lumber list?`)) return;
  commit(() => { const i = pageIdx(pg); P.buildings = P.buildings.filter(x => x !== b); P.pages = P.pages.filter(p => p.bld !== b.id); curId = P.pages[Math.min(Math.max(0, i - 1), P.pages.length - 1)].id; sel.clear(); });
}
function frameDuplicate(pg) {
  const b = bldOf(pg); if (!b) return;
  commit(() => {
    const nb = clone(b); nb.id = uid(); nb.name = b.name + ' copy';
    for (const w of Object.values(nb.walls)) for (const o of w.ops || []) o.id = uid();
    P.buildings.push(nb); syncFramePages(nb); sortPages(); curId = P.pages.find(p => p.bld === nb.id && p.view === pg.view).id; sel.clear();
  });
  flash('Building duplicated');
}

// ---------- dragging an opening along its wall ----------
let frdrag = null;
function frameDown(e, pg, mx) {
  const id = hitId(e); const f = id && frameOpFind(id);
  if (f && f.b.id === pg.bld) {
    if (e.shiftKey || e.ctrlKey) { sel.has(id) ? sel.delete(id) : sel.add(id); render(); return; }
    if (!sel.has(id)) { sel = new Set([id]); render(); }
    const M = frameModel(f.b), fw = M.walls && M.walls.find(w => w.key === f.k), op = fw && fw.ops.find(x => x.id === id);
    if (op) frdrag = { pg, f, start: mx, orig: op.roL, len: fw.len, T: M.T, pre: snapshot(), moved: false };
    return;
  }
  if (sel.size) { sel.clear(); render(); }
}
function frameMove(pg, mx) {
  if (!frdrag) return false;
  const xf = FRAME_XF.get(pg.id); if (!xf) return true;
  const step = PREFS.snap ? (unitsOf() === 'metric' ? 10 : IN_MM / 2) : 1, o = frdrag.f.o, T = frdrag.T;
  let x = Math.round((frdrag.orig + (mx - frdrag.start) * xf.k) / step) * step;
  x = Math.max(3 * T, Math.min(frdrag.len - 3 * T - o.w, x));
  if (Math.abs(x - (o.ctr ? frdrag.orig : o.x)) < 0.01 && !frdrag.moved) return true;
  o.x = x; o.ctr = false; frdrag.moved = true; FRAMECACHE.delete(frdrag.f.b.id); renderCanvas();
  $('#st-pos').textContent = `${WALL_NAMES[frdrag.f.k]}: rough opening ${fmtCut(x)} from the left end`;
  return true;
}
function frameUp() {
  if (!frdrag) return false;
  const d = frdrag; frdrag = null;
  if (d.moved) { pushUndo(d.pre); markDirty(); render(); flash('Opening moved to ' + fmtCut(d.f.o.x) + ' from the left end'); }
  return true;
}

// ---------- Properties panel ----------
function renderFrameProps(pg) {
  const el = $('#props'), b = bldOf(pg);
  if (!b) { el.innerHTML = '<div class="ident">Framing page</div><div class="note">The building for this page was deleted.</div>'; return; }
  const ids = [...sel].filter(id => frameOpFind(id));
  if (ids.length === 1) {
    const f = frameOpFind(ids[0]), o = f.o, M = frameModel(b), fw = M.walls && M.walls.find(w => w.key === f.k), op = fw && fw.ops.find(x => x.id === o.id);
    const hopts = [['flat', 'Flat ' + sizeName(0)]].concat(LC().sizes.slice(0, 4).map((s, i) => [String(i), 'Double ' + s]));
    const sel2 = (k, opts, cur) => opts.map(([v, l]) => `<option value="${esc(v)}" ${String(cur) === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
    el.innerHTML = `<div class="ident">${o.type === 'door' ? 'Door' : 'Window'} ${f.list.indexOf(o) + 1}</div><div class="sub">${esc(b.name)} · ${esc(WALL_NAMES[f.k])}</div>
      <div class="pgrp"><h4>Rough opening</h4>${row('fo.type', 'Type', '', 'select', sel2('type', [['door', 'Door'], ['window', 'Window']], o.type))}${row('fo.w', 'Width', fmtCut(o.w))}${row('fo.h', 'Height', fmtCut(o.h))}${o.type === 'window' ? row('fo.sill', 'Sill height', fmtCut(o.sill)) : ''}
      ${row('fo.hdr', 'Header', '', 'select', sel2('hdr', hopts, o.hdr))}</div>
      <div class="pgrp"><h4>Position</h4><div class="prow"><label>Centered</label><input type="checkbox" data-k="fo.ctr" ${o.ctr ? 'checked' : ''} style="width:auto"></div>${row('fo.x', 'From left end', fmtCut(op ? op.roL : o.x || 0), 'text', o.ctr ? 'disabled' : '')}
      <div class="note">Drag the opening along the wall on the elevation, or type the distance from the left end of the wall's plates to the rough opening.</div></div>
      <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  if (ids.length > 1) { el.innerHTML = `<div class="ident">${ids.length} openings selected</div><div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`; return; }
  const M = frameModel(b);
  const grp = section => `<div class="pgrp"><h4>${esc(FRAME_SECTIONS[section])}</h4>${frameFields(b, section).map(fd => {
    const id = 'fb.' + fd.k;
    if (fd.type === 'check') return `<div class="prow"><label>${esc(fd.label)}</label><input type="checkbox" data-k="${esc(id)}" ${fieldGet(b, fd) ? 'checked' : ''} style="width:auto"></div>`;
    if (fd.opts) return row(id, esc(fd.label), '', 'select', fd.opts.map(([v, l]) => `<option value="${esc(v)}" ${String(fieldGet(b, fd)) === v || (fd.type === 'num' && Math.abs(+v - fieldGet(b, fd)) < 0.01) ? 'selected' : ''}>${esc(l)}</option>`).join(''));
    return row(id, esc(fd.label), fieldShow(b, fd));
  }).join('')}</div>`;
  const sections = b.mode === 'building' ? ['size', 'floor', 'roof', 'cover', 'lumber'] : ['size', 'cover', 'lumber'];
  const errs = M.errs && M.errs.length ? `<div class="pgrp"><h4>Problems</h4>${M.errs.map(e => `<div class="note" style="color:var(--err)">${esc(e)}</div>`).join('')}</div>` : '';
  const sum = M.boards ? `<div class="note">${M.boards.length} boards to buy${M.sheets.length ? ', ' + M.sheets.reduce((a, s) => a + s.count, 0) + ' sheets' : ''}. ${M.roof ? 'Peak ' + formatLength(M.peakFromGround) + ' from the ground.' : ''}</div>` : '';
  const onWall = pg.view !== 'plan' && pg.view !== 'floor' && pg.view !== 'roof';
  el.innerHTML = `<div class="ident">${esc(b.name)}</div><div class="sub">${b.mode === 'wall' ? 'Framed wall' : 'Building'} · ${esc(FRAME_VIEWS[pg.view])}</div>${sum}
    <div class="btnrow">${onWall || pg.view === 'plan' ? '<button class="btn small" data-act="frameAddDoor">Add door</button><button class="btn small" data-act="frameAddWindow">Add window</button>' : ''}<button class="btn small" data-act="frameGoLumber">Lumber list</button>${b.mode === 'building' ? '<button class="btn small" data-act="frameToFloor">Make floor plan</button>' : ''}</div>
    ${errs}${sections.map(grp).join('')}`;
}
function framePropChange(scope, key, v) {
  if (scope !== 'fb' && scope !== 'fo') return false;
  const pg = page(), b = bldOf(pg); if (!b) return true;
  if (scope === 'fo') {
    const f = frameOpFind([...sel][0]); if (!f) return true; const o = f.o;
    if (key === 'w' || key === 'h' || key === 'sill' || key === 'x') {
      const x = parseLength(v); if (x == null || x < 0) { flash(`Could not read "${v}" as a length`); renderProps(); return true; }
      commit(() => { o[key] = x; if (key === 'x') o.ctr = false; }); return true;
    }
    if (key === 'ctr') { const M = frameModel(b), op = M.walls && M.walls.find(w => w.key === f.k), r = op && op.ops.find(q => q.id === o.id); commit(() => { if (!v && r) o.x = r.roL; o.ctr = !!v; }); return true; }
    if (key === 'type') { commit(() => { o.type = v; if (v === 'window' && !o.sill) o.sill = lumberKey() === 'metric' ? 1200 : 48 * IN_MM; }); return true; }
    if (key === 'hdr') { commit(() => { o.hdr = v === 'flat' ? 'flat' : +v; }); return true; }
    return true;
  }
  const all = Object.keys(FRAME_SECTIONS).flatMap(s => frameFields(b, s)); const fd = all.find(x => x.k === key); if (!fd) return true;
  const tmp = clone(b); const e = fieldSet(tmp, fd, v); if (e) { flash(e); renderProps(); return true; }
  commit(() => { Object.assign(b, tmp); syncFramePages(b); if (!P.pages.includes(page())) curId = P.pages.find(p => p.bld === b.id).id; });
  return true;
}
function frameGoLumber() {
  const b = bldOf(page()) || (P.buildings || [])[0]; if (!b) { flash('No buildings in the project yet'); return; }
  const r = REPORTS.find(x => x.report === 'lumber' && x.bld === b.id); if (r) goPage(r.id); else flash('The lumber list is turned off in Project properties, or the framing has a problem');
}
