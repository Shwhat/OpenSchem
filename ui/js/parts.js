// ---------- parts database ----------
// The parts list lives in the OpenSchem Data folder (parts.json). Projects carry copies of the parts they use,
// so a project opened on another computer still has its part data.
let PARTS = [];
const PART_FIELDS = [
  ['pn', 'Part number'], ['mfr', 'Manufacturer'], ['desc', 'Description'], ['cat', 'Category'], ['tech', 'Technical data'],
  ['price', 'Price'], ['watts', 'Watts / VA'], ['url', 'Datasheet link'], ['w', 'Width (mm)'], ['h', 'Height (mm)'], ['d', 'Depth (mm)'],
];
async function loadParts() {
  try { const t = await host.readData('parts.json'); if (t) { const o = JSON.parse(t); PARTS = Array.isArray(o) ? o : (o.parts || []); } } catch (e) { PARTS = []; }
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
  return out;
}
const pnum = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const money = v => '$' + pnum(v).toFixed(2);
const partLabel = p => [p.pn, p.mfr, p.desc].filter(Boolean).join('  ·  ');
function partDatalist() { return `<datalist id="dl-parts">${PARTS.map(p => `<option value="${esc(p.pn)}">${esc([p.mfr, p.desc].filter(Boolean).join(' '))}</option>`).join('')}</datalist>`; }

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
    const list = PARTS.filter(p => !ql || PART_FIELDS.some(([k]) => String(p[k] ?? '').toLowerCase().includes(ql))).sort((a, b) => natCmp(a.cat, b.cat) || natCmp(a.pn, b.pn));
    const rows = list.map(p => `<tr${pick ? ` class="pkrow" data-pick="${esc(p.pn)}"` : ''}><td><b>${esc(p.pn)}</b></td><td>${esc(p.mfr || '')}</td><td>${esc(p.desc || '')}</td><td>${esc(p.cat || '')}</td><td class="r">${p.price ? money(p.price) : ''}</td><td class="r">${p.watts || ''}</td><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">sheet</a>` : ''}</td>${pick ? '' : `<td class="r"><button type="button" class="btn small" data-pedit="${esc(p.pn)}">Edit</button> <button type="button" class="btn small" data-pdel="${esc(p.pn)}">Delete</button></td>`}</tr>`).join('');
    $('#dlgbody').innerHTML = `<div class="pmbar"><input class="search" id="pmq" placeholder="Search parts" value="${esc(q)}">${pick ? '' : '<button type="button" class="btn small" data-padd="1">Add part</button><button type="button" class="btn small" data-pimp="1">Import CSV...</button><button type="button" class="btn small" data-pexp="1">Export CSV...</button>'}</div>
      <div class="pmwrap"><table class="pmtab"><tr><th>Part number</th><th>Manufacturer</th><th>Description</th><th>Category</th><th class="r">Price</th><th class="r">W / VA</th><th>Data</th>${pick ? '' : '<th></th>'}</tr>${rows || `<tr><td colspan="8" class="note">${PARTS.length ? 'No parts match.' : 'No parts yet. Add parts or import a CSV file with columns such as Part number, Manufacturer, Description, Category, Technical data, Price, Watts, Datasheet.'}</td></tr>`}</table></div>
      <div class="note">${PARTS.length} part(s) in the library.${pick ? ' Click a part to use it.' : ''}</div>`;
    const qi = $('#pmq'); qi.oninput = () => { q = qi.value; draw(); const n = $('#pmq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  };
  dialog(pick ? 'Choose a part' : 'Parts database', [], null);
  $('#dlg').style.width = '980px'; $('#dlg').style.maxWidth = '96vw';
  draw();
  $('#dlgbody').onclick = async e => {
    const pk = e.target.closest('[data-pick]'); if (pk && pick) { $('#dlg').close(); pick(pk.dataset.pick); return; }
    if (e.target.closest('[data-padd]')) { editPart(null, () => partsDlg()); return; }
    const ed = e.target.closest('[data-pedit]'); if (ed) { editPart(PARTS.find(p => p.pn === ed.dataset.pedit), () => partsDlg()); return; }
    const dl = e.target.closest('[data-pdel]'); if (dl) { if (confirm('Delete part ' + dl.dataset.pdel + ' from the library? Projects that use it keep their copy.')) { PARTS = PARTS.filter(p => p.pn !== dl.dataset.pdel); saveParts(); draw(); } return; }
    if (e.target.closest('[data-pexp]')) {
      const csv = toCSV(PART_FIELDS.map(f => f[1]), PARTS.map(p => PART_FIELDS.map(([k]) => p[k] ?? '')));
      const p = await host.saveText(csv, 'OpenSchem parts.csv'); if (p) flash('Exported ' + p); return;
    }
    if (e.target.closest('[data-pimp]')) {
      const r = await host.openText('CSV file', 'csv'); if (!r) return;
      const n = importPartsCSV(r.content); saveParts(); draw(); flash(`Imported ${n} part(s)`);
    }
  };
}
function editPart(p, after) {
  const isNew = !p; p = p || {};
  dialog(isNew ? 'Add part' : 'Edit part ' + p.pn, PART_FIELDS.map(([k, l]) => [k, l, p[k] ?? '']), v => {
    if (!v.pn) { alert('Enter a part number.'); return false; }
    if ((isNew || v.pn !== p.pn) && PARTS.some(x => x.pn === v.pn)) { alert('A part with that number already exists.'); return false; }
    const np = {}; for (const [k] of PART_FIELDS) if (v[k] !== '') np[k] = ['price', 'watts', 'w', 'h', 'd'].includes(k) ? String(pnum(v[k])) : v[k];
    if (isNew) PARTS.push(np); else Object.assign(PARTS[PARTS.indexOf(p)], np, Object.fromEntries(PART_FIELDS.filter(([k]) => v[k] === '').map(([k]) => [k, undefined])));
    saveParts(); if (after) setTimeout(after, 0);
  }, 'Save');
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
const PART_ALIASES = { pn: ['part number', 'part no', 'part', 'pn', 'catalog number', 'order number', 'sku'], mfr: ['manufacturer', 'mfr', 'brand', 'vendor'], desc: ['description', 'desc', 'name'], cat: ['category', 'cat', 'type', 'group'], tech: ['technical data', 'tech', 'details', 'specs'], price: ['price', 'cost', 'unit price'], watts: ['watts', 'w', 'va', 'watts / va', 'load'], url: ['datasheet', 'datasheet link', 'url', 'link'], w: ['width', 'width (mm)'], h: ['height', 'height (mm)'], d: ['depth', 'depth (mm)'] };
function importPartsCSV(text) {
  const rows = parseCSV(text); if (rows.length < 2) return 0;
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = {}; for (const [k, al] of Object.entries(PART_ALIASES)) { const i = head.findIndex(h => al.includes(h)); if (i >= 0) col[k] = i; }
  if (col.pn == null) { alert('The CSV file needs a "Part number" column.'); return 0; }
  let n = 0;
  for (const r of rows.slice(1)) {
    const p = {}; for (const [k, i] of Object.entries(col)) { const v = (r[i] || '').trim(); if (v) p[k] = v; }
    if (!p.pn) continue;
    const ex = PARTS.find(x => x.pn === p.pn); if (ex) Object.assign(ex, p); else PARTS.push(p); n++;
  }
  return n;
}
function pickPartFor() {
  const f = findItem([...sel][0]); const o = f && (f.it || f.cab); if (!o) return;
  partsDlg(pn => commit(() => { if (f.it) applyPart(f.it, pn); else o.part = pn; }));
}
function partInfoHTML(pn) {
  const p = partOf(pn); if (!pn) return '';
  if (!p) return '<div class="note">Not in the parts database.</div>';
  return `<div class="note">${esc([p.mfr, p.desc].filter(Boolean).join(', '))}${p.price ? ' · ' + money(p.price) : ''}${p.watts ? ' · ' + esc(p.watts) + ' W' : ''}${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener">datasheet</a>` : ''}</div>`;
}
