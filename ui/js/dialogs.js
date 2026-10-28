// ---------- dialogs ----------
function dialog(title, fields, onOk, okLabel = 'OK', extraHTML = '') {
  const dlg = $('#dlg'); dlg.style.width = ''; dlg.style.maxWidth = ''; dlg.onkeydown = null; $('#dlgbody').onclick = null; $('#dlgbody').onchange = null;
  $('#dlgtitle').textContent = title;
  let s = '';
  for (const [k, label, v, type, opt] of fields) {
    if (type === 'check') s += `<div class="prow"><label>${label}</label><input type="checkbox" name="${k}" ${v ? 'checked' : ''} style="width:auto"></div>`;
    else if (type === 'select') s += `<div class="prow"><label>${label}</label><select name="${k}">${opt.map(([ov, ol]) => `<option value="${esc(ov)}" ${ov === v ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>`;
    else s += `<div class="prow"><label>${label}</label><input name="${k}" value="${esc(v)}" ${type === 'number' ? 'type="number"' : ''}></div>`;
  }
  $('#dlgbody').innerHTML = s + extraHTML;
  $('#dlgbtns').innerHTML = onOk ? `<button type="button" class="btn" onclick="document.getElementById('dlg').close('cancel')">Cancel</button><button class="btn primary" value="ok">${okLabel}</button>` : '<button class="btn primary" value="cancel">Close</button>';
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok' || !onOk) return;
    const v = {}; for (const [k, , , type] of fields) { const el = $('#dlgform').elements[k]; v[k] = type === 'check' ? el.checked : el.value.trim(); }
    if (onOk(v) === false) setTimeout(() => dialog(title, fields.map(f => [f[0], f[1], v[f[0]], f[3], f[4]]), onOk, okLabel, extraHTML), 0);
  };
  dlg.onkeydown = e => { if (e.key === 'Enter' && onOk && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox')) { e.preventDefault(); dlg.close('ok'); } };
  dlg.returnValue = ''; dlg.showModal();
  dlgFocus();
}
// put the cursor in the first field with its text selected, so typing replaces it and Enter confirms. A dialog opened
// from a mouse press loses focus to the press itself, so focus is set again once the event is over.
function dlgFocus() {
  const dlg = $('#dlg'); let touched = false;
  const mark = () => { touched = true; };
  dlg.addEventListener('keydown', mark, { once: true }); dlg.addEventListener('pointerdown', mark, { once: true });
  const go = () => {
    if (!dlg.open || (touched && dlg.contains(document.activeElement))) return;
    const first = $('#dlgbody input:not([type=checkbox]):not([type=hidden]):not([disabled]), #dlgbody textarea, #dlgbody select');
    if (!first) { const b = $('#dlgbtns .primary'); if (b) b.focus(); return; }
    if (document.activeElement !== first) first.focus();
    if (!touched && first.select && first.tagName !== 'SELECT') first.select();
  };
  go(); setTimeout(go, 0); requestAnimationFrame(() => setTimeout(go, 0));
}
// a mouse press that opens a dialog may also release over the canvas; bring focus back if it lands outside the dialog
document.addEventListener('mouseup', () => { if ($('#dlg') && $('#dlg').open && !$('#dlg').contains(document.activeElement)) dlgFocus(); }, true);
function projectProps() {
  dialog('Project properties', [['name', 'Project name', P.name], ['desc', 'Description', P.desc || ''], ['company', 'Company', P.company], ['author', 'Drawn by', P.author], ['size', 'Default paper size', P.size || 'A3L', 'select', SHEET_OPTS()], ['units', 'Units', unitsOf(), 'select', [['imperial', 'Feet and inches'], ['metric', 'Metric (mm, m)']]], ['prec', 'Smallest fraction (feet and inches)', String(P.prec || 16), 'select', [['2', '1/2 in'], ['4', '1/4 in'], ['8', '1/8 in'], ['16', '1/16 in'], ['32', '1/32 in']]]], v => { const u = v.units, pr = +v.prec || 16; delete v.units; delete v.prec; const rs = readReportSettings(); commit(() => { Object.assign(P, v); P.prec = pr; P.order = rs.order; P.repOff = rs.off; }); setUnits(u); if (!allPages().includes(page())) goPage(allPages()[0].id); zoomFit(); }, 'OK', '<div class="note">The default paper size applies to pages that do not have their own size. Reports always use A3.</div>' + reportSettingsHTML());
  $('#dlg').style.width = '560px';
}
function wireDlg() {
  dialog('Wire numbering', [
    ['wireScheme', 'Scheme', P.wireScheme, 'select', [['seq', 'Sequential (1, 2, 3...)'], ['page', 'Page based (101, 102...)'], ['pagecol', 'Page and column (2.4, 2.4a...)'], ['none', 'Off (manual numbers only)']]],
    ['wireStart', 'Start number (sequential)', P.wireStart, 'number'],
    ['potNames', 'Use interruption point names as potential names', P.potNames, 'check'],
  ], v => commit(() => { P.wireScheme = v.wireScheme; P.wireStart = parseInt(v.wireStart, 10) || 1; P.potNames = v.potNames; }), 'OK',
  '<div class="note">Numbers are generated per potential, ordered by page and column. Use Project > Lock wire numbers to freeze them.</div>');
}
function lockWires() { commit(() => { for (const pg of P.pages) for (const w of pg.wires) { const n = WN.get(w.id); if (n) w.no = n; } }); flash('Wire numbers locked'); }
function unlockWires() { if (confirm('Remove all manual and locked wire numbers?')) commit(() => { for (const pg of P.pages) for (const w of pg.wires) delete w.no; }); }

function renumberDlg() {
  dialog('Renumber devices', [['devs', 'Renumber device tags', true, 'check'], ['terms', 'Renumber terminals per strip', true, 'check']], v => {
    commit(() => {
      buildIndex();
      if (v.devs) {
        const groups = new Map();
        for (const d of IX.dev.values()) {
          if (d.items.some(i => i.sym === 'term' || i.role === 'plc')) continue;
          const m = /^([A-Za-z]+)(\d*)$/.exec(d.tag); if (!m) continue;
          const isRes = SYM[d.items[0].sym] && SYM[d.items[0].sym].res;
          const gk = isRes ? (S().numbering === 'room' ? `R\u0001${d.loc}\u0001${m[1]}` : `H\u0001${m[1]}`) : `${d.fn}\u0001${d.loc}\u0001${m[1]}`; if (!groups.has(gk)) groups.set(gk, { prefix: m[1], list: [] });
          groups.get(gk).list.push(d);
        }
        for (const g of groups.values()) {
          g.list.sort((a, b) => cmpKey(orderKey(a.main || a.items[0]), orderKey(b.main || b.items[0])));
          g.list.forEach((d, i) => { const nt = g.prefix + (i + 1); d.items.forEach(it => { it.tag = nt; }); });
        }
      }
      if (v.terms) {
        const strips = new Map();
        for (const it of allItems()) if (it.sym === 'term') { const k = devKey(it); if (!strips.has(k)) strips.set(k, []); strips.get(k).push(it); }
        for (const l of strips.values()) { l.sort((a, b) => cmpKey(orderKey(a), orderKey(b))); l.forEach((it, i) => it.tn = String(i + 1)); }
      }
    });
    flash('Devices renumbered');
  }, 'Renumber', '<div class="note">Devices are numbered per prefix within each function and location, in page and column order. Terminals and PLC cards keep their strip/card names.</div>');
}

function checkProject() {
  buildIndex(); NETS = computeNets();
  const msgs = [];
  const add = (lv, text, id) => msgs.push({ lv, text, id });
  for (const d of IX.dev.values()) {
    const id = fl(d.fn, d.loc) + '-' + d.tag;
    if (d.items.some(i => i.sym === 'term')) {
      const seen = new Map(); for (const t of d.items) { if (seen.has(t.tn)) add('e', `${id}: terminal ${t.tn} exists more than once`, t.id); seen.set(t.tn, 1); }
      continue;
    }
    if (d.items.some(i => i.role === 'plc')) {
      const seen = new Map(); for (const t of d.items) { if (t.addr && seen.has(t.addr)) add('e', `${id}: PLC address ${t.addr} used more than once`, t.id); seen.set(t.addr, 1); }
      continue;
    }
    if (!d.mains.length) add('e', `${id}: no main function (auxiliary functions only)`, d.items[0].id);
    if (d.mains.length > 1) add('w', `${id}: ${d.mains.length} main functions`, d.mains[1].id);
    const cps = new Map();
    for (const it of d.items) for (const c of (it.cl || [])) { if (!c) continue; if (cps.has(c)) add('e', `${id}: connection point ${c} used more than once`, it.id); cps.set(c, 1); }
  }
  for (const it of allItems()) {
    const d = SYM[it.sym]; if (!d || !d.brk || !it.fn) continue;
    const ci = circuitInfo(it); const nm = dispTag(it.tag) + ' (' + dispCkt(it.fn) + ')';
    if (ci.pct > 100) add('e', `${nm}: load ${Math.round(ci.load)} VA is ${fmtPct(ci.pct)} of the breaker rating`, it.id);
    else if (ci.pct > 80) add('w', `${nm}: load ${Math.round(ci.load)} VA is ${fmtPct(ci.pct)} of the breaker rating (above 80% for continuous loads)`, it.id);
    if (ci.vd > 3) add('w', `${nm}: voltage drop ${fmtPct(ci.vd)} over ${Math.round(ci.len)} ft of ${ci.awg} AWG (above 3%)`, it.id);
  }
  for (const t of (P.todos || []).filter(t => !t.done)) add('i', `To-do: ${t.text}`, t.link || '');
  for (const [name, list] of IX.ips) if (list.length < 2) add('w', `Interruption point ${name} has no partner`, list[0].id);
  for (const pg of P.pages) for (const it of pg.items) {
    const d = SYM[it.sym]; if (!d || d.role === 'ip' || d.role === 'pe') continue;
    if (d.prefix && !it.tag) add('e', `${pageName(pg)}: ${d.name} without device tag`, it.id);
    connPts(it).forEach(c => {
      const pm = pg.wires.some(w => [w.pts[0], w.pts[w.pts.length - 1]].some(p => p[0] === c.x && p[1] === c.y));
      const touch = pg.items.some(o => o !== it && connPts(o).some(oc => oc.x === c.x && oc.y === c.y));
      if (!pm && !touch) add('i', `${pageName(pg)}.${colOf(it.x)}: ${it.tag ? dispOnPage(it, pg) : d.name} point ${(it.cl || [])[c.i] || c.i + 1} not connected`, it.id);
    });
  }
  const order = { e: 0, w: 1, i: 2 }; msgs.sort((a, b) => order[a.lv] - order[b.lv]);
  const names = { e: 'Error', w: 'Warning', i: 'Info' };
  const html = msgs.length ? msgs.map(m => `<div class="msg" data-goto="${m.id}"><span class="lv ${m.lv}">${names[m.lv]}</span><span>${esc(m.text)}</span></div>`).join('')
    : '<div class="note">No problems found.</div>';
  const cnt = ['e', 'w', 'i'].map(l => `${msgs.filter(m => m.lv === l).length} ${names[l].toLowerCase()}(s)`).join(', ');
  dialog('Check project', [], null, 'OK', `<div class="sub">${cnt}. Click a message to jump to it.</div>${html}`);
  $('#dlgbody').onclick = e => { const g = e.target.closest('[data-goto]'); if (g) { $('#dlg').close(); gotoItem(g.dataset.goto); } };
}
function shortcuts() {
  const k = [['W', 'Draw connection'], ['T', 'Insert text'], ['R', 'Rotate selection / symbol being placed'], ['Tab', 'Cycle variants A to H while placing'], ['M', 'Mirror selection / symbol being placed'], ['G', 'Snap to grid on/off'], ['Shift+G', 'Align selection (or the whole page) to the grid'], ['C', 'Draw cable'], ['Esc', 'End command, clear selection'], ['Del', 'Delete'], ['Ctrl+C / X / V', 'Copy, cut, paste (new devices get next free tags)'], ['Ctrl+Z / Y', 'Undo, redo'], ['Ctrl+A', 'Select all on page'], ['Ctrl+F', 'Find and replace'], ['Ctrl+S', 'Save'], ['Ctrl+P', 'Print or save all pages as PDF'], ['F', 'Zoom to page'], ['Z', 'Zoom window (drag a box)'], ['Shift+Z', 'Previous view'], ['Wheel', 'Zoom'], ['Middle drag / Space+drag', 'Pan'], ['PgUp / PgDn', 'Previous / next page'], ['Drag a handle', 'Move the end of a selected connection'], ['Drag a selected connection', 'Move that segment sideways'], ['Double click', 'Edit properties'], ['Right click', 'End current command'], ['F3', 'Object snap on/off (floor plans)'], ['F8', 'Ortho on/off'], ['F10', 'Polar tracking on/off'], ['Type a length', 'While drawing a room: 12ft 6in, @12ft,8ft, 10ft<45, #x,y'], ['Enter', 'Finish a room shape / open the command line'], ['Drag left to right', 'Window select (whole object inside)'], ['Drag right to left', 'Crossing select (anything touched)'], ['L, PL, A, C, EL, POL, REC, SPL, T', 'Draw line, polyline, arc, circle, ellipse, polygon, rectangle, spline, text (command line)'], ['While drawing', 'Type an option letter, then Enter (A arc, W width, C close, U undo, 2P/3P, F fillet)'], ['Click a grip', 'Make it hot, then click where it goes (or drag a grip)'], ['Space (grip hot)', 'Next grip mode: stretch, move, rotate, scale, mirror'], ['C / B (grip hot)', 'Keep copies / pick another base point'], ['M, CO, RO, SC, MI', 'Move, copy, rotate, scale, mirror (floor plans)'], ['O, TR, EX, F, CHA', 'Offset, trim, extend, fillet, chamfer'], ['BR, BRP, J, X', 'Break, break at point, join, explode'], ['AR, ARP, ARPA', 'Rectangular, polar and path arrays'], ['WA, DO, WIN, OP, RP', 'Wall, door, window, cased opening, room from walls'], ['DLI, DAL, DAN, DRA, DDI', 'Linear, aligned, angular, radius, diameter dimensions'], ['LE, H, I, B', 'Leader, hatch, insert block, create block'], ['DXFIN, DXFOUT, SVG, PNG', 'Import and export drawings and images'], ['Enter', 'Confirm a dialog (the first field is ready for typing)'], ['Alt while moving a floating panel', 'Place it without snapping to other panels'], ['Shift while moving a floating panel', 'Do not join the panel under the pointer'], ['Symbol editor: G, Shift+G', 'Snap on/off, align to grid'], ['Symbol editor: R, M, Ctrl+D', 'Rotate, mirror, duplicate the selection'], ['Symbol editor: arrows', 'Nudge one grid step (Shift: four)'], ['Symbol editor: Ctrl+Z / Y, Ctrl+A, F', 'Undo, redo, select all, fit']];
  dialog('Keyboard shortcuts', [], null, 'OK', `<div class="kbd">${k.map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join('')}</div>`);
}
function about() {
  dialog('About OpenSchem', [], null, 'OK', '<p><b>OpenSchem ' + APP_VERSION + '</b><br>Portable electrical schematic editor with structured device tagging (=Function +Location -Device), automatic device and wire numbering, contact mirrors and cross-references.</p><p class="note">Projects are saved as .osp files (JSON). Settings, your symbol library and autosave are kept in the OpenSchem Data folder next to the program.</p>');
}
