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
    res: !!def.home, fp: !!def.fpIcon, fpAs: def.fpIcon || undefined, user: true,
    conns: (def.conns || []).map(c => [c[0], c[1], c[2] || '']), box: [box[0] - 0.5, box[1] - 0.5, box[2] + 0.5, box[3] + 0.5],
    draw: () => shapesSVG(def.shapes),
    texts: () => (def.shapes || []).filter(s => s.t === 'text').map(s => [s.x, s.y, s.s, s.size || 2.5, !!s.bold]),
  };
}
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
    contact: d.contact && !d.fixed ? d.contact : '', home: !!d.res, fpIcon: d.fp ? (d.fpAs || key) : '', shapes: builtinToShapes(key), conns: clone(d.conns) };
}

// ---------- symbol editor ----------
let SE = null;
function symbolEditor(def, isNew) {
  SE = { def: clone(def), tool: 'select', sel: null, drag: null, isNew };
  dialog(isNew ? 'New symbol' : 'Edit symbol', [], () => saveSymbolDef(SE.def), 'Save to library');
  const dlg = $('#dlg'); dlg.style.width = '1040px'; dlg.style.maxWidth = '97vw';
  seDraw();
  dlg.onkeydown = e => {
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && SE.sel) { e.preventDefault(); seDelete(); }
    if (e.key === 'Enter') e.preventDefault();
  };
}
const SE_TOOLS = [['select', 'Select'], ['line', 'Line'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['text', 'Text'], ['conn', 'Connection point']];
function seDraw() {
  const d = SE.def; const sel = SE.sel;
  const field = (k, label, v, type = 'text', opts) => type === 'select'
    ? `<div class="prow"><label>${label}</label><select data-se="${k}">${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>`
    : type === 'check' ? `<div class="prow"><label>${label}</label><input type="checkbox" data-se="${k}" ${v ? 'checked' : ''}></div>`
    : `<div class="prow"><label>${label}</label><input data-se="${k}" value="${esc(v ?? '')}" ${type === 'number' ? 'type="number" step="0.1"' : ''}></div>`;
  let selHTML = '<div class="note">Select a line, shape, text or connection point to edit it. Delete removes it.</div>';
  if (sel && sel.kind === 'shape') {
    const sh = d.shapes[sel.i];
    selHTML = `<div class="note" style="margin-bottom:4px">${{ line: 'Line', rect: 'Rectangle', circle: 'Circle', text: 'Text', path: 'Path (copied curve)' }[sh.t]}</div>`;
    if (sh.t === 'text') selHTML += field('s.s', 'Text', sh.s) + field('s.size', 'Height (mm)', sh.size || 2.5, 'number') + field('s.bold', 'Bold', sh.bold, 'check');
    else { selHTML += field('s.dash', 'Dashed', sh.dash, 'check'); if (sh.t !== 'line') selHTML += field('s.fill', 'Filled', sh.fill, 'check'); selHTML += field('s.sw', 'Line width', sh.sw || 0.35, 'number'); }
    selHTML += '<div class="btnrow"><button type="button" class="btn small" data-seb="del">Delete</button></div>';
  } else if (sel && sel.kind === 'conn') {
    const c = d.conns[sel.i];
    selHTML = `<div class="note" style="margin-bottom:4px">Connection point at X ${c[0]}, Y ${c[1]}</div>${field('c.label', 'Designation', c[2])}<div class="btnrow"><button type="button" class="btn small" data-seb="del">Delete</button></div>`;
  }
  $('#dlgbody').innerHTML = `<div class="se">
    <div class="se-left">
      <h4>Symbol</h4>
      ${field('d.name', 'Name', d.name)}${field('d.cat', 'Category', d.cat || 'My symbols')}
      ${field('d.prefix', 'Tag prefix', d.prefix)}
      ${field('d.role', 'Function', d.role || 'main', 'select', [['main', 'Main function'], ['aux', 'Auxiliary function']])}
      ${field('d.contact', 'Contact type', d.contact || '', 'select', [['', 'None (fixed numbers)'], ['NO', 'NO (auto 13/14, 23/24)'], ['NC', 'NC (auto 11/12, 21/22)']])}
      ${field('d.home', 'Home device', d.home, 'check')}
      ${field('d.fpIcon', 'Floor-plan icon', d.fpIcon || '', 'select', FP_ICON_OPTS)}
      <div class="note">Tag prefix empty = no device tag (like a ground symbol). Home devices use whole-house numbering and circuit colors.</div>
      <h4>Selected</h4>${selHTML}
    </div>
    <div class="se-mid">
      <div class="se-tools">${SE_TOOLS.map(([t, l]) => `<button type="button" class="btn small${SE.tool === t ? ' primary' : ''}" data-setool="${t}">${l}</button>`).join('')}</div>
      <svg id="secv" viewBox="-26 -26 52 52">${seCanvas()}</svg>
      <div class="note">Connection points snap to the 4 mm grid. Graphics snap to 0.5 mm. The cross marks the insertion point.</div>
    </div></div>`;
  seWire();
}
function seCanvas() {
  const d = SE.def; let s = '';
  for (let v = -24; v <= 24; v += 1) {
    const major = v % 4 === 0;
    s += `<line x1="${v}" y1="-24" x2="${v}" y2="24" stroke="${major ? '#c9d3e0' : '#eef1f5'}" stroke-width="${major ? 0.08 : 0.05}"/><line x1="-24" y1="${v}" x2="24" y2="${v}" stroke="${major ? '#c9d3e0' : '#eef1f5'}" stroke-width="${major ? 0.08 : 0.05}"/>`;
  }
  s += '<path d="M-2,0H2M0,-2V2" stroke="#e0332b" stroke-width="0.15"/>';
  d.shapes.forEach((sh, i) => {
    const on = SE.sel && SE.sel.kind === 'shape' && SE.sel.i === i;
    const col = on ? '#1f6fff' : '#000';
    if (sh.t === 'text') s += `<text x="${sh.x}" y="${sh.y + (sh.size || 2.5) * 0.35}" font-size="${sh.size || 2.5}" text-anchor="middle" font-family="Arial" ${sh.bold ? 'font-weight="bold"' : ''} fill="${col}" data-si="${i}" style="cursor:move">${esc(sh.s)}</text>`;
    else s += `<g data-si="${i}" style="color:${col};cursor:move"><g class="sym se-sh" style="stroke:${col}">${shapesSVG([sh])}</g><g class="se-hit">${shapesSVG([Object.assign({}, sh, { fill: false, dash: false, sw: 1.6 })])}</g></g>`;
  });
  d.conns.forEach((c, i) => {
    const on = SE.sel && SE.sel.kind === 'conn' && SE.sel.i === i;
    s += `<g data-ci="${i}" style="cursor:move"><circle cx="${c[0]}" cy="${c[1]}" r="0.9" fill="${on ? '#1f6fff' : '#e0332b'}" fill-opacity="0.85"/><text x="${c[0] + 1.2}" y="${c[1] - 1}" font-size="1.8" font-family="Arial" fill="#c0261e">${esc(c[2] || '')}</text></g>`;
  });
  if (SE.drag && SE.drag.preview) s += SE.drag.preview;
  return s;
}
function sePt(e) {
  const cv = $('#secv'); const pt = cv.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(cv.getScreenCTM().inverse()); return [q.x, q.y];
}
const s05 = v => Math.round(v * 2) / 2, s4 = v => Math.round(v / 4) * 4;
function seRefresh() { const cv = $('#secv'); if (cv) cv.innerHTML = seCanvas(); }
function seMoveShape(sh, dx, dy) {
  if (sh.t === 'line') { sh.x1 += dx; sh.x2 += dx; sh.y1 += dy; sh.y2 += dy; }
  else if (sh.t === 'rect' || sh.t === 'text') { sh.x += dx; sh.y += dy; }
  else if (sh.t === 'circle') { sh.cx += dx; sh.cy += dy; }
  else if (sh.t === 'path') { sh.ox = (sh.ox || 0) + dx; sh.oy = (sh.oy || 0) + dy; }
}
function seWire() {
  const cv = $('#secv');
  cv.onmousedown = e => {
    e.preventDefault();
    const [x, y] = sePt(e); const d = SE.def;
    if (SE.tool === 'select') {
      const si = e.target.closest('[data-si]'), ci = e.target.closest('[data-ci]');
      if (ci) SE.sel = { kind: 'conn', i: +ci.dataset.ci };
      else if (si) SE.sel = { kind: 'shape', i: +si.dataset.si };
      else { SE.sel = null; seDraw(); return; }
      SE.drag = { mode: 'move', start: [x, y], orig: clone(SE.sel.kind === 'conn' ? d.conns[SE.sel.i] : d.shapes[SE.sel.i]), last: [0, 0] };
      seDraw(); return;
    }
    if (SE.tool === 'text') { const t = prompt('Text:', ''); if (t) { d.shapes.push({ t: 'text', x: s05(x), y: s05(y), s: t, size: 2.5 }); SE.sel = { kind: 'shape', i: d.shapes.length - 1 }; } seDraw(); return; }
    if (SE.tool === 'conn') {
      const nx = s4(x), ny = s4(y);
      if (d.conns.some(c => c[0] === nx && c[1] === ny)) { flash('There is already a connection point there'); return; }
      const lab = prompt('Connection point designation (e.g. 1, A1, H):', String(d.conns.length + 1));
      if (lab != null) { d.conns.push([nx, ny, lab]); SE.sel = { kind: 'conn', i: d.conns.length - 1 }; }
      seDraw(); return;
    }
    SE.drag = { mode: 'draw', start: [s05(x), s05(y)], cur: [s05(x), s05(y)] };
  };
  cv.onmousemove = e => {
    if (!SE.drag) return;
    const [x, y] = sePt(e); const d = SE.def; const g = SE.drag;
    if (g.mode === 'move') {
      const conn = SE.sel.kind === 'conn';
      const dx = conn ? s4(x - g.start[0]) : s05(x - g.start[0]), dy = conn ? s4(y - g.start[1]) : s05(y - g.start[1]);
      if (dx === g.last[0] && dy === g.last[1]) return; g.last = [dx, dy];
      if (conn) d.conns[SE.sel.i] = [g.orig[0] + dx, g.orig[1] + dy, g.orig[2]];
      else { const sh = clone(g.orig); seMoveShape(sh, dx, dy); d.shapes[SE.sel.i] = sh; }
      seRefresh(); return;
    }
    g.cur = [s05(x), s05(y)];
    const [a, b] = g.start, [c, dd] = g.cur;
    g.preview = SE.tool === 'line' ? `<path d="M${a},${b}L${c},${dd}" stroke="#1f6fff" stroke-width="0.35"/>`
      : SE.tool === 'rect' ? `<rect x="${Math.min(a, c)}" y="${Math.min(b, dd)}" width="${Math.abs(c - a)}" height="${Math.abs(dd - b)}" fill="none" stroke="#1f6fff" stroke-width="0.35"/>`
      : `<circle cx="${a}" cy="${b}" r="${r2(Math.hypot(c - a, dd - b))}" fill="none" stroke="#1f6fff" stroke-width="0.35"/>`;
    seRefresh();
  };
  cv.onmouseup = () => {
    const g = SE.drag; SE.drag = null; if (!g) return;
    if (g.mode === 'draw') {
      const [a, b] = g.start, [c, dd] = g.cur; const d = SE.def;
      if (SE.tool === 'line' && (a !== c || b !== dd)) d.shapes.push({ t: 'line', x1: a, y1: b, x2: c, y2: dd });
      if (SE.tool === 'rect' && a !== c && b !== dd) d.shapes.push({ t: 'rect', x: Math.min(a, c), y: Math.min(b, dd), w: Math.abs(c - a), h: Math.abs(dd - b) });
      if (SE.tool === 'circle') { const r = r2(Math.hypot(c - a, dd - b)); if (r > 0) d.shapes.push({ t: 'circle', cx: a, cy: b, r }); }
      SE.sel = { kind: 'shape', i: d.shapes.length - 1 };
    }
    seDraw();
  };
  $('#dlgbody').onclick = e => {
    const t = e.target.closest('[data-setool]'); if (t) { SE.tool = t.dataset.setool; seDraw(); return; }
    const b = e.target.closest('[data-seb]'); if (b && b.dataset.seb === 'del') seDelete();
  };
  $('#dlgbody').onchange = e => {
    const k = e.target.dataset.se; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const [scope, key] = k.split('.'); const d = SE.def;
    if (scope === 'd') d[key] = key === 'prefix' ? String(v).trim().toUpperCase() : v;
    else if (scope === 's' && SE.sel) { const sh = d.shapes[SE.sel.i]; sh[key] = key === 'size' || key === 'sw' ? (parseFloat(v) || undefined) : v; }
    else if (scope === 'c' && SE.sel) d.conns[SE.sel.i][2] = v;
    seDraw();
  };
}
function seDelete() {
  if (!SE.sel) return;
  if (SE.sel.kind === 'conn') SE.def.conns.splice(SE.sel.i, 1); else SE.def.shapes.splice(SE.sel.i, 1);
  SE.sel = null; seDraw();
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
  const rows = LIB.symbols.map(s => `<div class="msg" style="cursor:default"><span style="flex:1">${esc(s.name)} <span class="note">${esc(s.cat || '')}${s.prefix ? ' · ' + esc(s.prefix) : ''}</span></span>
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
  const keys = all.filter(k => SYM[k] && (fp ? SYM[k].fp : (!SYM[k].ind || !P || S().industrial)))
    .filter(k => !q || `${SYM[k].name} ${SYM[k].cat} ${SYM[k].prefix || ''} ${k}`.toLowerCase().includes(q));
  const cats = []; for (const k of keys) { const c = SYM[k].cat; if (!cats.includes(c)) cats.push(c); }
  let s = `<input class="search" id="symsearch" placeholder="Search symbols" value="${esc(symQuery)}">`;
  s += '<div class="navbtns"><button class="btn small" data-act="newSymbol">New symbol</button><button class="btn small" data-act="symbolLibrary">Library...</button></div>';
  if (fp) s += '<div class="note" style="padding:0 10px 4px">Click a symbol, then click on the floor plan. Right-click a symbol to copy and modify it.</div>';
  for (const c of cats) {
    const open = q ? true : PREFS.symOpen[c] !== false;
    s += `<div class="symcat sc-h" data-symcat="${esc(c)}"><span class="caret">${open ? '▾' : '▸'}</span>${esc(c)}</div>`;
    if (!open) continue;
    s += '<div class="symgrid">';
    for (const k of keys.filter(k => SYM[k].cat === c)) s += `<div class="symcard${mode === 'place' && placeSym === k ? ' on' : ''}" data-sym="${k}" title="${esc(SYM[k].name)}">${fp ? fpIcon(k).replace('width:20px;height:20px', 'width:40px;height:40px') : symPreview(k)}<span>${esc(SYM[k].name)}</span></div>`;
    s += '</div>';
  }
  if (!keys.length) s += '<div class="note" style="padding:8px 10px">No symbols match.</div>';
  if (!fp && !q) s += '<div class="symcat">Other</div><div class="navbtns"><button class="btn small" data-act="wireMode">Connection (W)</button><button class="btn small" data-act="textMode">Text (T)</button></div>';
  $('#tab-symbols').innerHTML = s;
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
