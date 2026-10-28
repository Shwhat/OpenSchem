// ---------- blocks: reusable groups of shapes with attributes ----------
// A block definition { name, cat, desc, shapes, attrs } is drawn in real millimetres around its base point (0, 0).
// The library lives in blocks.json (shared by all users on the server) and starts with furniture, fixtures, appliances and mechanical
// equipment; every block used in a project is copied into P.blocks so the project opens anywhere. An insert
// { t: 'insert', name, p, rot, k, mir, vals } places a block on a level. Attributes: PART goes on the bill of
// materials, LOAD (VA) with CIRCUIT adds to that circuit's load calculation, other tags are notes.
let BLOCKLIB = [], insertBlockName = null;
const BLOCK_CATS = [['furniture', 'Furniture'], ['fixtures', 'Plumbing fixtures'], ['appliances', 'Appliances'], ['mechanical', 'Mechanical'], ['other', 'My blocks']];
const blockDef = name => (P.blocks || {})[name] || BLOCKLIB.find(b => b.name === name) || null;

// ---------- starter library ----------
const In = x => r2(x * 25.4 * 1000) / 1000;
const sRect = (x0, y0, x1, y1, r = 0) => rectPline([In(x0), In(y0)], [In(x1), In(y1)], r ? In(r) : 0, 0);
const sCirc = (cx, cy, r) => ({ t: 'circle', c: [In(cx), In(cy)], r: In(r) });
const sEll = (cx, cy, rx, ry) => ({ t: 'ellipse', c: [In(cx), In(cy)], rx: In(rx), ry: In(ry), rot: 0 });
const sLine = (x0, y0, x1, y1) => ({ t: 'line', a: [In(x0), In(y0)], b: [In(x1), In(y1)] });
const sText = (x, y, text, h = 5) => ({ t: 'text', p: [In(x - text.length * h * 0.3), In(y + h * 0.35)], text, h: In(h), rot: 0 });
const APPL = (load, more = []) => [{ tag: 'TAG', prompt: 'Tag', def: '' }, { tag: 'PART', prompt: 'Part number', def: '' }, { tag: 'LOAD', prompt: 'Load (VA)', def: String(load) }, { tag: 'CIRCUIT', prompt: 'Circuit', def: '' }].concat(more);
function starterBlocks() {
  const B = (name, cat, desc, shapes, attrs = []) => ({ name, cat, desc, shapes, attrs, starter: true });
  const sofa = (w, d = 36) => { const x = w / 2, y = d / 2; const n = w > 70 ? 3 : w > 50 ? 2 : 1; const sh = [sRect(-x, -y, x, y, 2), sRect(-x, -y, -x + 6, y, 1), sRect(x - 6, -y, x, y, 1), sLine(-x + 6, -y + 7, x - 6, -y + 7)]; for (let i = 1; i < n; i++) { const cx = -x + 6 + (w - 12) * i / n; sh.push(sLine(cx, -y + 7, cx, y)); } return sh; };
  const bed = (w, l, pillows) => { const x = w / 2, y = l / 2; const sh = [sRect(-x - 1, -y - 2, x + 1, -y), sRect(-x, -y, x, y), sLine(-x, -y + 22, x, -y + 22)]; const pw = (w - 6 - (pillows - 1) * 2) / pillows; for (let i = 0; i < pillows; i++) { const px = -x + 3 + i * (pw + 2); sh.push(sRect(px, -y + 3, px + pw, -y + 13, 2)); } return sh; };
  const chair = (cx, cy) => sRect(cx - 8, cy - 8, cx + 8, cy + 8, 1.5);
  return [
    B('Sofa 84"', 'furniture', 'Three seat sofa, 84 x 36 in', sofa(84)),
    B('Loveseat 64"', 'furniture', 'Two seat sofa, 64 x 36 in', sofa(64)),
    B('Armchair', 'furniture', 'Upholstered chair, 36 x 36 in', sofa(36)),
    B('King bed', 'furniture', 'King bed, 76 x 80 in', bed(76, 80, 2)),
    B('Queen bed', 'furniture', 'Queen bed, 60 x 80 in', bed(60, 80, 2)),
    B('Twin bed', 'furniture', 'Twin bed, 39 x 75 in', bed(39, 75, 1)),
    B('Dining table, 6 seats', 'furniture', 'Table 72 x 36 in with six chairs', [sRect(-36, -18, 36, 18), ...[-24, 0, 24].flatMap(x => [chair(x, -27), chair(x, 27)])]),
    B('Round table, 4 seats', 'furniture', 'Table 48 in round with four chairs', [sCirc(0, 0, 24), chair(0, -33), chair(0, 33), chair(-33, 0), chair(33, 0)]),
    B('Desk and chair', 'furniture', 'Desk 60 x 30 in with chair', [sRect(-30, -15, 30, 15), sRect(-9, 12, 9, 28, 2)]),
    B('Dresser', 'furniture', 'Dresser 60 x 20 in', [sRect(-30, -10, 30, 10), sLine(0, -10, 0, 10)]),
    B('Nightstand', 'furniture', 'Nightstand 20 x 18 in', [sRect(-10, -9, 10, 9)]),
    B('Toilet', 'fixtures', 'Toilet with tank', [sRect(-10, -14, 10, -6, 1), sEll(0, 4, 7.5, 10)], [{ tag: 'PART', prompt: 'Part number', def: '' }]),
    B('Bathtub 60x30', 'fixtures', 'Bathtub 60 x 30 in', [sRect(-30, -15, 30, 15), sRect(-27, -12, 27, 12, 6), sCirc(-22, 0, 1)], [{ tag: 'PART', prompt: 'Part number', def: '' }]),
    B('Shower 36x36', 'fixtures', 'Shower 36 x 36 in', [sRect(-18, -18, 18, 18), sLine(-18, -18, 18, 18), sLine(18, -18, -18, 18), sCirc(0, 0, 1.5)], [{ tag: 'PART', prompt: 'Part number', def: '' }]),
    B('Vanity sink 30"', 'fixtures', 'Vanity 30 x 21 in with one basin', [sRect(-15, -10.5, 15, 10.5), sEll(0, 1, 9, 6.5), sCirc(0, -7, 0.8)], [{ tag: 'PART', prompt: 'Part number', def: '' }]),
    B('Double vanity 60"', 'fixtures', 'Vanity 60 x 21 in with two basins', [sRect(-30, -10.5, 30, 10.5), sEll(-15, 1, 8.5, 6.5), sEll(15, 1, 8.5, 6.5), sCirc(-15, -7, 0.8), sCirc(15, -7, 0.8)], [{ tag: 'PART', prompt: 'Part number', def: '' }]),
    B('Kitchen sink, double', 'fixtures', 'Double bowl sink 33 x 22 in', [sRect(-16.5, -11, 16.5, 11), sRect(-15, -8, -1, 9, 2), sRect(1, -8, 15, 9, 2), sCirc(0, -9.5, 0.8)], [{ tag: 'PART', prompt: 'Part number', def: '' }]),
    B('Range 30"', 'appliances', 'Electric range 30 in', [sRect(-15, -13, 15, 13), sLine(-15, -10, 15, -10), sCirc(-7, -2, 3.5), sCirc(7, -2, 3.5), sCirc(-7, 8, 3), sCirc(7, 8, 3)], APPL(8000)),
    B('Refrigerator', 'appliances', 'Refrigerator 36 x 30 in', [sRect(-18, -15, 18, 15), sLine(-18, 11, 18, 11), sText(0, 0, 'REF')], APPL(700)),
    B('Dishwasher', 'appliances', 'Dishwasher 24 x 24 in', [sRect(-12, -12, 12, 12), sText(0, 0, 'DW')], APPL(1200)),
    B('Microwave', 'appliances', 'Microwave 30 x 16 in', [sRect(-15, -8, 15, 8), sText(0, 0, 'MW')], APPL(1500)),
    B('Washer', 'appliances', 'Clothes washer 27 x 27 in', [sRect(-13.5, -13.5, 13.5, 13.5), sCirc(0, 2, 9), sText(0, -9.5, 'W', 3.5)], APPL(1200)),
    B('Dryer', 'appliances', 'Electric dryer 27 x 27 in (240 V)', [sRect(-13.5, -13.5, 13.5, 13.5), sCirc(0, 2, 9), sText(0, -9.5, 'D', 3.5)], APPL(5000)),
    B('Water heater', 'appliances', 'Electric water heater, 22 in', [sCirc(0, 0, 11), sText(0, 0, 'WH')], APPL(4500)),
    B('Furnace', 'mechanical', 'Furnace 22 x 28 in', [sRect(-11, -14, 11, 14), sText(0, 0, 'FURN', 4)], APPL(800)),
    B('Air handler', 'mechanical', 'Air handler 24 x 24 in', [sRect(-12, -12, 12, 12), sLine(-12, -12, 12, 12), sText(0, 6, 'AH', 4)], APPL(800)),
    B('AC condenser', 'mechanical', 'Outdoor condenser 30 x 30 in', [sRect(-15, -15, 15, 15), sCirc(0, 0, 12), sText(0, 0, 'AC')], APPL(3500)),
    B('Heat pump', 'mechanical', 'Outdoor heat pump 32 x 32 in', [sRect(-16, -16, 16, 16), sCirc(0, 0, 13), sText(0, 0, 'HP')], APPL(4000)),
    B('Water softener', 'mechanical', 'Water softener, 12 in tank', [sCirc(0, 0, 6), sText(0, 0, 'WS', 3.5)], APPL(100)),
    B('Sump pump', 'mechanical', 'Sump pit, 18 in', [sCirc(0, 0, 9), sCirc(0, 0, 4), sText(0, 6, 'SP', 3)], APPL(800)),
  ];
}
async function loadBlocks() {
  let t = ''; try { t = await host.readData('blocks.json'); } catch (e) {}
  if (t) { try { BLOCKLIB = JSON.parse(t).blocks || []; } catch (e) { BLOCKLIB = []; } }
  if (!t || !BLOCKLIB.length) { BLOCKLIB = starterBlocks(); saveBlocks(); }
}
function saveBlocks() { host.writeData('blocks.json', JSON.stringify({ blocks: BLOCKLIB })); }

// ---------- inserts in plan coordinates ----------
const BBOX_CACHE = new WeakMap();
function blockBox(def) {
  if (BBOX_CACHE.has(def)) return BBOX_CACHE.get(def);
  const pts = []; for (const s of def.shapes) { const b = shapeBox(s); if (isFinite(b[0])) pts.push([b[0], b[1]], [b[2], b[3]]); }
  const b = pts.length ? bboxPts(pts) : [-100, -100, 100, 100]; BBOX_CACHE.set(def, b); return b;
}
function insertTs(ins, lv) {
  const ls = lvScale(lv); const out = [tScale([0, 0], (ins.k || 1) / ls)];
  if (ins.mir) out.push(tMirror([0, 0], 90));
  if (ins.rot) out.push(tRotate([0, 0], ins.rot));
  out.push(tMove(ins.p)); return out;
}
const applyTs = (s, Ts) => { for (const T of Ts) transformShape(s, T); return s; };
function insertShapes(ins, lv, withAttrs) {
  const def = blockDef(ins.name); if (!def) return [];
  const Ts = insertTs(ins, lv); const out = def.shapes.map(s => applyTs(clone(s), Ts));
  for (const a of def.attrs || []) {
    const v = (ins.vals || {})[a.tag]; if (!a.show || v == null || v === '') continue;
    const p = a.p || [0, blockBox(def)[3] + 60]; out.push(applyTs({ t: 'text', p: p.slice(), text: String(v), h: a.h || 100, rot: 0 }, Ts));
  }
  if (withAttrs) for (const s of out) { if (ins.color) s.color = ins.color; if (ins.layer) s.layer = ins.layer; }
  return out;
}
function insertOutline(ins) {
  const lv = shapeLevel(ins); const def = blockDef(ins.name); if (!def) return { pts: [ins.p], closed: false };
  const b = blockBox(def); const Ts = insertTs(ins, lv); const m = p => { let q = p; for (const T of Ts) q = T.map(q); return q; };
  return { pts: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(m), closed: true };
}
function insertSnaps(ins, add, segs) { add(ins.p, 'end'); const lv = shapeLevel(ins); for (const s of insertShapes(ins, lv)) if (s.t !== 'text') shapeSnapGeom(s, [], segs); }
function transformInsert(s, T, m) {
  s.p = m(s.p); s.k = r2((s.k || 1) * T.k * 1e4) / 1e4;
  if (T.mir != null) { s.mir = !s.mir; s.rot = r2(n360(2 * T.mir - (s.rot || 0) + 180)); } else s.rot = r2(n360((s.rot || 0) + T.rot));
}
function insertSVGBody(s, lv, t, o, col) {
  const parts = insertShapes(s, lv); if (!parts.length) return `<circle cx="${s.p[0]}" cy="${s.p[1]}" r="${r2(2 / t)}" fill="none" stroke="#b3261e"/>`;
  return parts.map(x => shapeSVG(Object.assign(x, s.color && !x.color ? { color: s.color } : {}), t, { locked: true, sel: o.sel, ghost: o.ghost })).join('');
}

// ---------- BOM and loads ----------
function allInserts() { const out = []; for (const lv of P.levels || []) for (const s of lvShapes(lv)) if (s.t === 'insert') out.push({ s, lv }); return out; }
function blockBomAdd(add) {
  for (const { s } of allInserts()) {
    const part = ((s.vals || {}).PART || '').trim(); if (!part) continue; const def = blockDef(s.name) || {};
    add('p:' + part, { part, desc: def.desc || s.name, tech: '', missing: false, first: s }, (s.vals || {}).TAG || s.name);
  }
}
function blockLoad(fn) { let t = 0; for (const { s } of allInserts()) { const v = s.vals || {}; if (v.CIRCUIT && v.CIRCUIT === fn) t += pnum(v.LOAD) || 0; } return t; }

// ---------- insert tool and library dialog ----------
function blockPreviewSVG(def, px = 64) {
  const b = blockBox(def); const w = b[2] - b[0], h = b[3] - b[1], m = Math.max(w, h) * 0.08; const size = Math.max(w, h) + 2 * m;
  const t = 0.35 / (size * 0.012);
  return `<svg viewBox="${r2(b[0] - m)} ${r2(b[1] - m)} ${r2(w + 2 * m)} ${r2(h + 2 * m)}" style="width:${px}px;height:${px}px">${def.shapes.map(s => shapeSVG(Object.assign(clone(s), { color: '#2b2b2b' }), t, { locked: true })).join('')}</svg>`;
}
function insertDlg() {
  if (!needFloor()) return;
  const draw = (cat, q) => {
    const list = BLOCKLIB.concat(Object.values(P.blocks || {}).filter(b => !BLOCKLIB.some(x => x.name === b.name))).filter(b => (!cat || (b.cat || 'other') === cat) && (!q || (b.name + ' ' + (b.desc || '')).toLowerCase().includes(q.toLowerCase())));
    $('#blkgrid').innerHTML = list.map(b => `<div class="blkcard" data-blk="${esc(b.name)}" title="${esc(b.desc || '')}">${blockPreviewSVG(b)}<span>${esc(b.name)}</span></div>`).join('') || '<div class="note">No blocks.</div>';
  };
  dialog('Insert block', [], null, 'OK', `<div class="blkbar"><select id="blkcat"><option value="">All categories</option>${BLOCK_CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><input id="blkq" class="search" placeholder="Search blocks" style="margin:0;flex:1"></div><div id="blkgrid" class="blkgrid"></div><div class="note">Click a block, then click on the floor plan to place it (type R to rotate, S to scale, M to mirror).</div>`);
  $('#dlg').style.width = '640px'; $('#dlg').style.maxWidth = '92vw';
  draw('', ''); $('#dlgbody').onchange = () => draw($('#blkcat').value, $('#blkq').value); $('#blkq').oninput = () => draw($('#blkcat').value, $('#blkq').value);
  $('#dlgbody').onclick = e => { const c = e.target.closest('[data-blk]'); if (!c) return; $('#dlg').close(); startInsert(c.dataset.blk); };
}
function startInsert(name) { if (!blockDef(name)) { flash('No block named ' + name); return; } insertBlockName = name; setMode('d:insert'); }
drawTool('insert', {
  name: 'Insert block',
  init(D) { D.name = insertBlockName; D.rot = 0; D.k = 1; D.mir = false; },
  prompt: D => D.stage === 'r' ? 'Rotation angle:' : D.stage === 's' ? 'Scale factor:' : `Specify insertion point for ${D.name} [Rotate/Scale/Mirror] (${D.rot}°${D.k !== 1 ? ', x' + D.k : ''}${D.mir ? ', mirrored' : ''}):`,
  make(D, q) { return { t: 'insert', name: D.name, p: q, rot: D.rot, k: D.k, mir: D.mir || undefined, vals: {} }; },
  point(D, q, c) {
    if (D.stage) return; const def = blockDef(D.name); if (!def) return;
    const ins = this.make(D, q); for (const a of def.attrs || []) ins.vals[a.tag] = a.def || '';
    P.blocks = P.blocks || {}; const place = () => commit(() => { if (!P.blocks[D.name]) P.blocks[D.name] = clone(def); lvShapes(c.lv).push(onActiveLayer(Object.assign({ id: uid() }, ins))); });
    const ask = (def.attrs || []).filter(a => a.prompt);
    if (!ask.length) { place(); return; }
    dialog('Block attributes: ' + D.name, ask.map(a => [a.tag, a.prompt, ins.vals[a.tag] || '']), v => { for (const a of ask) ins.vals[a.tag] = v[a.tag]; place(); }, 'Place', '<div class="note">PART goes on the bill of materials. LOAD (VA) with a CIRCUIT adds to that circuit\'s load calculation.</div>');
  },
  num(D, n) { if (D.stage === 'r') D.rot = n360(n); else if (D.stage === 's' && n > 0) D.k = n; D.stage = 0; D.want = 'point'; },
  opt(D, w) {
    if (w === 'R' || w === 'ROTATE') { D.stage = 'r'; D.want = 'angle'; return true; }
    if (w === 'S' || w === 'SCALE') { D.stage = 's'; D.want = 'number'; return true; }
    if (w === 'M' || w === 'MIRROR') { D.mir = !D.mir; return true; }
    return false;
  },
  enter(D) { if (D.stage) { D.stage = 0; D.want = 'point'; return; } drawExit(); },
  ghost(D, q) { return D.stage ? [] : [this.make(D, q)]; },
});

// ---------- making a block from the selection ----------
drawTool('block', {
  name: 'Create block', init(D) { selInit(D, 'base'); }, picking: D => D.stage === 'sel',
  prompt: D => D.stage === 'sel' ? selPrompt : 'Specify the base point (the point you place it by):',
  enter(D, c) { if (!selEnter(D, c)) drawExit(); },
  point(D, q, c) { if (D.stage === 'base') { blockDlg(c.lv, q); drawExit(); } },
});
function blockDlg(lv, base) {
  const shs = selShapes(lv).filter(s => !['wall', 'opening', 'dim', 'hatch'].includes(s.t)); if (!shs.length) { flash('Select lines, shapes, text or blocks first (not walls, dimensions or hatches)'); return; }
  dialog('Create block', [['name', 'Block name', ''], ['cat', 'Category', 'other', 'select', BLOCK_CATS], ['desc', 'Description', ''], ['attrs', 'Attributes, one per line: TAG=default (PART, LOAD, CIRCUIT link to the BOM and loads)', ''], ['lib', 'Save to my block library', true, 'check'], ['keep', 'Replace the selection with the block', true, 'check']], v => {
    if (!v.name) { alert('Enter a name.'); return false; }
    if (blockDef(v.name) && !confirm(`A block named "${v.name}" exists. Replace it?`)) return false;
    const ls = lvScale(lv); const T = [tMove([-base[0], -base[1]]), tScale([0, 0], ls)];
    const shapes = []; for (const s of shs) { if (s.t === 'insert') shapes.push(...insertShapes(s, lv, true).map(x => applyTs(x, T))); else shapes.push(applyTs(clone(s), T)); }
    for (const s of shapes) delete s.id;
    const attrs = v.attrs.split(/\n|,/).map(x => x.trim()).filter(Boolean).map(x => { const [tag, ...d] = x.split('='); return { tag: tag.trim().toUpperCase(), prompt: tag.trim(), def: d.join('=').trim() }; });
    const def = { name: v.name, cat: v.cat, desc: v.desc, shapes, attrs };
    if (v.lib) { BLOCKLIB = BLOCKLIB.filter(b => b.name !== v.name).concat([def]); saveBlocks(); }
    commit(() => {
      P.blocks = P.blocks || {}; P.blocks[v.name] = clone(def);
      if (v.keep) { const gone = new Set(shs.map(s => s.id)); lv.shapes = lvShapes(lv).filter(s => !gone.has(s.id)); const ins = { id: uid(), t: 'insert', name: v.name, p: rp(base), rot: 0, k: 1, vals: Object.fromEntries(attrs.map(a => [a.tag, a.def])) }; lv.shapes.push(ins); sel = new Set([ins.id]); }
    });
    flash('Block ' + v.name + ' created');
  }, 'Create');
}

// ---------- properties ----------
function blockPropsHTML(pg, lv, list) {
  if (!list.every(s => s.t === 'insert')) return null;
  const f = list[0], def = blockDef(f.name) || { attrs: [] };
  if (list.length > 1) return `<div class="ident">${list.length} blocks</div><div class="btnrow"><button class="btn" data-act="eExplode">Explode</button><button class="btn" data-act="delSel">Delete</button></div>`;
  const inLib = BLOCKLIB.some(b => b.name === f.name);
  const lists = `<datalist id="dl-ckt2">${allCircuits().map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
  const attrRows = (def.attrs || []).map(a => row('shp.att.' + a.tag, esc(a.prompt || a.tag), (f.vals || {})[a.tag] || '', 'text', a.tag === 'PART' ? 'list="dl-parts"' : a.tag === 'CIRCUIT' ? 'list="dl-ckt2"' : '')).join('');
  const vals = f.vals || {};
  return `<div class="ident">${esc(f.name)}</div><div class="sub">${esc(def.desc || 'Block')}</div>
    <div class="pgrp"><h4>Placement</h4>${row('shp.irot', 'Rotation (degrees)', r2(f.rot || 0), 'number')}${row('shp.ik', 'Scale', f.k || 1, 'number', 'step="0.1" min="0.01"')}<div class="prow"><label>Mirrored</label><input type="checkbox" data-k="shp.imir" ${f.mir ? 'checked' : ''} style="width:auto"></div></div>
    ${attrRows ? `<div class="pgrp"><h4>Attributes</h4>${attrRows}${partDatalist()}${lists}${vals.PART ? partInfoHTML(vals.PART) : ''}${vals.LOAD && vals.CIRCUIT ? `<div class="note">Adds ${esc(vals.LOAD)} VA to ${esc(dispCkt(vals.CIRCUIT))}.</div>` : ''}</div>` : ''}
    <div class="btnrow">${inLib ? '' : '<button class="btn" data-act="blockToLib">Save to my library</button>'}<button class="btn" data-act="eExplode">Explode</button><button class="btn" data-act="delSel">Delete</button></div>`;
}
function applyBlockProp(pg, lv, s, key, v) {
  if (s.t !== 'insert') return false;
  if (key === 'irot') { s.rot = n360(parseFloat(v) || 0); return true; }
  if (key === 'ik') { const k = parseFloat(v); if (k > 0) s.k = k; return true; }
  if (key === 'imir') { if (v) s.mir = true; else delete s.mir; return true; }
  if (key.startsWith('att.')) { s.vals = s.vals || {}; s.vals[key.slice(4)] = v; return true; }
  return false;
}
function blockToLib() { const lv = levelOf(page()); const s = lv && lvShapes(lv).find(x => sel.has(x.id) && x.t === 'insert'); const def = s && blockDef(s.name); if (!def) return; BLOCKLIB = BLOCKLIB.filter(b => b.name !== def.name).concat([clone(def)]); saveBlocks(); renderProps(); flash('Saved ' + def.name + ' to your block library'); }
function shapePropsMore(pg, lv, list) { return annotPropsHTML(pg, lv, list) || blockPropsHTML(pg, lv, list); }
function applyPropMore(pg, lv, s, key, v) { return applyAnnotProp(pg, lv, s, key, v) || applyBlockProp(pg, lv, s, key, v); }

registerCommand('INSERT', ['I', 'BLOCKS'], 'Insert a block from the library', () => insertDlg());
registerCommand('BLOCK', ['B'], 'Make a block from the selection', () => { if (needFloor()) setMode('d:block'); });
