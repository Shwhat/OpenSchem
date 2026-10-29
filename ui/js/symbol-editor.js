// ---------- user symbols: library, editor, symbols tab ----------
let LIB = { symbols: [] };
let symQuery = '', ctxSym = null;
const FP_ICON_OPTS = [['', '(not on floor plans)'], ['rout', 'Outlet'], ['routgf', 'GFCI outlet'], ['rout240', '240V outlet'], ['rlgt', 'Light'], ['rfan', 'Fan'], ['rswt', 'Switch'], ['rsw3', '3-way switch'], ['rdim', 'Dimmer'], ['rsmk', 'Smoke detector'], ['rjbx', 'Junction box'], ['rapp', 'Appliance'], ['rpnl', 'Panel']];

function shapesSVG(shapes) {
  return (shapes || []).map(sh => {
    const dash = sh.dash ? ' stroke-dasharray="1,0.8"' : '';
    const sw = sh.sw ? ` stroke-width="${sh.sw}"` : '';
    const fill = sh.fill ? ' fill="#000"' : '';
    if (sh.t === 'line') return `<path d="M${sh.x1},${sh.y1}L${sh.x2},${sh.y2}"${dash}${sw}/>`;
    if (sh.t === 'rect') return `<rect x="${Math.min(sh.x, sh.x + sh.w)}" y="${Math.min(sh.y, sh.y + sh.h)}" width="${Math.abs(sh.w)}" height="${Math.abs(sh.h)}"${dash}${sw}${fill}/>`;
    if (sh.t === 'circle') return `<circle cx="${sh.cx}" cy="${sh.cy}" r="${sh.r}"${dash}${sw}${fill}/>`;
    if (sh.t === 'path') return `<path d="${esc(sh.d)}"${sh.ox || sh.oy ? ` transform="translate(${sh.ox || 0},${sh.oy || 0})"` : ''}${dash}${sw}${fill}/>`;
    return '';
  }).join('');
}
function shapesBox(def) {
  const xs = [], ys = [];
  for (const sh of def.shapes || []) {
    if (sh.t === 'line') { xs.push(sh.x1, sh.x2); ys.push(sh.y1, sh.y2); }
    else if (sh.t === 'rect') { xs.push(sh.x, sh.x + sh.w); ys.push(sh.y, sh.y + sh.h); }
    else if (sh.t === 'circle') { xs.push(sh.cx - sh.r, sh.cx + sh.r); ys.push(sh.cy - sh.r, sh.cy + sh.r); }
    else if (sh.t === 'text') { xs.push(sh.x - 2, sh.x + 2); ys.push(sh.y - 1.5, sh.y + 1.5); }
    else if (sh.t === 'path') { const n = (sh.d.match(/-?\d*\.?\d+/g) || []).map(Number); for (let i = 0; i + 1 < n.length; i += 2) { xs.push(n[i] + (sh.ox || 0)); ys.push(n[i + 1] + (sh.oy || 0)); } }
  }
  for (const c of def.conns || []) { xs.push(c[0]); ys.push(c[1]); }
  if (!xs.length) return [-4, -4, 4, 4];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function registerUserSym(def) {
  const box = shapesBox(def);
  SYM[def.key] = {
    name: def.name || 'Custom symbol', cat: def.cat || 'My symbols', prefix: def.prefix || null,
    role: def.prefix ? (def.role || 'main') : 'pe', contact: def.contact || undefined, fixed: !def.contact,
    // the Library field files the symbol with a standard: IEC and NFPA symbols follow the palette's standard filter
    lib: def.lib || '', std: def.lib === 'IEC' || def.lib === 'NFPA' ? def.lib : undefined, pneu: def.lib === 'Pneumatic' || undefined,
    res: !!def.home || def.lib === 'Residential', fp: !!def.fpIcon, fpAs: def.fpIcon || undefined, user: true,
    conns: (def.conns || []).map(c => [c[0], c[1], c[2] || '']), box: [box[0] - 0.5, box[1] - 0.5, box[2] + 0.5, box[3] + 0.5],
    draw: () => shapesSVG(def.shapes),
    texts: () => (def.shapes || []).filter(s => s.t === 'text').map(s => [s.x, s.y, s.s, s.size || 2.5, !!s.bold]),
  };
}
const SYM_LIBS = [['', '(none)'], ['IEC', 'IEC'], ['NFPA', 'NFPA'], ['Pneumatic', 'Pneumatic'], ['Residential', 'Residential']];
function userKeys() { return Object.keys(SYM).filter(k => SYM[k].user); }
async function loadLibrary() {
  try { const t = await host.readData('library.json'); if (t) LIB = JSON.parse(t); } catch (e) {}
  LIB.symbols = LIB.symbols || [];
  for (const d of LIB.symbols) registerUserSym(d);
}
function saveLibrary() { host.writeData('library.json', JSON.stringify(LIB)); }
function usedUserDefs() {
  const used = new Set(); for (const it of allItems()) if (SYM[it.sym] && SYM[it.sym].user) used.add(it.sym);
  const out = {};
  for (const k of used) { const d = LIB.symbols.find(s => s.key === k) || (P.userSyms || {})[k]; if (d) out[k] = d; }
  return out;
}
function pruneAssets() {
  const used = new Set(); for (const lv of P.levels || []) if (lv.image) used.add(lv.image.asset);
  for (const pg of P.pages) for (const g of pg.gfx || []) if (g.asset) used.add(g.asset);
  return Object.fromEntries(Object.entries(P.assets || {}).filter(([k]) => used.has(k)));
}
// assets no longer used (deleted images) are left out of the saved file but kept in memory for undo
function projectJSON() { const as = pruneAssets(); P.userSyms = usedUserDefs(); P.parts = usedParts(); stampVersion(P); return JSON.stringify(P, (k, v) => k === 'assets' && v === P.assets ? as : v, 1); }
function registerProjectSyms(p) {
  for (const [k, d] of Object.entries(p.userSyms || {})) if (!SYM[k]) registerUserSym(d);
}

// ---------- copy a built-in symbol into editable shapes ----------
function parsePathD(d, attrs) {
  if (/[ACQSTacqst]/.test(d)) return [Object.assign({ t: 'path', d }, attrs)];
  const tok = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const out = []; let i = 0, cmd = 'M', x = 0, y = 0, sx = 0, sy = 0;
  const num = () => parseFloat(tok[i++]);
  const line = (nx, ny) => { out.push(Object.assign({ t: 'line', x1: r2(x), y1: r2(y), x2: r2(nx), y2: r2(ny) }, attrs)); x = nx; y = ny; };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) { cmd = tok[i++]; if (cmd === 'Z' || cmd === 'z') { line(sx, sy); continue; } }
    switch (cmd) {
      case 'M': x = num(); y = num(); sx = x; sy = y; cmd = 'L'; break;
      case 'm': x += num(); y += num(); sx = x; sy = y; cmd = 'l'; break;
      case 'L': { const nx = num(), ny = num(); line(nx, ny); break; }
      case 'l': { const nx = x + num(), ny = y + num(); line(nx, ny); break; }
      case 'H': line(num(), y); break;
      case 'h': line(x + num(), y); break;
      case 'V': line(x, num()); break;
      case 'v': line(x, y + num()); break;
      default: i++;
    }
  }
  return out;
}
function builtinToShapes(key) {
  const d = SYM[key];
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${d.draw({})}</svg>`, 'image/svg+xml');
  const shapes = [];
  doc.documentElement.querySelectorAll('*').forEach(el => {
    const attrs = {};
    if (el.getAttribute('stroke-dasharray')) attrs.dash = true;
    if (el.getAttribute('stroke-width')) attrs.sw = parseFloat(el.getAttribute('stroke-width'));
    const f = el.getAttribute('fill'); if (f && f !== 'none' && f !== '#fff') attrs.fill = true;
    const tr = el.getAttribute('transform');
    const n = a => parseFloat(el.getAttribute(a) || 0);
    if (el.tagName === 'path') {
      if (tr) shapes.push(Object.assign({ t: 'path', d: el.getAttribute('d') }, attrs));
      else shapes.push(...parsePathD(el.getAttribute('d') || '', attrs));
    } else if (el.tagName === 'rect') shapes.push(Object.assign({ t: 'rect', x: n('x'), y: n('y'), w: n('width'), h: n('height') }, attrs));
    else if (el.tagName === 'circle') shapes.push(Object.assign({ t: 'circle', cx: n('cx'), cy: n('cy'), r: n('r') }, attrs));
  });
  if (d.texts) for (const [x, y, s, size, bold] of d.texts({})) shapes.push({ t: 'text', x, y, s, size, bold: !!bold });
  return shapes;
}
function defFromBuiltin(key) {
  const d = SYM[key];
  if (d.user) { const src = LIB.symbols.find(s => s.key === key) || (P.userSyms || {})[key]; const c = clone(src); c.key = 'u_' + uid(); c.name = src.name + ' (copy)'; return c; }
  return { key: 'u_' + uid(), name: d.name + ' (copy)', cat: 'My symbols', prefix: d.prefix || '', role: ['main', 'aux'].includes(d.role) ? d.role : 'main',
    contact: d.contact && !d.fixed ? d.contact : '', lib: d.std || (d.pneu ? 'Pneumatic' : d.res ? 'Residential' : ''), home: !!d.res, fpIcon: d.fp ? (d.fpAs || key) : '', shapes: builtinToShapes(key), conns: clone(d.conns) };
}

// ---------- symbol editor ----------
// Works like a drawing page: snap to a grid you choose (G toggles, Shift+G aligns), click or drag a window to select
// (left to right: inside, right to left: crossing), Shift+click adds, drag to move, drag a grip to reshape, type exact
// values in the Selected box, Ctrl+Z / Ctrl+Y, Ctrl+D duplicates, R rotates, M mirrors, arrow keys nudge, the wheel
// zooms, the middle button or Space+drag pans. Connection points always sit on the 4 mm wiring grid.
let SE = null;
const SE_GRIDS = [[0.5, '0.5 mm'], [1, '1 mm'], [2, '2 mm'], [4, '4 mm']];
function symbolEditor(def, isNew) {
  SE = { def: clone(def), tool: 'select', sel: [], drag: null, isNew, undo: [], redo: [], view: [-26, -26, 52], space: false,
    snap: PREFS.seSnap !== false, grid: PREFS.seGrid || 0.5 };
  dialog(isNew ? 'New symbol' : 'Edit symbol', [], () => saveSymbolDef(SE.def), 'Save to library');
  const dlg = $('#dlg'); dlg.style.width = '1100px'; dlg.style.maxWidth = '97vw';
  seDraw();
  dlg.onkeydown = seKey;
  dlg.onkeyup = e => { if (e.key === ' ') SE.space = false; };
}
const SE_TOOLS = [['select', 'Select'], ['line', 'Line'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['text', 'Text'], ['conn', 'Connection point']];
// selection keys: 's3' = shape 3, 'c1' = connection point 1
const seKeyOf = (kind, i) => (kind === 'conn' ? 'c' : 's') + i;
const seParse = k => ({ kind: k[0] === 'c' ? 'conn' : 'shape', i: +k.slice(1) });
const seHas = k => SE.sel.includes(k);
const seOne = () => SE.sel.length === 1 ? seParse(SE.sel[0]) : null;
const seG = v => SE.snap ? r2(Math.round(v / SE.grid) * SE.grid) : r2(v);
function sePush() { SE.undo.push(clone(SE.def)); if (SE.undo.length > 100) SE.undo.shift(); SE.redo = []; }
function seUndo() { if (!SE.undo.length) return; SE.redo.push(clone(SE.def)); SE.def = SE.undo.pop(); seClean(); seDraw(); }
function seRedo() { if (!SE.redo.length) return; SE.undo.push(clone(SE.def)); SE.def = SE.redo.pop(); seClean(); seDraw(); }
function seClean() { const d = SE.def; SE.sel = SE.sel.filter(k => { const q = seParse(k); return q.kind === 'conn' ? !!d.conns[q.i] : !!d.shapes[q.i]; }); }

// ---------- geometry of editor shapes ----------
function sePts(sh) {
  if (sh.t === 'line') return [[sh.x1, sh.y1], [sh.x2, sh.y2]];
  if (sh.t === 'rect') return [[sh.x, sh.y], [sh.x + sh.w, sh.y], [sh.x + sh.w, sh.y + sh.h], [sh.x, sh.y + sh.h]];
  if (sh.t === 'circle') return [[sh.cx, sh.cy], [sh.cx + sh.r, sh.cy]];
  if (sh.t === 'text') return [[sh.x, sh.y]];
  if (sh.t === 'path') return [[sh.ox || 0, sh.oy || 0]];
  return [];
}
function seBox(sh) {
  if (sh.t === 'circle') return [sh.cx - sh.r, sh.cy - sh.r, sh.cx + sh.r, sh.cy + sh.r];
  if (sh.t === 'text') { const w = String(sh.s || '').length * (sh.size || 2.5) * 0.3, h = (sh.size || 2.5) * 0.5; return [sh.x - w, sh.y - h, sh.x + w, sh.y + h]; }
  if (sh.t === 'path') { const b = shapesBox({ shapes: [sh] }); return b; }
  const p = sePts(sh); return [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))];
}
function seMoveShape(sh, dx, dy) {
  if (sh.t === 'line') { sh.x1 = r2(sh.x1 + dx); sh.x2 = r2(sh.x2 + dx); sh.y1 = r2(sh.y1 + dy); sh.y2 = r2(sh.y2 + dy); }
  else if (sh.t === 'rect' || sh.t === 'text') { sh.x = r2(sh.x + dx); sh.y = r2(sh.y + dy); }
  else if (sh.t === 'circle') { sh.cx = r2(sh.cx + dx); sh.cy = r2(sh.cy + dy); }
  else if (sh.t === 'path') { sh.ox = r2((sh.ox || 0) + dx); sh.oy = r2((sh.oy || 0) + dy); }
}
// map every point of a shape; f returns the new point. Rectangles stay rectangles (axis aligned) and circles keep their radius.
function seMapShape(sh, f) {
  if (sh.t === 'line') { const a = f([sh.x1, sh.y1]), b = f([sh.x2, sh.y2]); sh.x1 = r2(a[0]); sh.y1 = r2(a[1]); sh.x2 = r2(b[0]); sh.y2 = r2(b[1]); }
  else if (sh.t === 'rect') { const a = f([sh.x, sh.y]), b = f([sh.x + sh.w, sh.y + sh.h]); sh.x = r2(Math.min(a[0], b[0])); sh.y = r2(Math.min(a[1], b[1])); sh.w = r2(Math.abs(b[0] - a[0])); sh.h = r2(Math.abs(b[1] - a[1])); }
  else if (sh.t === 'circle') { const c = f([sh.cx, sh.cy]); sh.cx = r2(c[0]); sh.cy = r2(c[1]); }
  else if (sh.t === 'text') { const c = f([sh.x, sh.y]); sh.x = r2(c[0]); sh.y = r2(c[1]); }
  else if (sh.t === 'path') { const o = [sh.ox || 0, sh.oy || 0], c = f(o); sh.ox = r2(c[0]); sh.oy = r2(c[1]); }
}
// grips of a shape: [x, y, id]; dragging one reshapes the shape
function seGrips(sh) {
  if (sh.t === 'line') return [[sh.x1, sh.y1, 'a'], [sh.x2, sh.y2, 'b']];
  if (sh.t === 'rect') return [[sh.x, sh.y, 'nw'], [sh.x + sh.w, sh.y, 'ne'], [sh.x + sh.w, sh.y + sh.h, 'se'], [sh.x, sh.y + sh.h, 'sw']];
  if (sh.t === 'circle') return [[sh.cx + sh.r, sh.cy, 'r'], [sh.cx, sh.cy - sh.r, 'r2']];
  return [];
}
function seGripTo(sh, g, o, p) {
  if (sh.t === 'line') { if (g === 'a') { sh.x1 = p[0]; sh.y1 = p[1]; } else { sh.x2 = p[0]; sh.y2 = p[1]; } return; }
  if (sh.t === 'rect') {
    let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
    if (g.includes('w')) x0 = p[0]; if (g.includes('e')) x1 = p[0]; if (g.includes('n')) y0 = p[1]; if (g.includes('s')) y1 = p[1];
    sh.x = r2(Math.min(x0, x1)); sh.y = r2(Math.min(y0, y1)); sh.w = r2(Math.abs(x1 - x0)); sh.h = r2(Math.abs(y1 - y0)); return;
  }
  if (sh.t === 'circle') sh.r = Math.max(0.25, r2(Math.hypot(p[0] - o.cx, p[1] - o.cy)));
}

// ---------- drawing the editor ----------
function seDraw() {
  const d = SE.def; const one = seOne(); const hadFocus = document.activeElement && (document.activeElement.id === 'secv' || document.activeElement === document.body || SE.keepFocus);
  const field = (k, label, v, type = 'text', opts) => type === 'select'
    ? `<div class="prow"><label>${label}</label><select data-se="${k}">${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>`
    : type === 'check' ? `<div class="prow"><label>${label}</label><input type="checkbox" data-se="${k}" ${v ? 'checked' : ''}></div>`
    : `<div class="prow"><label>${label}</label><input data-se="${k}" value="${esc(v ?? '')}" ${type === 'number' ? 'type="number" step="0.1"' : ''}></div>`;
  const xy = (kx, ky, vx, vy, lx = 'X', ly = 'Y') => field(kx, lx + ' (mm)', vx, 'number') + field(ky, ly + ' (mm)', vy, 'number');
  let selHTML = '<div class="note">Click a line, shape, text or connection point to edit it, or drag a window around several. Drag the small squares to reshape.</div>';
  if (one && one.kind === 'shape') {
    const sh = d.shapes[one.i];
    selHTML = `<div class="note" style="margin-bottom:4px">${{ line: 'Line', rect: 'Rectangle', circle: 'Circle', text: 'Text', path: 'Path (copied curve)' }[sh.t]}</div>`;
    if (sh.t === 'line') selHTML += xy('g.x1', 'g.y1', sh.x1, sh.y1, 'Start X', 'Start Y') + xy('g.x2', 'g.y2', sh.x2, sh.y2, 'End X', 'End Y');
    else if (sh.t === 'rect') selHTML += xy('g.x', 'g.y', sh.x, sh.y, 'Left', 'Top') + xy('g.w', 'g.h', sh.w, sh.h, 'Width', 'Height');
    else if (sh.t === 'circle') selHTML += xy('g.cx', 'g.cy', sh.cx, sh.cy, 'Center X', 'Center Y') + field('g.r', 'Radius (mm)', sh.r, 'number');
    else if (sh.t === 'text') selHTML += xy('g.x', 'g.y', sh.x, sh.y);
    else if (sh.t === 'path') selHTML += xy('g.ox', 'g.oy', sh.ox || 0, sh.oy || 0, 'Offset X', 'Offset Y');
    if (sh.t === 'text') selHTML += field('s.s', 'Text', sh.s) + field('s.size', 'Height (mm)', sh.size || 2.5, 'number') + field('s.bold', 'Bold', sh.bold, 'check');
    else { selHTML += field('s.dash', 'Dashed', sh.dash, 'check'); if (sh.t !== 'line') selHTML += field('s.fill', 'Filled', sh.fill, 'check'); selHTML += field('s.sw', 'Line width', sh.sw || 0.35, 'number'); }
    selHTML += '<div class="btnrow"><button type="button" class="btn small" data-seb="del">Delete</button></div>';
  } else if (one && one.kind === 'conn') {
    const c = d.conns[one.i];
    selHTML = `<div class="note" style="margin-bottom:4px">Connection point (on the 4 mm grid)</div>${xy('k.0', 'k.1', c[0], c[1])}${field('c.label', 'Designation', c[2])}<div class="btnrow"><button type="button" class="btn small" data-seb="del">Delete</button></div>`;
  } else if (SE.sel.length > 1) {
    selHTML = `<div class="note" style="margin-bottom:4px">${SE.sel.length} objects selected</div><div class="btnrow"><button type="button" class="btn small" data-seb="del">Delete</button></div>`;
  }
  const b = (op, label, title, on) => `<button type="button" class="btn small${on ? ' primary' : ''}" data-seb="${op}" title="${title}">${label}</button>`;
  $('#dlgbody').innerHTML = `<div class="se">
    <div class="se-left">
      <h4>Symbol</h4>
      ${field('d.name', 'Name', d.name)}${field('d.cat', 'Category', d.cat || 'My symbols')}
      ${field('d.prefix', 'Tag prefix', d.prefix)}
      ${field('d.role', 'Function', d.role || 'main', 'select', [['main', 'Main function'], ['aux', 'Auxiliary function']])}
      ${field('d.contact', 'Contact type', d.contact || '', 'select', [['', 'None (fixed numbers)'], ['NO', 'NO (auto 13/14, 23/24)'], ['NC', 'NC (auto 11/12, 21/22)']])}
      ${field('d.lib', 'Library', d.lib || '', 'select', SYM_LIBS)}
      ${field('d.home', 'Home device', d.home, 'check')}
      ${field('d.fpIcon', 'Floor-plan icon', d.fpIcon || '', 'select', FP_ICON_OPTS)}
      <div class="note">Tag prefix empty = no device tag (like a ground symbol). Home devices use whole-house numbering and circuit colors.</div>
      <h4>Selected</h4>${selHTML}
    </div>
    <div class="se-mid">
      <div class="se-tools">${SE_TOOLS.map(([t, l]) => `<button type="button" class="btn small${SE.tool === t ? ' primary' : ''}" data-setool="${t}">${l}</button>`).join('')}</div>
      <div class="se-tools">
        ${b('snap', 'Snap ' + (SE.snap ? 'on' : 'off'), 'Snap to grid (G)', SE.snap)}
        <select data-se="v.grid" title="Grid size">${SE_GRIDS.map(([v, l]) => `<option value="${v}" ${v === SE.grid ? 'selected' : ''}>Grid ${l}</option>`).join('')}</select>
        ${b('align', 'Align to grid', 'Align the selection, or everything, to the grid (Shift+G)')}
        ${b('rot', 'Rotate', 'Rotate the selection 90 degrees (R)')}${b('mir', 'Mirror', 'Mirror the selection left to right (M)')}${b('dup', 'Duplicate', 'Duplicate the selection (Ctrl+D)')}
        ${b('undo', 'Undo', 'Ctrl+Z')}${b('redo', 'Redo', 'Ctrl+Y')}${b('fit', 'Fit', 'Zoom to the symbol (F)')}
      </div>
      <svg id="secv" tabindex="0" viewBox="${SE.view.join(' ')} ${SE.view[2]}">${seCanvas()}</svg>
      <div class="note">Graphics snap to the grid you pick; connection points always sit on the 4 mm wiring grid. The red cross marks the insertion point.</div>
    </div></div>`;
  seWire();
  if (hadFocus && SE.focused) $('#secv').focus({ preventScroll: true });
}
function seCanvas() {
  const d = SE.def; let s = ''; const [vx, vy, vw] = SE.view, u = vw / 52;
  // the canvas is wider than tall; the square view is centered in it, so the grid runs past it on both sides
  const cvEl = $('#secv'), cr = cvEl && cvEl.getBoundingClientRect(), ar = cr && cr.height ? Math.max(1, cr.width / cr.height) : 2;
  const gx0 = vx - vw * (ar - 1) / 2, gx1 = gx0 + vw * ar;
  const g = SE.grid, x0 = Math.floor(gx0 / g) * g, y0 = Math.floor(vy / g) * g, nx = (gx1 - gx0) / g, ny = vw / g;
  const gl = (v, a) => { const m = Math.abs(v % 4) < 1e-6; return [m ? '#c9d3e0' : '#eef1f5', (m ? 0.08 : 0.05) * u]; };
  if (ny <= 260) {
    for (let i = 0; i <= nx + 1; i++) { const v = r2(x0 + i * g), [c, w] = gl(v); s += `<line x1="${v}" y1="${vy}" x2="${v}" y2="${vy + vw}" stroke="${c}" stroke-width="${w}"/>`; }
    for (let i = 0; i <= ny + 1; i++) { const v = r2(y0 + i * g), [c, w] = gl(v); s += `<line x1="${r2(gx0)}" y1="${v}" x2="${r2(gx1)}" y2="${v}" stroke="${c}" stroke-width="${w}"/>`; }
  }
  s += `<path d="M-2,0H2M0,-2V2" stroke="#e0332b" stroke-width="${0.15 * u}"/>`;
  d.shapes.forEach((sh, i) => {
    const on = seHas('s' + i); const col = on ? '#1f6fff' : '#000';
    if (sh.t === 'text') s += `<text x="${sh.x}" y="${sh.y + (sh.size || 2.5) * 0.35}" font-size="${sh.size || 2.5}" text-anchor="middle" font-family="Arial" ${sh.bold ? 'font-weight="bold"' : ''} fill="${col}" data-si="${i}" style="cursor:move">${esc(sh.s)}</text>`;
    else s += `<g data-si="${i}" style="color:${col};cursor:move"><g class="sym se-sh" style="stroke:${col}">${shapesSVG([sh])}</g><g class="se-hit">${shapesSVG([Object.assign({}, sh, { fill: false, dash: false, sw: 1.6 * u })])}</g></g>`;
  });
  d.conns.forEach((c, i) => {
    const on = seHas('c' + i);
    s += `<g data-ci="${i}" style="cursor:move"><circle cx="${c[0]}" cy="${c[1]}" r="0.9" fill="${on ? '#1f6fff' : '#e0332b'}" fill-opacity="0.85"/><text x="${c[0] + 1.2}" y="${c[1] - 1}" font-size="1.8" font-family="Arial" fill="#c0261e">${esc(c[2] || '')}</text></g>`;
  });
  // grips on the selected shapes
  for (const k of SE.sel) { const q = seParse(k); if (q.kind !== 'shape') continue; const sh = d.shapes[q.i]; if (!sh) continue; for (const [x, y, gid] of seGrips(sh)) s += `<rect class="segrip" data-seg="${q.i}:${gid}" x="${x - 0.7 * u}" y="${y - 0.7 * u}" width="${1.4 * u}" height="${1.4 * u}" fill="#1f6fff" stroke="#fff" stroke-width="${0.15 * u}" style="cursor:crosshair"/>`; }
  if (SE.drag && SE.drag.preview) s += SE.drag.preview;
  return s;
}
function sePt(e) {
  const cv = $('#secv'); const pt = cv.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(cv.getScreenCTM().inverse()); return [q.x, q.y];
}
const s05 = v => Math.round(v * 2) / 2, s4 = v => Math.round(v / 4) * 4;
function seRefresh() { const cv = $('#secv'); if (cv) { cv.setAttribute('viewBox', `${SE.view[0]} ${SE.view[1]} ${SE.view[2]} ${SE.view[2]}`); cv.innerHTML = seCanvas(); } }

// ---------- editing operations ----------
function seSelected() { const d = SE.def; return SE.sel.map(seParse).map(q => q.kind === 'conn' ? { q, c: d.conns[q.i] } : { q, sh: d.shapes[q.i] }).filter(o => o.c || o.sh); }
function seAll() { return SE.def.shapes.map((_, i) => 's' + i).concat(SE.def.conns.map((_, i) => 'c' + i)); }
function seAlign() {
  const keys = SE.sel.length ? SE.sel : seAll(); if (!keys.length) return;
  sePush(); const d = SE.def; const g = v => r2(Math.round(v / SE.grid) * SE.grid);
  for (const k of keys) {
    const q = seParse(k);
    if (q.kind === 'conn') { const c = d.conns[q.i]; c[0] = s4(c[0]); c[1] = s4(c[1]); continue; }
    const sh = d.shapes[q.i];
    if (sh.t === 'circle') { sh.cx = g(sh.cx); sh.cy = g(sh.cy); sh.r = Math.max(SE.grid, g(sh.r)); }
    else if (sh.t === 'rect') { const x1 = g(sh.x + sh.w), y1 = g(sh.y + sh.h); sh.x = g(sh.x); sh.y = g(sh.y); sh.w = r2(x1 - sh.x); sh.h = r2(y1 - sh.y); }
    else seMapShape(sh, p => [g(p[0]), g(p[1])]);
  }
  seDraw(); flash(SE.sel.length ? 'Selection aligned to the grid' : 'Symbol aligned to the grid');
}
// rotate 90 degrees clockwise or mirror left to right about the insertion point (cross), or about the center of the
// selection when nothing at the insertion point is selected; connection points stay on the 4 mm grid
function seTransform(kind) {
  const items = seSelected(); if (!items.length) return;
  sePush();
  const xs = [], ys = []; for (const o of items) { const b = o.c ? [o.c[0], o.c[1], o.c[0], o.c[1]] : seBox(o.sh); xs.push(b[0], b[2]); ys.push(b[1], b[3]); }
  const all = items.length === seAll().length; const c = all ? [0, 0] : [s4((Math.min(...xs) + Math.max(...xs)) / 2), s4((Math.min(...ys) + Math.max(...ys)) / 2)];
  const f = kind === 'rot' ? p => [c[0] - (p[1] - c[1]), c[1] + (p[0] - c[0])] : p => [2 * c[0] - p[0], p[1]];
  for (const o of items) {
    if (o.c) { const p = f(o.c); o.c[0] = s4(p[0]); o.c[1] = s4(p[1]); continue; }
    if (o.sh.t === 'rect' && kind === 'rot') { const cx = o.sh.x + o.sh.w / 2, cy = o.sh.y + o.sh.h / 2, n = f([cx, cy]); const w = o.sh.h, h = o.sh.w; Object.assign(o.sh, { x: r2(n[0] - w / 2), y: r2(n[1] - h / 2), w: r2(w), h: r2(h) }); }
    else seMapShape(o.sh, f);
  }
  seDraw();
}
function seDuplicate() {
  const items = seSelected(); if (!items.length) return;
  sePush(); const d = SE.def, off = 4, made = [];
  for (const o of items) {
    if (o.c) { let x = o.c[0] + off, y = o.c[1] + off; while (d.conns.some(c => c[0] === x && c[1] === y)) { x += 4; y += 4; } d.conns.push([x, y, String(d.conns.length + 1)]); made.push('c' + (d.conns.length - 1)); }
    else { const n = clone(o.sh); seMoveShape(n, off, off); d.shapes.push(n); made.push('s' + (d.shapes.length - 1)); }
  }
  SE.sel = made; seDraw();
}
function seNudge(dx, dy) {
  const items = seSelected(); if (!items.length) return;
  sePush(); const hasConn = items.some(o => o.c); const st = hasConn ? 4 : SE.grid; dx *= st; dy *= st;
  for (const o of items) { if (o.c) { o.c[0] = r2(o.c[0] + dx); o.c[1] = r2(o.c[1] + dy); } else seMoveShape(o.sh, dx, dy); }
  seDraw();
}
function seDelete() {
  if (!SE.sel.length) return;
  sePush(); const qs = SE.sel.map(seParse);
  const cs = new Set(qs.filter(q => q.kind === 'conn').map(q => q.i)), ss = new Set(qs.filter(q => q.kind === 'shape').map(q => q.i));
  SE.def.conns = SE.def.conns.filter((_, i) => !cs.has(i)); SE.def.shapes = SE.def.shapes.filter((_, i) => !ss.has(i));
  SE.sel = []; seDraw();
}
function seFit() {
  const b = shapesBox(SE.def); const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = Math.max(16, (b[2] - b[0]) * 1.4, (b[3] - b[1]) * 1.4);
  SE.view = [r2(cx - w / 2), r2(cy - w / 2), r2(w)]; seRefresh();
}
function seToggleSnap() { SE.snap = !SE.snap; PREFS.seSnap = SE.snap; savePrefs(); seDraw(); flash('Snap to grid ' + (SE.snap ? 'on' : 'off')); }
function seKey(e) {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (e.key === 'Enter') { e.preventDefault(); return; }
  if (k === ' ') { SE.space = true; stop(); return; }
  if ((k === 'delete' || k === 'backspace') && SE.sel.length) { stop(); seDelete(); }
  else if (c && k === 'z') { stop(); e.shiftKey ? seRedo() : seUndo(); }
  else if (c && k === 'y') { stop(); seRedo(); }
  else if (c && k === 'd') { stop(); seDuplicate(); }
  else if (c && k === 'a') { stop(); SE.sel = seAll(); seDraw(); }
  else if (!c && k === 'g') { stop(); if (e.shiftKey) seAlign(); else seToggleSnap(); }
  else if (!c && k === 'r') { stop(); seTransform('rot'); }
  else if (!c && k === 'm') { stop(); seTransform('mir'); }
  else if (!c && k === 'f') { stop(); seFit(); }
  else if (k === 'escape') { stop(); if (SE.drag) { SE.drag = null; seRefresh(); } else if (SE.tool !== 'select') { SE.tool = 'select'; seDraw(); } else if (SE.sel.length) { SE.sel = []; seDraw(); } else $('#dlg').close('cancel'); }
  else if (k.startsWith('arrow')) { stop(); const n = e.shiftKey ? 4 : 1; seNudge(k === 'arrowleft' ? -n : k === 'arrowright' ? n : 0, k === 'arrowup' ? -n : k === 'arrowdown' ? n : 0); }
}

// ---------- mouse ----------
function seWire() {
  const cv = $('#secv');
  cv.onmousedown = e => {
    e.preventDefault(); cv.focus({ preventScroll: true }); SE.focused = true;
    const [x, y] = sePt(e); const d = SE.def;
    if (e.button === 1 || (e.button === 0 && SE.space)) { SE.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, v: SE.view.slice(), k: SE.view[2] / cv.getBoundingClientRect().width }; return; }
    if (e.button !== 0) return;
    if (SE.tool === 'select') {
      const gp = e.target.closest('[data-seg]');
      if (gp) { const [i, gid] = gp.dataset.seg.split(':'); sePush(); SE.drag = { mode: 'grip', i: +i, gid, orig: clone(d.shapes[+i]) }; return; }
      const si = e.target.closest('[data-si]'), ci = e.target.closest('[data-ci]');
      const key = ci ? 'c' + ci.dataset.ci : si ? 's' + si.dataset.si : null;
      if (!key) { if (!e.shiftKey) SE.sel = []; SE.drag = { mode: 'box', start: [x, y], cur: [x, y], add: e.shiftKey }; seDraw(); return; }
      if (e.shiftKey || e.ctrlKey) { SE.sel = seHas(key) ? SE.sel.filter(k => k !== key) : SE.sel.concat(key); seDraw(); return; }
      if (!seHas(key)) SE.sel = [key];
      const items = seSelected();
      SE.drag = { mode: 'move', start: [x, y], orig: clone(items.map(o => o.c || o.sh)), conn: items.some(o => o.c), last: [0, 0], pushed: false };
      seDraw(); return;
    }
    if (SE.tool === 'text') { const t = prompt('Text:', ''); if (t) { sePush(); d.shapes.push({ t: 'text', x: seG(x), y: seG(y), s: t, size: 2.5 }); SE.sel = ['s' + (d.shapes.length - 1)]; } seDraw(); return; }
    if (SE.tool === 'conn') {
      const nx = s4(x), ny = s4(y);
      if (d.conns.some(c => c[0] === nx && c[1] === ny)) { flash('There is already a connection point there'); return; }
      const lab = prompt('Connection point designation (e.g. 1, A1, H):', String(d.conns.length + 1));
      if (lab != null) { sePush(); d.conns.push([nx, ny, lab]); SE.sel = ['c' + (d.conns.length - 1)]; }
      seDraw(); return;
    }
    SE.drag = { mode: 'draw', start: [seG(x), seG(y)], cur: [seG(x), seG(y)] };
  };
  cv.onmousemove = e => {
    if (!SE.drag) return;
    const [x, y] = sePt(e); const d = SE.def; const g = SE.drag; const u = SE.view[2] / 52;
    if (g.mode === 'pan') { SE.view = [r2(g.v[0] - (e.clientX - g.sx) * g.k), r2(g.v[1] - (e.clientY - g.sy) * g.k), g.v[2]]; seRefresh(); return; }
    if (g.mode === 'grip') { const sh = d.shapes[g.i]; Object.assign(sh, clone(g.orig)); seGripTo(sh, g.gid, g.orig, [seG(x), seG(y)]); seRefresh(); return; }
    if (g.mode === 'box') {
      g.cur = [x, y]; const [a, b] = g.start; const cross = x < a;
      g.preview = `<rect x="${Math.min(a, x)}" y="${Math.min(b, y)}" width="${Math.abs(x - a)}" height="${Math.abs(y - b)}" fill="${cross ? 'rgba(46,160,67,.08)' : 'rgba(31,111,255,.08)'}" stroke="${cross ? '#2ea043' : '#1f6fff'}" stroke-width="${0.15 * u}" ${cross ? `stroke-dasharray="${0.8 * u},${0.5 * u}"` : ''}/>`;
      seRefresh(); return;
    }
    if (g.mode === 'move') {
      const st = g.conn ? 4 : (SE.snap ? SE.grid : 0.01); const q = v => r2(Math.round(v / st) * st);
      const dx = q(x - g.start[0]), dy = q(y - g.start[1]);
      if (dx === g.last[0] && dy === g.last[1]) return; g.last = [dx, dy];
      if (!g.pushed) { sePush(); g.pushed = true; }
      seSelected().forEach((o, j) => {
        const src = g.orig[j];
        if (o.c) { o.c[0] = r2(src[0] + dx); o.c[1] = r2(src[1] + dy); }
        else { const sh = clone(src); seMoveShape(sh, dx, dy); d.shapes[o.q.i] = sh; }
      });
      seRefresh(); return;
    }
    g.cur = [seG(x), seG(y)];
    const [a, b] = g.start, [c, dd] = g.cur;
    g.preview = SE.tool === 'line' ? `<path d="M${a},${b}L${c},${dd}" stroke="#1f6fff" stroke-width="0.35"/>`
      : SE.tool === 'rect' ? `<rect x="${Math.min(a, c)}" y="${Math.min(b, dd)}" width="${Math.abs(c - a)}" height="${Math.abs(dd - b)}" fill="none" stroke="#1f6fff" stroke-width="0.35"/>`
      : `<circle cx="${a}" cy="${b}" r="${r2(Math.hypot(c - a, dd - b))}" fill="none" stroke="#1f6fff" stroke-width="0.35"/>`;
    seRefresh();
  };
  cv.onmouseup = () => {
    const g = SE.drag; SE.drag = null; if (!g) return;
    if (g.mode === 'pan') return;
    if (g.mode === 'grip') { const sh = SE.def.shapes[g.i]; if (JSON.stringify(sh) === JSON.stringify(g.orig)) SE.undo.pop(); seDraw(); return; }
    if (g.mode === 'box') {
      const [a, b] = g.start, [c, dd] = g.cur; const r = [Math.min(a, c), Math.min(b, dd), Math.max(a, c), Math.max(b, dd)];
      if (r[2] - r[0] > 0.3 || r[3] - r[1] > 0.3) {
        const cross = c < a, hit = [];
        const inR = bx => bx[0] >= r[0] && bx[2] <= r[2] && bx[1] >= r[1] && bx[3] <= r[3];
        const touch = bx => bx[0] <= r[2] && bx[2] >= r[0] && bx[1] <= r[3] && bx[3] >= r[1];
        SE.def.shapes.forEach((sh, i) => { const bx = seBox(sh); if (cross ? touch(bx) : inR(bx)) hit.push('s' + i); });
        SE.def.conns.forEach((cn, i) => { const bx = [cn[0], cn[1], cn[0], cn[1]]; if (cross ? touch(bx) : inR(bx)) hit.push('c' + i); });
        SE.sel = g.add ? [...new Set(SE.sel.concat(hit))] : hit;
      }
      seDraw(); return;
    }
    if (g.mode === 'draw') {
      const [a, b] = g.start, [c, dd] = g.cur; const d = SE.def; const n0 = d.shapes.length;
      sePush();
      if (SE.tool === 'line' && (a !== c || b !== dd)) d.shapes.push({ t: 'line', x1: a, y1: b, x2: c, y2: dd });
      if (SE.tool === 'rect' && a !== c && b !== dd) d.shapes.push({ t: 'rect', x: Math.min(a, c), y: Math.min(b, dd), w: r2(Math.abs(c - a)), h: r2(Math.abs(dd - b)) });
      if (SE.tool === 'circle') { const r = r2(Math.hypot(c - a, dd - b)); if (r > 0) d.shapes.push({ t: 'circle', cx: a, cy: b, r }); }
      if (d.shapes.length === n0) SE.undo.pop(); else SE.sel = ['s' + (d.shapes.length - 1)];
    }
    seDraw();
  };
  cv.onfocus = () => { SE.focused = true; };
  cv.onblur = e => { if (e.relatedTarget && e.relatedTarget !== document.body) SE.focused = false; };
  cv.onwheel = e => {
    e.preventDefault(); const [x, y] = sePt(e); const k = e.deltaY > 0 ? 1.2 : 1 / 1.2; const [vx, vy, vw] = SE.view;
    const w = Math.max(6, Math.min(200, vw * k)), f = w / vw; SE.view = [r2(x - (x - vx) * f), r2(y - (y - vy) * f), r2(w)]; seRefresh();
  };
  cv.onauxclick = e => { if (e.button === 1) e.preventDefault(); };
  $('#dlgbody').onclick = e => {
    const t = e.target.closest('[data-setool]'); if (t) { SE.tool = t.dataset.setool; seDraw(); return; }
    const b = e.target.closest('[data-seb]'); if (!b) return;
    const op = b.dataset.seb;
    if (op === 'del') seDelete(); else if (op === 'snap') seToggleSnap(); else if (op === 'align') seAlign();
    else if (op === 'rot' || op === 'mir') seTransform(op); else if (op === 'dup') seDuplicate();
    else if (op === 'undo') seUndo(); else if (op === 'redo') seRedo(); else if (op === 'fit') seFit();
  };
  $('#dlgbody').onchange = e => {
    const k = e.target.dataset.se; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const [scope, key] = k.split('.'); const d = SE.def; const one = seOne();
    if (scope === 'v') { SE.grid = parseFloat(v) || 0.5; PREFS.seGrid = SE.grid; savePrefs(); seDraw(); return; }
    sePush();
    if (scope === 'd') d[key] = key === 'prefix' ? String(v).trim().toUpperCase() : v;
    else if (scope === 's' && one && one.kind === 'shape') { const sh = d.shapes[one.i]; sh[key] = key === 'size' || key === 'sw' ? (parseFloat(v) || undefined) : v; }
    else if (scope === 'g' && one && one.kind === 'shape') { const sh = d.shapes[one.i]; const n = parseFloat(v); if (isFinite(n)) { sh[key] = r2(key === 'r' || key === 'w' || key === 'h' ? Math.max(key === 'r' ? 0.25 : 0, n) : n); } }
    else if (scope === 'k' && one && one.kind === 'conn') { const n = parseFloat(v); if (isFinite(n)) d.conns[one.i][+key] = s4(n); }
    else if (scope === 'c' && one && one.kind === 'conn') d.conns[one.i][2] = v;
    else SE.undo.pop();
    seDraw();
  };
}
function saveSymbolDef(def) {
  if (!def.name) def.name = 'Custom symbol';
  if (!def.shapes.length && !def.conns.length) { alert('The symbol is empty, nothing was saved.'); return; }
  const i = LIB.symbols.findIndex(s => s.key === def.key);
  if (i >= 0) LIB.symbols[i] = def; else LIB.symbols.push(def);
  saveLibrary(); registerUserSym(def);
  if (P.userSyms && P.userSyms[def.key]) P.userSyms[def.key] = def;
  symKey = ''; render(); flash('Saved "' + def.name + '" to your symbol library');
}
function newSymbol() {
  symbolEditor({ key: 'u_' + uid(), name: 'New symbol', cat: 'My symbols', prefix: 'A', role: 'main', contact: '', home: false, fpIcon: '',
    shapes: [{ t: 'rect', x: -4, y: -4, w: 8, h: 8 }, { t: 'line', x1: 0, y1: -8, x2: 0, y2: -4 }, { t: 'line', x1: 0, y1: 4, x2: 0, y2: 8 }],
    conns: [[0, -8, '1'], [0, 8, '2']] }, true);
}
function copySymbol(key) { symbolEditor(defFromBuiltin(key), true); }
function editSymbol(key) {
  const d = LIB.symbols.find(s => s.key === key) || (P.userSyms || {})[key];
  if (!d) { alert('This symbol came with the project file. Use Copy to add it to your library first.'); return; }
  symbolEditor(d, false);
}
function deleteSymbol(key) {
  const used = [...allItems()].some(it => it.sym === key);
  if (!confirm(`Delete "${SYM[key].name}" from your symbol library?` + (used ? '\n\nIt is used in this project. Those devices keep working because the project carries a copy.' : ''))) return;
  if (used) { P.userSyms = P.userSyms || {}; P.userSyms[key] = LIB.symbols.find(s => s.key === key); }
  LIB.symbols = LIB.symbols.filter(s => s.key !== key); saveLibrary();
  if (!used) delete SYM[key];
  symKey = ''; render();
}
function symbolLibrary() {
  const rows = LIB.symbols.map(s => `<div class="msg" style="cursor:default"><span style="flex:1">${esc(s.name)} <span class="note">${esc(s.cat || '')}${s.prefix ? ' · ' + esc(s.prefix) : ''}${s.lib ? ' · ' + esc(s.lib) : ''}</span></span>
    <button type="button" class="btn small" data-lib="edit:${s.key}">Edit</button><button type="button" class="btn small" data-lib="copy:${s.key}">Copy</button><button type="button" class="btn small" data-lib="del:${s.key}">Delete</button></div>`).join('');
  const builtins = SYMORDER.filter(k => !SYM[k].user).map(k => `<option value="${k}">${esc(SYM[k].cat)}: ${esc(SYM[k].name)}</option>`).join('');
  dialog('Symbol library', [], null, 'OK', `<div class="sub">Your symbols are stored in the OpenSchem Data folder next to the program, and projects carry a copy of every custom symbol they use.</div>
    <div class="btnrow" style="margin-bottom:8px"><button type="button" class="btn small primary" data-lib="new">New symbol</button>
    <select id="libsrc" style="max-width:260px">${builtins}</select><button type="button" class="btn small" data-lib="copybi">Copy and modify</button>
    <button type="button" class="btn small" data-lib="export">Export library</button><button type="button" class="btn small" data-lib="import">Import library</button></div>
    ${rows || '<div class="note">No custom symbols yet. Start with New symbol, or copy a built-in one.</div>'}`);
  $('#dlg').style.width = '720px';
  $('#dlgbody').onclick = async e => {
    const b = e.target.closest('[data-lib]'); if (!b) return;
    const [op, key] = b.dataset.lib.split(':');
    if (op === 'new') { $('#dlg').close(); newSymbol(); }
    else if (op === 'copybi') { const k = $('#libsrc').value; $('#dlg').close(); copySymbol(k); }
    else if (op === 'edit') { $('#dlg').close(); editSymbol(key); }
    else if (op === 'copy') { $('#dlg').close(); copySymbol(key); }
    else if (op === 'del') { deleteSymbol(key); $('#dlg').close(); symbolLibrary(); }
    else if (op === 'export') { const p = await host.saveFile(JSON.stringify(LIB, null, 1), 'OpenSchem symbols.oslib', 'OpenSchem symbol library', 'oslib'); if (p) flash('Exported ' + p); }
    else if (op === 'import') {
      const r = await host.openText('OpenSchem symbol library', 'oslib'); if (!r) return;
      try {
        const inc = JSON.parse(r.content).symbols || []; let n = 0;
        for (const d of inc) { if (!d.key) continue; const i = LIB.symbols.findIndex(s => s.key === d.key); if (i >= 0) LIB.symbols[i] = d; else LIB.symbols.push(d); registerUserSym(d); n++; }
        saveLibrary(); symKey = ''; render(); $('#dlg').close(); symbolLibrary(); flash(`Imported ${n} symbol(s)`);
      } catch (err) { alert('That file is not an OpenSchem symbol library.'); }
    }
  };
}

// ---------- symbols tab: search and collapsible categories ----------
function renderSymbols() {
  const fp = P && isFloor(page());
  const all = SYMORDER.concat(userKeys().filter(k => !SYMORDER.includes(k)));
  const q = symQuery.trim().toLowerCase();
  // the project's standard comes first; the other standard is shown on request, in its own categories
  const std = projStd(), oth = otherStd(std), showOth = !!PREFS.showOtherStd;
  const catOf = k => SYM[k].std === oth ? oth + ': ' + SYM[k].cat : SYM[k].cat;
  const keys = all.filter(k => SYM[k] && (fp ? SYM[k].fp : (!SYM[k].ind || !P || S().industrial)) && (fp || SYM[k].std !== oth || showOth))
    .filter(k => !q || `${SYM[k].name} ${catOf(k)} ${SYM[k].prefix || ''} ${k}`.toLowerCase().includes(q));
  const pneuFirst = !fp && isPneuPage(page());
  const ordered = pneuFirst ? keys.filter(k => SYM[k].pneu).concat(keys.filter(k => !SYM[k].pneu)) : keys;
  const cats = []; for (const k of ordered) { const c = catOf(k); if (!cats.includes(c)) cats.push(c); }
  let s = `<input class="search" id="symsearch" placeholder="Search symbols" value="${esc(symQuery)}">`;
  if (!fp && (!P || S().industrial)) s += `<label class="symother"><input type="checkbox" id="symother" ${showOth ? 'checked' : ''}> Show ${oth} symbols too <span class="note">(project: ${std})</span></label>`;
  s += '<div class="navbtns"><button class="btn small" data-act="newSymbol">New symbol</button><button class="btn small" data-act="symbolLibrary">Library...</button></div>';
  if (fp) s += '<div class="note" style="padding:0 10px 4px">Click a symbol, then click on the floor plan. Right-click a symbol to copy and modify it.</div>';
  for (const c of cats) {
    const open = q ? true : PREFS.symOpen[c] !== false;
    s += `<div class="symcat sc-h" data-symcat="${esc(c)}"><span class="caret">${open ? '▾' : '▸'}</span>${esc(c)}</div>`;
    if (!open) continue;
    s += '<div class="symgrid">';
    for (const k of ordered.filter(k => catOf(k) === c)) s += `<div class="symcard${mode === 'place' && placeSym === k ? ' on' : ''}" data-sym="${k}" title="${esc(SYM[k].name)}">${fp ? fpIcon(k).replace('width:20px;height:20px', 'width:40px;height:40px') : symPreview(k)}<span>${esc(SYM[k].name)}</span></div>`;
    s += '</div>';
  }
  if (!keys.length) s += '<div class="note" style="padding:8px 10px">No symbols match.</div>';
  if (!fp && !q) s += '<div class="symcat">Other</div><div class="navbtns"><button class="btn small" data-act="wireMode">Connection (W)</button><button class="btn small" data-act="textMode">Text (T)</button></div>';
  $('#tab-symbols').innerHTML = s;
  const so = $('#symother'); if (so) so.onchange = () => { PREFS.showOtherStd = so.checked; savePrefs(); renderSymbols(); };
  const inp = $('#symsearch');
  inp.oninput = () => { symQuery = inp.value; renderSymbols(); const n = $('#symsearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
}
document.addEventListener('click', e => {
  const h = e.target.closest('[data-symcat]'); if (!h) return;
  const c = h.dataset.symcat; PREFS.symOpen[c] = PREFS.symOpen[c] === false; savePrefs(); renderSymbols();
});
$('#tab-symbols').addEventListener('contextmenu', e => {
  const card = e.target.closest('[data-sym]'); if (!card) return;
  e.preventDefault(); ctxSym = card.dataset.sym;
  const dd = $('#dropdown'); const user = SYM[ctxSym].user;
  dd.innerHTML = `<div class="dd" data-act="symCopy"><span>Copy and modify...</span></div>` + (user ? '<div class="dd" data-act="symEdit"><span>Edit...</span></div><div class="dd" data-act="symDelete"><span>Delete from library</span></div>' : '');
  dd.style.left = e.clientX + 'px'; dd.style.top = e.clientY + 'px'; dd.classList.remove('hidden');
});
