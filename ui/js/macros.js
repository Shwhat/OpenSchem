// ---------- inserting content (paste and macros) ----------
function insertContent(src, dx, dy, pg, assignFL) {
  const tagMap = new Map(), ns = new Set(), idMap = new Map();
  const tmp = [];
  for (const s0 of src.items || []) {
    const it = clone(s0); const oldId = it.id; it.id = uid(); idMap.set(oldId, it.id); it.x += dx; it.y += dy;
    const d = SYM[it.sym];
    if (assignFL && d && d.prefix) {
      if (!d.res || !it.loc) it.loc = pg.loc || '';
      it.fn = pg.fn || '';
    }
    if (d && d.prefix && it.tag && it.sym !== 'term' && d.role !== 'plc') {
      const k = devKey(s0) + (assignFL ? '|m' : '');
      if (!tagMap.has(k)) {
        const m = /^([A-Za-z]+)\d*$/.exec(it.tag);
        const nt = nextTag(it.fn, it.loc, m ? m[1] : d.prefix, d.res);
        tagMap.set(k, nt);
        const t = { id: '__tmp', sym: 'box', fn: it.fn, loc: it.loc, tag: nt, x: -999, y: -999 }; tmp.push(t); pg.items.push(t);
      }
      it.tag = tagMap.get(k);
    }
    if (d && d.brk) it.slot = nextSlot();
    if (it.sym === 'term') it.tn = nextTerminal(it.fn, it.loc, it.tag);
    pg.items.push(it); ns.add(it.id);
  }
  pg.items = pg.items.filter(i => i.id !== '__tmp');
  for (const s0 of src.wires || []) { const w = clone(s0); w.id = uid(); w.pts = w.pts.map(p => [r2(p[0] + dx), r2(p[1] + dy)]); delete w.no; pg.wires.push(w); ns.add(w.id); }
  pg.cables = pg.cables || [];
  for (const s0 of src.cables || []) {
    const c = clone(s0); c.id = uid(); c.x1 += dx; c.x2 += dx; c.y1 += dy; c.y2 += dy; c.tag = nextCableTag(); c.cond = {};
    if (assignFL) { c.fn = pg.fn || ''; c.loc = pg.loc || ''; }
    pg.cables.push(c); ns.add(c.id);
  }
  pg.gfx = pg.gfx || [];
  for (const s0 of src.gfx || []) { const g = clone(s0); g.id = uid(); g.pts = g.pts.map(p => [r2(p[0] + dx), r2(p[1] + dy)]); pg.gfx.push(g); ns.add(g.id); }
  return ns;
}

// ---------- macros ----------
function saveMacro() {
  const pg = page(); if (isFloor(pg) || pg.report) { flash('Open a schematic page and select what to save'); return; }
  const items = pg.items.filter(i => sel.has(i.id)), wires = pg.wires.filter(w => sel.has(w.id)), cables = (pg.cables || []).filter(c => sel.has(c.id)), gfx = (pg.gfx || []).filter(g => sel.has(g.id) && g.t !== 'image');
  if (!items.length && !wires.length && !gfx.length) { flash('Select the symbols and connections to save as a macro first'); return; }
  const xs = [], ys = [];
  for (const it of items) { const b = itemBox(it); xs.push(b[0]); ys.push(b[1]); }
  for (const w of wires) for (const p of w.pts) { xs.push(p[0]); ys.push(p[1]); }
  for (const g of gfx) { const b = gfxBox(g); xs.push(b[0]); ys.push(b[1]); }
  const ox = Math.floor(Math.min(...xs) / 4) * 4, oy = Math.floor(Math.min(...ys) / 4) * 4;
  dialog('Save selection as macro', [['name', 'Macro name', ''], ['desc', 'Description', '']], v => {
    if (!v.name) { alert('Enter a name for the macro.'); return false; }
    const m = {
      id: 'm_' + uid(), name: v.name, desc: v.desc,
      items: items.map(i => { const c = clone(i); c.x = r2(c.x - ox); c.y = r2(c.y - oy); return c; }),
      wires: wires.map(w => { const c = clone(w); c.pts = c.pts.map(p => [r2(p[0] - ox), r2(p[1] - oy)]); delete c.no; return c; }),
      cables: cables.map(c0 => { const c = clone(c0); c.x1 -= ox; c.x2 -= ox; c.y1 -= oy; c.y2 -= oy; return c; }),
      gfx: gfx.map(g0 => { const g = clone(g0); g.pts = g.pts.map(p => [r2(p[0] - ox), r2(p[1] - oy)]); return g; }),
    };
    LIB.macros = LIB.macros || []; LIB.macros.push(m); saveLibrary();
    flash(`Saved macro "${v.name}"`);
  }, 'Save');
}
let placeMacro = null;
function macroPreview(m, w = 170, h = 110) {
  const xs = [], ys = [];
  for (const it of m.items) { const b = itemBox(it); xs.push(b[0], b[2]); ys.push(b[1], b[3]); }
  for (const wr of m.wires) for (const p of wr.pts) { xs.push(p[0]); ys.push(p[1]); }
  const x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6, x1 = Math.max(...xs) + 6, y1 = Math.max(...ys) + 6;
  const fake = { fn: '', loc: '', items: [] };
  return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" style="width:${w}px;height:${h}px;background:#fff;border:1px solid var(--line);border-radius:4px">${m.wires.map(wr => `<path class="wire" d="M${wr.pts.map(p => p.join(',')).join('L')}"/>`).join('')}${m.items.map(it => itemSVG(it, fake, false, true)).join('')}</svg>`;
}
function insertMacroDlg() {
  const ms = LIB.macros || [];
  const html = ms.length ? `<div class="macgrid">${ms.map(m => `<div class="maccard"><div>${macroPreview(m)}</div><b>${esc(m.name)}</b><span class="note">${esc(m.desc || '')}</span>
    <div class="btnrow"><button type="button" class="btn small primary" data-mac="ins:${m.id}">Insert</button><button type="button" class="btn small" data-mac="ren:${m.id}">Rename</button><button type="button" class="btn small" data-mac="del:${m.id}">Delete</button></div></div>`).join('')}</div>`
    : '<div class="note">No macros yet. Select part of a schematic and use Save selection as macro.</div>';
  dialog('Macros', [], null, 'OK', `<div class="sub">Macros are saved in the OpenSchem Data folder and are available in every project. Inserted devices get the next free tags and the page's ${home() ? 'circuit' : 'function and location'}.</div>${html}`);
  $('#dlg').style.width = '760px';
  $('#dlgbody').onclick = e => {
    const b = e.target.closest('[data-mac]'); if (!b) return;
    const [op, id] = b.dataset.mac.split(':'); const m = ms.find(x => x.id === id); if (!m) return;
    if (op === 'ins') {
      if (isFloor(page()) || page().report) { alert('Open a schematic page first.'); return; }
      $('#dlg').close(); placeMacro = m; setMode('macro'); flash(`Click to place "${m.name}". Esc to finish.`);
    } else if (op === 'ren') { const n = prompt('Macro name:', m.name); if (n) { m.name = n; saveLibrary(); $('#dlg').close(); insertMacroDlg(); } }
    else if (op === 'del') { if (confirm(`Delete macro "${m.name}"?`)) { LIB.macros = ms.filter(x => x !== m); saveLibrary(); $('#dlg').close(); insertMacroDlg(); } }
  };
}
function drawMacroGhost(mx, my) {
  if (!placeMacro) return;
  const dx = snap(mx), dy = snap(my); const fake = { fn: '', loc: '', items: [] };
  $('#overlay').innerHTML = `<g transform="translate(${dx},${dy})" opacity="0.75">${placeMacro.wires.map(w => `<path class="wprev" d="M${w.pts.map(p => p.join(',')).join('L')}"/>`).join('')}${placeMacro.items.map(it => itemSVG(it, fake, false, true)).join('')}</g>`;
}
function placeMacroAt(pg, mx, my) {
  const m = placeMacro; if (!m) return;
  commit(() => { sel = insertContent(m, snap(mx), snap(my), pg, true); });
  drawMacroGhost(mx, my);
}
