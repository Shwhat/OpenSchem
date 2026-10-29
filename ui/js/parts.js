// ---------- parts database ----------
// The parts list lives in the OpenSchem Data folder (parts.json). Projects carry copies of the parts they use,
// so a project opened on another computer still has its part data.
let PARTS = [];
// Part numbers follow the convention MANUFACTURER-CODE.ORDER-NUMBER (for example PXC.3031212). The part number is built
// from the manufacturer's short code and the order number, and it is the unique key of the parts database.
const PART_FIELDS = [
  ['pn', 'Part number'], ['mfr', 'Manufacturer'], ['ord', 'Order number'], ['type', 'Type number'], ['desc', 'Description'], ['cat', 'Category'], ['tech', 'Technical data'],
  ['price', 'Price'], ['watts', 'Watts / VA'], ['url', 'Datasheet link'], ['w', 'Width (mm)'], ['h', 'Height (mm)'], ['d', 'Depth (mm)'],
];
const PART_NUM = ['price', 'watts', 'w', 'h', 'd'];
const buildPn = (mfr, ord) => mfr && ord ? `${mfr}.${ord}` : '';

// ---------- manufacturers (shared on the server: manufacturers.json) ----------
let MFRS = [];
const MFR_DEFAULT = [
  ['PXC', 'Phoenix Contact', 'https://www.phoenixcontact.com'], ['SIE', 'Siemens', 'https://www.siemens.com'], ['RIT', 'Rittal', 'https://www.rittal.com'],
  ['WAG', 'WAGO', 'https://www.wago.com'], ['SCH', 'Schneider Electric', 'https://www.se.com'], ['ABB', 'ABB', 'https://new.abb.com'],
  ['AB', 'Allen-Bradley (Rockwell Automation)', 'https://www.rockwellautomation.com'], ['EAT', 'Eaton', 'https://www.eaton.com'],
  ['SQD', 'Square D', 'https://www.se.com/us'], ['LEV', 'Leviton', 'https://www.leviton.com'], ['FES', 'Festo', 'https://www.festo.com'], ['SMC', 'SMC', 'https://www.smcusa.com'],
].map(([code, name, url]) => ({ code, name, url }));
const MFR_CODE_RE = /^[A-Z0-9]{2,6}$/;
const mfrOf = code => MFRS.find(m => m.code === code) || null;
const mfrName = code => (mfrOf(code) || {}).name || code || '';
const mfrInUse = code => PARTS.some(p => p.mfr === code);
async function loadMfrs() {
  try { const t = await host.readData('manufacturers.json'); const o = t ? JSON.parse(t) : null; MFRS = o ? (Array.isArray(o) ? o : o.manufacturers || []) : clone(MFR_DEFAULT); } catch (e) { MFRS = clone(MFR_DEFAULT); }
}
function saveMfrs() { MFRS.sort((a, b) => natCmp(a.code, b.code)); host.writeData('manufacturers.json', JSON.stringify({ manufacturers: MFRS }, null, 1)); }
// the code a manufacturer name or code in an import file refers to; unknown names are added with a code made from them
function mfrResolve(v, added) {
  v = String(v || '').trim(); if (!v) return '';
  const u = v.toUpperCase(); const m = MFRS.find(x => x.code === u || String(x.name || '').toUpperCase() === u); if (m) return m.code;
  let code = MFR_CODE_RE.test(u) ? u : u.replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (code.length < 2) code = (code + 'XX').slice(0, 2);
  for (let i = 2; mfrOf(code); i++) code = code.slice(0, 5) + i;
  MFRS.push({ code, name: v }); if (added) added.push(code); return code;
}
function mfrDlg() {
  const draw = () => {
    const rows = MFRS.slice().sort((a, b) => natCmp(a.code, b.code)).map(m => { const n = PARTS.filter(p => p.mfr === m.code).length; return `<tr><td><b>${esc(m.code)}</b></td><td>${esc(m.name || '')}</td><td>${esc(m.supplier || '')}</td><td>${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.url.replace(/^https?:\/\//, ''))}</a>` : ''}</td><td class="r">${n || ''}</td><td class="r"><button type="button" class="btn small" data-medit="${esc(m.code)}">Edit</button> <button type="button" class="btn small" data-mdel="${esc(m.code)}" ${n ? 'disabled title="Used by parts"' : ''}>Delete</button></td></tr>`; }).join('');
    $('#dlgbody').innerHTML = `<div class="pmbar"><button type="button" class="btn small" data-madd="1">Add manufacturer</button></div>
      <div class="pmwrap"><table class="pmtab"><tr><th>Code</th><th>Name</th><th>Supplier</th><th>Website</th><th class="r">Parts</th><th></th></tr>${rows || '<tr><td colspan="6" class="note">No manufacturers yet.</td></tr>'}</table></div>
      <div class="note">${MFRS.length} manufacturer(s). A code used by parts cannot be changed or deleted.</div>`;
  };
  dialog('Manufacturers', [], null); $('#dlg').style.width = '860px'; $('#dlg').style.maxWidth = '96vw'; draw();
  $('#dlgbody').onclick = e => {
    if (e.target.closest('[data-madd]')) { editMfr(null, () => mfrDlg()); return; }
    const ed = e.target.closest('[data-medit]'); if (ed) { editMfr(mfrOf(ed.dataset.medit), () => mfrDlg()); return; }
    const dl = e.target.closest('[data-mdel]'); if (dl && !dl.disabled) { if (confirm('Delete manufacturer ' + dl.dataset.mdel + '?')) { MFRS = MFRS.filter(m => m.code !== dl.dataset.mdel); saveMfrs(); draw(); } }
  };
}
// add or edit one manufacturer; after(code) runs once it is saved, cancel() when the dialog is cancelled
function editMfr(m, after, cancel) {
  const isNew = !m; m = m || {}; const locked = !isNew && mfrInUse(m.code); let saved = false;
  dialog(isNew ? 'Add manufacturer' : 'Edit manufacturer ' + m.code, [['code', 'Short code', m.code || ''], ['name', 'Name', m.name || ''], ['supplier', 'Supplier', m.supplier || ''], ['url', 'Website', m.url || '']], v => {
    const code = locked ? m.code : v.code.toUpperCase();
    if (!MFR_CODE_RE.test(code)) { alert('The short code is 2 to 6 capital letters or digits, for example PXC.'); return false; }
    if (!v.name) { alert('Enter the manufacturer name.'); return false; }
    if (code !== m.code && mfrOf(code)) { alert('The code ' + code + ' is already used by ' + mfrName(code) + '.'); return false; }
    const nm = { code, name: v.name }; if (v.supplier) nm.supplier = v.supplier; if (v.url) nm.url = v.url;
    if (isNew) MFRS.push(nm); else MFRS[MFRS.indexOf(m)] = nm;
    saveMfrs(); saved = true; if (after) setTimeout(() => after(code), 0);
  }, 'Save', locked ? '<div class="note">Parts use this code, so it cannot be changed.</div>' : '<div class="note">2 to 6 capital letters or digits. Part numbers start with this code.</div>');
  const ci = $('#dlgform').elements.code; if (locked) ci.readOnly = true; ci.addEventListener('input', () => { const p = ci.selectionStart; ci.value = ci.value.toUpperCase(); ci.setSelectionRange(p, p); });
  if (cancel) { const dlg = $('#dlg'), inner = dlg.onclose; dlg.onclose = () => { inner(); if (!saved && dlg.returnValue !== 'ok') setTimeout(cancel, 0); }; }
}

async function loadParts() {
  try { const t = await host.readData('parts.json'); if (t) { const o = JSON.parse(t); PARTS = Array.isArray(o) ? o : (o.parts || []); } } catch (e) { PARTS = []; }
  await loadMfrs();
}
function saveParts() { host.writeData('parts.json', JSON.stringify({ parts: PARTS }, null, 1)); }
function partOf(pn) {
  if (!pn) return null;
  return PARTS.find(p => p.pn === pn) || (P && P.parts && P.parts[pn]) || null;
}
function usedParts() {
  const out = {}; const add = pn => { const p = partOf(pn); if (p) out[pn] = p; };
  for (const it of allItems()) add(it.part);
  for (const pg of P.pages) for (const c of pg.cables || []) add(c.part);
  for (const pg of P.pages) for (const tb of pg.tubes || []) add(tb.part);
  return out;
}
const pnum = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const money = v => '$' + pnum(v).toFixed(2);
const partLabel = p => [p.pn, mfrName(p.mfr), p.desc].filter(Boolean).join('  ·  ');
function partDatalist() { return `<datalist id="dl-parts">${PARTS.map(p => `<option value="${esc(p.pn)}">${esc([p.type, p.desc].filter(Boolean).join(' '))}</option>`).join('')}</datalist>`; }

// fill device fields from a part (only fields that are still empty, except the part number itself)
function applyPart(it, pn) {
  it.part = pn; const p = partOf(pn); if (!p) return;
  if (!it.tech && p.tech) it.tech = p.tech;
  if ((it.va == null || it.va === '') && p.watts && SYM[it.sym] && SYM[it.sym].res) it.va = String(p.watts);
}

// ---------- parts manager ----------
function partsDlg(pick) {
  let q = '';
  const draw = () => {
    const ql = q.toLowerCase();
    const list = PARTS.filter(p => !ql || PART_FIELDS.some(([k]) => String(p[k] ?? '').toLowerCase().includes(ql)) || mfrName(p.mfr).toLowerCase().includes(ql)).sort((a, b) => natCmp(a.cat, b.cat) || natCmp(a.pn, b.pn));
    const rows = list.map(p => `<tr${pick ? ` class="pkrow" data-pick="${esc(p.pn)}"` : ''}><td><b>${esc(p.pn)}</b></td><td title="${esc(mfrName(p.mfr))}">${esc(p.mfr || '')}</td><td>${esc(p.type || '')}</td><td>${esc(p.desc || '')}</td><td>${esc(p.cat || '')}</td><td class="r">${p.price ? money(p.price) : ''}</td><td class="r">${p.watts || ''}</td><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">sheet</a>` : ''}</td>${pick ? '' : `<td class="r"><button type="button" class="btn small" data-pedit="${esc(p.pn)}">Edit</button> <button type="button" class="btn small" data-pdel="${esc(p.pn)}">Delete</button></td>`}</tr>`).join('');
    $('#dlgbody').innerHTML = `<div class="pmbar"><input class="search" id="pmq" placeholder="Search parts" value="${esc(q)}">${pick ? '' : '<button type="button" class="btn small" data-padd="1">Add part</button><button type="button" class="btn small" data-pmfr="1">Manufacturers...</button><button type="button" class="btn small" data-pimp="1">Import CSV...</button><button type="button" class="btn small" data-pexp="1">Export CSV...</button>'}</div>
      <div class="pmwrap"><table class="pmtab"><tr><th>Part number</th><th>Mfr</th><th>Type number</th><th>Description</th><th>Category</th><th class="r">Price</th><th class="r">W / VA</th><th>Data</th>${pick ? '' : '<th></th>'}</tr>${rows || `<tr><td colspan="9" class="note">${PARTS.length ? 'No parts match.' : 'No parts yet. Add parts or import a CSV file with columns such as Manufacturer, Order number, Type number, Description, Category, Technical data, Price, Watts, Datasheet.'}</td></tr>`}</table></div>
      <div class="note">${PARTS.length} part(s) in the library.${pick ? ' Click a part to use it.' : ' Part numbers are the manufacturer code and the order number, for example PXC.3031212.'}</div>`;
    const qi = $('#pmq'); qi.oninput = () => { q = qi.value; draw(); const n = $('#pmq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  };
  dialog(pick ? 'Choose a part' : 'Parts database', [], null);
  $('#dlg').style.width = '1040px'; $('#dlg').style.maxWidth = '96vw';
  draw();
  $('#dlgbody').onclick = async e => {
    const pk = e.target.closest('[data-pick]'); if (pk && pick) { $('#dlg').close(); pick(pk.dataset.pick); return; }
    if (e.target.closest('[data-padd]')) { editPart(null, () => partsDlg()); return; }
    if (e.target.closest('[data-pmfr]')) { mfrDlg(); return; }
    const ed = e.target.closest('[data-pedit]'); if (ed) { editPart(PARTS.find(p => p.pn === ed.dataset.pedit), () => partsDlg()); return; }
    const dl = e.target.closest('[data-pdel]'); if (dl) { if (confirm('Delete part ' + dl.dataset.pdel + ' from the library? Projects that use it keep their copy.')) { PARTS = PARTS.filter(p => p.pn !== dl.dataset.pdel); saveParts(); draw(); } return; }
    if (e.target.closest('[data-pexp]')) {
      const csv = toCSV(PART_FIELDS.map(f => f[1]), PARTS.map(p => PART_FIELDS.map(([k]) => p[k] ?? '')));
      const p = await host.saveText(csv, 'OpenSchem parts.csv'); if (p) flash('Exported ' + p); return;
    }
    if (e.target.closest('[data-pimp]')) {
      const r = await host.openText('CSV file', 'csv'); if (!r) return;
      const res = await importPartsCSV(r.content); if (!res) { partsDlg(); return; }
      saveParts(); partsDlg(); flash(importSummary(res));
    }
  };
}
// add or edit a part. The part number is built from the manufacturer code and the order number and cannot be typed.
// vals carries field values back in when the dialog is reopened (after adding a manufacturer, or a duplicate)
function editPart(p, after, vals) {
  const isNew = !p; p = p || {}; const v0 = Object.assign({}, p, vals || {});
  const mopts = [['', '(choose)']].concat(MFRS.slice().sort((a, b) => natCmp(a.code, b.code)).map(m => [m.code, `${m.code}  ${m.name || ''}`]), [['__add', 'Add manufacturer...']]);
  const fields = PART_FIELDS.filter(([k]) => k !== 'pn').map(([k, l]) => k === 'mfr' ? [k, l, v0.mfr || '', 'select', mopts] : [k, l, v0[k] ?? '']);
  dialog(isNew ? 'Add part' : 'Edit part ' + p.pn, fields, v => {
    if (!v.mfr || v.mfr === '__add') { alert('Choose a manufacturer.'); return false; }
    if (!v.ord) { alert('Enter the order number.'); return false; }
    const pn = buildPn(v.mfr, v.ord);
    const dup = PARTS.find(x => x.pn === pn && x !== p);
    if (dup) {
      setTimeout(async () => {
        const c = await choose('Part already exists', `Part ${pn} is already in the parts database. It is not saved twice.`, [['open', 'Open existing part']]);
        if (c === 'open') editPart(dup, after); else editPart(isNew ? null : p, after, v);
      }, 0);
      return;
    }
    const np = { pn }; for (const [k] of PART_FIELDS) if (k !== 'pn' && v[k] !== '') np[k] = PART_NUM.includes(k) ? String(pnum(v[k])) : v[k];
    if (isNew) PARTS.push(np);
    else {
      const old = p.pn; for (const k of Object.keys(p)) delete p[k]; Object.assign(p, np);
      if (old !== pn && P) { const uses = [...allItems()].filter(i => i.part === old); if (uses.length) commit(() => { for (const i of uses) i.part = pn; }); }
    }
    saveParts(); if (after) setTimeout(after, 0);
  }, 'Save', `<div class="prow"><label>Part number</label><input id="pnview" readonly tabindex="-1" value="${esc(buildPn(v0.mfr, v0.ord) || p.pn || '')}"></div><div class="note">The part number is the manufacturer code and the order number.</div>`);
  $('#dlg').style.width = '560px'; const pv = $('#pnview').closest('.prow'); $('#dlgbody').prepend(pv.nextElementSibling); $('#dlgbody').prepend(pv);
  const f = $('#dlgform').elements; const upd = () => { $('#pnview').value = buildPn(f.mfr.value === '__add' ? '' : f.mfr.value, f.ord.value.trim()); };
  f.ord.addEventListener('input', upd);
  f.mfr.addEventListener('change', () => {
    if (f.mfr.value !== '__add') { upd(); return; }
    const cur = {}; for (const [k] of fields) cur[k] = f[k].value.trim();
    editMfr(null, code => editPart(isNew ? null : p, after, Object.assign(cur, { mfr: code })), () => editPart(isNew ? null : p, after, Object.assign(cur, { mfr: v0.mfr || '' })));
  });
}
// CSV parsing (quotes, commas or semicolons) for part import
function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split('\n')[0]; const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
const PART_ALIASES = { pn: ['part number', 'part no', 'part', 'pn'], mfr: ['manufacturer', 'mfr', 'brand', 'vendor', 'manufacturer code'], ord: ['order number', 'order no', 'catalog number', 'catalogue number', 'article number', 'sku'], type: ['type number', 'type', 'type designation', 'model'], desc: ['description', 'desc', 'name'], cat: ['category', 'cat', 'group'], tech: ['technical data', 'tech', 'details', 'specs'], price: ['price', 'cost', 'unit price'], watts: ['watts', 'w', 'va', 'watts / va', 'load'], url: ['datasheet', 'datasheet link', 'url', 'link'], w: ['width', 'width (mm)'], h: ['height', 'height (mm)'], d: ['depth', 'depth (mm)'] };
// read parts from CSV text: each part gets its part number from the manufacturer code and the order number.
// When some parts are already in the database, asks once whether to skip or replace them (dup: 'skip' | 'replace'
// answers in advance). Resolves with counts { added, replaced, skipped, bad, newMfrs }, or null when cancelled.
async function importPartsCSV(text, dup) {
  const rows = parseCSV(text); if (rows.length < 2) return { added: 0, replaced: 0, skipped: 0, bad: 0, newMfrs: [] };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = {}; for (const [k, al] of Object.entries(PART_ALIASES)) { const i = head.findIndex(h => al.includes(h)); if (i >= 0) col[k] = i; }
  if (col.mfr == null || (col.ord == null && col.pn == null)) { alert('The CSV file needs a "Manufacturer" column and an "Order number" column.'); return null; }
  const mfrsBefore = clone(MFRS); const newMfrs = []; const list = []; let bad = 0;
  for (const r of rows.slice(1)) {
    const p = {}; for (const [k, i] of Object.entries(col)) { const v = (r[i] || '').trim(); if (v) p[k] = v; }
    if (!p.mfr) { bad++; continue; }
    p.mfr = mfrResolve(p.mfr, newMfrs);
    if (!p.ord && p.pn) p.ord = p.pn.startsWith(p.mfr + '.') ? p.pn.slice(p.mfr.length + 1) : p.pn;
    if (!p.ord) { bad++; continue; }
    p.pn = buildPn(p.mfr, p.ord); for (const k of PART_NUM) if (p[k] != null) p[k] = String(pnum(p[k]));
    const prev = list.findIndex(x => x.pn === p.pn); if (prev >= 0) list[prev] = p; else list.push(p);
  }
  const dups = list.filter(p => PARTS.some(x => x.pn === p.pn));
  if (dups.length && !dup) {
    dup = await choose('Parts already in the database', `${dups.length} of the ${list.length} part(s) in the file are already in the parts database (for example ${dups[0].pn}). Skip them or replace them with the file's data?`, [['skip', 'Skip'], ['replace', 'Replace']]);
    if (!dup) { MFRS = mfrsBefore; return null; }
  }
  const res = { added: 0, replaced: 0, skipped: 0, bad, newMfrs };
  for (const p of list) {
    const i = PARTS.findIndex(x => x.pn === p.pn);
    if (i < 0) { PARTS.push(p); res.added++; } else if (dup === 'replace') { PARTS[i] = p; res.replaced++; } else res.skipped++;
  }
  if (newMfrs.length) saveMfrs();
  return res;
}
const importSummary = r => [`Imported ${r.added} part(s)`, r.replaced ? `replaced ${r.replaced}` : '', r.skipped ? `skipped ${r.skipped} already in the database` : '', r.bad ? `${r.bad} row(s) without manufacturer or order number` : '', r.newMfrs.length ? `new manufacturers ${r.newMfrs.join(', ')}` : ''].filter(Boolean).join(', ');
function pickPartFor() {
  const f = findItem([...sel][0]); const o = f && (f.it || f.cab); if (!o) return;
  partsDlg(pn => commit(() => { if (f.it) applyPart(f.it, pn); else o.part = pn; }));
}
function partInfoHTML(pn) {
  const p = partOf(pn); if (!pn) return '';
  if (!p) return '<div class="note">Not in the parts database.</div>';
  return `<div class="note">${esc([mfrName(p.mfr), p.type, p.desc].filter(Boolean).join(', '))}${p.price ? ' · ' + money(p.price) : ''}${p.watts ? ' · ' + esc(p.watts) + ' W' : ''}${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener">datasheet</a>` : ''}</div>`;
}
