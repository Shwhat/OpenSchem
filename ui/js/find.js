// ---------- find and replace, bulk edit ----------
const FIND_FIELDS = () => [['all', 'All fields'], ['tag', home() ? 'Names' : 'Device tags'], ['desc', home() ? 'Descriptions' : 'Function texts / descriptions'], ['part', 'Part numbers'], ['tech', home() ? 'Details' : 'Technical data'], ['fn', home() ? 'Circuits' : 'Functions (=)'], ['loc', home() ? 'Rooms' : 'Locations (+)'], ['text', 'Text and dimensions'], ['page', 'Page descriptions']];
const FIELD_NAMES = { tag: 'tag', desc: 'description', part: 'part', tech: 'details', fn: 'circuit/function', loc: 'room/location', text: 'text', ipName: 'interruption point', ctype: 'cable type', pdesc: 'page description' };
function findRe(o) {
  const src = String(o.q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(o.whole ? `\\b${src}\\b` : src, o.matchCase ? 'g' : 'gi');
}
// every place a text occurs: { id, obj, key, text, where }
function findTargets(field) {
  const out = []; const want = k => field === 'all' || field === k;
  for (const pg of P.pages) {
    if (want('page')) out.push({ id: 'page:' + pg.id, obj: pg, key: 'desc', kind: 'pdesc', where: pageName(pg) });
    for (const it of pg.items) {
      const d = SYM[it.sym]; const where = pageName(pg) + '.' + colOf(it.x);
      if (it.sym === 'text') { if (want('text')) out.push({ id: it.id, obj: it, key: 'text', where }); continue; }
      for (const k of ['tag', 'desc', 'part', 'tech', 'fn', 'loc']) if (want(k) && d && (k !== 'tag' || d.prefix)) out.push({ id: it.id, obj: it, key: k, where });
      if (it.sym === 'ip' && want('tag')) out.push({ id: it.id, obj: it, key: 'ipName', where });
    }
    for (const c of pg.cables || []) for (const k of ['tag', 'desc', 'part']) if (want(k)) out.push({ id: c.id, obj: c, key: k, where: pageName(pg) });
    for (const g of pg.gfx || []) if (g.t === 'dim' && g.text && want('text')) out.push({ id: g.id, obj: g, key: 'text', where: pageName(pg) });
  }
  for (const it of P.pool || []) for (const k of ['tag', 'desc', 'part', 'tech', 'fn', 'loc']) if (want(k)) out.push({ id: it.id, obj: it, key: k, where: 'floor plan' });
  return out;
}
function findMatches(o) {
  if (!o.q) return [];
  const re = findRe(o); const out = [];
  for (const t of findTargets(o.field || 'all')) { const v = String(t.obj[t.key] ?? ''); re.lastIndex = 0; if (v && re.test(v)) out.push(Object.assign(t, { text: v })); }
  return out;
}
function replaceMatches(o, repl, only) {
  const hits = findMatches(o).filter(h => !only || only.has(h.id + '|' + h.key)); if (!hits.length) return 0;
  let n = 0;
  commit(() => {
    for (const h of hits) {
      const cur = String(h.obj[h.key] ?? ''); const re = findRe(o); const nv = cur.replace(re, repl);
      if (nv === cur) continue;
      if (h.obj.sym && SYM[h.obj.sym] && h.obj.sym !== 'text' && ['tag', 'fn', 'loc', 'part', 'ipName'].includes(h.key)) applyItemChange(h.obj, h.key, nv);
      else h.obj[h.key] = nv;
      n++;
    }
  });
  return n;
}
function bulkEdit(ids, key, v) {
  let n = 0;
  commit(() => { for (const id of new Set(ids)) { const it = itemById(id); if (it && SYM[it.sym]) { applyItemChange(it, key, v); n++; } } });
  return n;
}
function findDlg() {
  let o = { q: '', field: 'all', matchCase: false, whole: false }, repl = '', checked = new Set(), hits = [];
  const keyOf = h => h.id + '|' + h.key;
  const draw = (keepFocus) => {
    hits = findMatches(o);
    const list = hits.slice(0, 400).map(h => `<div class="fres"><input type="checkbox" data-fck="${esc(keyOf(h))}" ${checked.has(keyOf(h)) ? 'checked' : ''}><span class="fw">${esc(h.where)}</span><span class="fk">${esc(FIELD_NAMES[h.kind || h.key] || h.key)}</span><span class="ft" data-fgo="${esc(h.id)}">${esc(h.text)}</span></div>`).join('');
    $('#fresults').innerHTML = o.q ? (list || '<div class="note">No matches.</div>') + (hits.length > 400 ? `<div class="note">Showing 400 of ${hits.length}.</div>` : '') : '<div class="note">Type something to find.</div>';
    $('#fcount').textContent = o.q ? `${hits.length} match(es)` : '';
  };
  const devFields = [['part', 'Part number'], ['tech', home() ? 'Details' : 'Technical data'], ['desc', home() ? 'Description' : 'Function text'], ['loc', L('loc')], ['fn', L('fn')], ['va', 'Load (VA)']];
  dialog('Find and replace', [], null, 'OK', `<div class="fgrid">
    <label>Find</label><input id="fq" class="search" autocomplete="off">
    <label>Replace with</label><input id="fr" class="search" autocomplete="off">
    <label>Look in</label><select id="ff">${FIND_FIELDS().map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <span></span><span class="fopts"><label><input type="checkbox" id="fcase"> Match case</label><label><input type="checkbox" id="fwhole"> Whole word</label></span></div>
    <div class="btnrow"><button type="button" class="btn small" data-fdo="repall">Replace all</button><button type="button" class="btn small" data-fdo="repck">Replace checked</button><button type="button" class="btn small" data-fdo="ckall">Check all</button><button type="button" class="btn small" data-fdo="cknone">Check none</button><span id="fcount" class="note" style="margin-left:auto"></span></div>
    <div id="fresults" class="flist"></div>
    <h4 class="lyh" style="margin-top:10px">Bulk edit checked devices</h4>
    <div class="fbulk"><select id="fbk">${devFields.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select><input id="fbv" class="search" placeholder="New value"><button type="button" class="btn small" data-fdo="bulk">Apply</button></div>`);
  $('#dlg').style.width = '820px'; $('#dlg').style.maxWidth = '96vw';
  draw();
  const body = $('#dlgbody');
  body.oninput = e => {
    if (e.target.id === 'fq') { o.q = e.target.value; checked.clear(); draw(); }
    else if (e.target.id === 'fr') repl = e.target.value;
  };
  body.onchange = e => {
    if (e.target.id === 'ff') o.field = e.target.value; else if (e.target.id === 'fcase') o.matchCase = e.target.checked; else if (e.target.id === 'fwhole') o.whole = e.target.checked;
    else if (e.target.dataset.fck) { e.target.checked ? checked.add(e.target.dataset.fck) : checked.delete(e.target.dataset.fck); return; }
    else return;
    draw();
  };
  body.onclick = e => {
    const g = e.target.closest('[data-fgo]'); if (g) { $('#dlg').close(); gotoItem(g.dataset.fgo); return; }
    const b = e.target.closest('[data-fdo]'); if (!b) return;
    const op = b.dataset.fdo;
    if (op === 'ckall') { hits.forEach(h => checked.add(keyOf(h))); draw(); }
    else if (op === 'cknone') { checked.clear(); draw(); }
    else if (op === 'repall' || op === 'repck') { if (!o.q) return; const n = replaceMatches(o, repl, op === 'repck' ? checked : null); flash(`Replaced in ${n} place(s)`); o.q = repl; $('#fq').value = repl; checked.clear(); draw(); }
    else if (op === 'bulk') {
      const ids = [...checked].map(k => k.split('|')[0]).filter(id => itemById(id));
      if (!ids.length) { flash('Check the devices to change first'); return; }
      const n = bulkEdit(ids, $('#fbk').value, $('#fbv').value.trim()); flash(`Changed ${n} device(s)`); draw();
    }
  };
  setTimeout(() => $('#fq').focus(), 0);
}

// ---------- terminal strip editor ----------
function terminalEditor(key) {
  buildIndex();
  if (!key) { const f = findItem([...sel][0]); const it = f && f.it; if (it && it.sym === 'term') key = devKey(it); else if (page().strip) key = page().strip.key; }
  const dv = key && IX.dev.get(key); if (!dv) { flash('Select a terminal first'); return; }
  const terms = dv.items.slice().sort((a, b) => natCmp(a.tn, b.tn) || cmpKey(orderKey(a), orderKey(b)));
  const rows = terms.map(t => `<tr class="tsrow" data-tid="${t.id}"><td><input data-tf="tn" value="${esc(t.tn || '')}"></td><td><input data-tf="desc" value="${esc(t.desc || '')}"></td><td><input data-tf="part" value="${esc(t.part || '')}" list="dl-parts"></td><td class="note">${esc(pageName(IX.pos.get(t.id).pg) + '.' + colOf(t.x))}</td></tr>`).join('');
  dialog('Terminal strip ' + dispFull(dv.fn, dv.loc, dv.tag), [], () => {
    const vals = [...$('#dlgbody').querySelectorAll('.tsrow')].map(r => ({ id: r.dataset.tid, v: Object.fromEntries([...r.querySelectorAll('[data-tf]')].map(i => [i.dataset.tf, i.value.trim()])) }));
    commit(() => { for (const { id, v } of vals) { const it = itemById(id); if (!it) continue; it.tn = v.tn; it.desc = v.desc; it.part = v.part; } });
  }, 'Save', `<table class="tstab"><thead><tr><th>Terminal</th><th>Function text</th><th>Part number</th><th>Page</th></tr></thead><tbody>${rows}</tbody></table>${partDatalist()}
    <div class="btnrow"><button type="button" class="btn small" data-tsren="1">Renumber 1 to ${terms.length}</button><span class="note">in the order shown</span></div>
    <div class="fbulk"><input data-ts="part" class="search" placeholder="Part number for every terminal" list="dl-parts"><button type="button" class="btn small" data-tsall="part">Set for all</button></div>`);
  $('#dlg').style.width = '720px'; $('#dlg').style.maxWidth = '96vw';
  $('#dlgbody').onclick = e => {
    if (e.target.closest('[data-tsren]')) $('#dlgbody').querySelectorAll('.tsrow [data-tf="tn"]').forEach((i, n) => { i.value = String(n + 1); });
    const a = e.target.closest('[data-tsall]'); if (a) { const v = $('#dlgbody [data-ts="part"]').value.trim(); $('#dlgbody').querySelectorAll('.tsrow [data-tf="part"]').forEach(i => { i.value = v; }); }
  };
}
