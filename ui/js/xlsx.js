// ---------- minimal .xlsx writer and reader (no external library) ----------
// Writer: one or more worksheets with text and number cells, bold header row, stored uncompressed in a zip.
// Reader: first worksheet (or one by name), shared or inline strings, numbers; handles stored and deflated zip entries.
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(); const parts = [], cen = []; let off = 0;
  for (const [name, text] of files) {
    const nb = enc.encode(name), data = typeof text === 'string' ? enc.encode(text) : text, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + data.length;
  }
  const csize = cen.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...cen, new Uint8Array(e.buffer)]; const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
const xesc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
// sheets: [{ name, rows: [[cell...]...], widths: [chars...] }]; first row is the header
function buildXlsx(sheets) {
  const sheetXml = sh => {
    const cols = sh.widths ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1); const st = ri === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      if (v == null || v === '') return '';
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  };
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF4"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zipStore(files);
}
async function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let e = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip file');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = new Map(); const dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    const raw = bytes.subarray(ds, ds + csize);
    out.set(name, { method, raw });
    p += 46 + nl + el + cl;
  }
  return {
    has: name => out.has(name),
    async text(name) {
      const f = out.get(name); if (!f) return null;
      if (f.method === 0) return dec.decode(f.raw);
      if (f.method !== 8) throw new Error('unsupported compression');
      const s = new Blob([f.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return dec.decode(new Uint8Array(await new Response(s).arrayBuffer()));
    },
  };
}
const colIndex = ref => { const m = /^([A-Z]+)/.exec(ref || ''); let n = 0; if (m) for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
async function readXlsx(bytes, wantName) {
  const z = await unzip(bytes); const P_ = new DOMParser();
  const xml = async n => { const t = await z.text(n); return t == null ? null : P_.parseFromString(t, 'application/xml'); };
  const wb = await xml('xl/workbook.xml'); if (!wb) throw new Error('no workbook in file');
  const rels = await xml('xl/_rels/workbook.xml.rels');
  const sheets = [...wb.getElementsByTagName('sheet')];
  const sh = sheets.find(s => wantName && s.getAttribute('name').toLowerCase() === wantName.toLowerCase()) || sheets[0];
  const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  let target = 'worksheets/sheet1.xml';
  if (rels) for (const r of rels.getElementsByTagName('Relationship')) if (r.getAttribute('Id') === rid) target = r.getAttribute('Target');
  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  const sst = await xml('xl/sharedStrings.xml');
  const strings = sst ? [...sst.getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  const ws = await xml(path); if (!ws) throw new Error('worksheet not found');
  const rows = [];
  for (const r of ws.getElementsByTagName('row')) {
    const ri = (parseInt(r.getAttribute('r'), 10) || rows.length + 1) - 1; const row = [];
    for (const c of r.getElementsByTagName('c')) {
      const t = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0];
      let val = '';
      if (t === 's') val = strings[+(v && v.textContent)] ?? '';
      else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
      else if (v) val = v.textContent;
      row[colIndex(c.getAttribute('r'))] = val;
    }
    rows[ri] = Array.from(row, x => x ?? '');
  }
  return Array.from(rows, x => x || []);
}
const b64Encode = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const b64Decode = b64 => { const s = atob(b64); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };

// ---------- device list export/import ----------
const XL_COLS = () => [
  ['id', 'ID'], ['fn', home() ? 'Circuit' : 'Function (=)'], ['loc', home() ? 'Room' : 'Location (+)'], ['tag', home() ? 'Name' : 'Device tag (-)'],
  ['full', 'Full tag'], ['sym', 'Symbol'], ['desc', home() ? 'Description' : 'Function text'], ['part', 'Part number'], ['mfr', 'Manufacturer'],
  ['tech', home() ? 'Details' : 'Technical data'], ['va', 'Load (VA)'], ['page', 'Page'],
];
const XL_EDIT = ['fn', 'loc', 'tag', 'desc', 'part', 'tech', 'va'];
const XL_HEAD = { id: ['id'], fn: ['function (=)', 'function', 'circuit', '='], loc: ['location (+)', 'location', 'room', '+'], tag: ['device tag (-)', 'device tag', 'name', 'tag', '-'], desc: ['function text', 'description'], part: ['part number', 'part'], tech: ['technical data', 'details'], va: ['load (va)', 'load', 'va', 'watts'] };
function deviceRowsForExcel() {
  buildIndex();
  const rows = [];
  const add = (it, pgName) => {
    const p = partOf(it.part) || {};
    rows.push({ id: it.id, fn: it.fn || '', loc: it.loc || '', tag: it.tag || '', full: fullIdent(it), sym: SYM[it.sym] ? SYM[it.sym].name : it.sym, desc: it.desc || '', part: it.part || '', mfr: p.mfr || '', tech: it.tech || '', va: it.va != null && it.va !== '' ? pnum(it.va) : '', page: pgName });
  };
  for (const d of [...IX.dev.values()].sort((a, b) => natCmp(a.fn, b.fn) || natCmp(a.loc, b.loc) || natCmp(a.tag, b.tag))) {
    if (d.items.some(i => i.sym === 'term')) continue;
    const it = d.main || d.items[0]; const pp = IX.pos.get(it.id); add(it, pp && pp.pg ? pageName(pp.pg) : 'floor plan only');
  }
  return rows;
}
async function exportDevicesXlsx() {
  const cols = XL_COLS(); const data = deviceRowsForExcel();
  const bytes = buildXlsx([{ name: 'Devices', rows: [cols.map(c => c[1])].concat(data.map(r => cols.map(([k]) => r[k]))), widths: [11, 14, 14, 14, 26, 20, 36, 18, 16, 24, 10, 14] }]);
  const name = (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' devices.xlsx';
  const p = await host.saveBinary(b64Encode(bytes), name, 'Excel workbook', 'xlsx'); if (p) flash('Exported ' + p);
}
async function exportBOMXlsx() {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers();
  const rows = bomRows();
  const bytes = buildXlsx([{ name: 'Bill of materials', rows: [['Pos', 'Qty', 'Part number', 'Manufacturer', 'Description', 'Technical data', 'Device tags', 'Unit price', 'Total']].concat(rows.map(r => [r.pos, r.qty, r.part, r.mfr, r.desc, r.tech, r.tags.join(', '), r.price ?? '', r.total ?? ''])), widths: [6, 6, 18, 16, 36, 24, 40, 11, 11] }]);
  const p = await host.saveBinary(b64Encode(bytes), (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' BOM.xlsx', 'Excel workbook', 'xlsx'); if (p) flash('Exported ' + p);
}
// updates devices that match by ID; never creates or deletes devices
function applyDeviceRows(rows) {
  const head = (rows[0] || []).map(h => String(h).trim().toLowerCase());
  const col = {}; for (const [k, al] of Object.entries(XL_HEAD)) { const i = head.findIndex(h => al.includes(h)); if (i >= 0) col[k] = i; }
  if (col.id == null) return { error: 'The sheet needs the ID column from an OpenSchem export.' };
  let updated = 0, unknown = 0, changes = 0;
  commit(() => {
    for (const r of rows.slice(1)) {
      const id = String(r[col.id] ?? '').trim(); if (!id) continue;
      const it = itemById(id); if (!it) { unknown++; continue; }
      let ch = 0;
      for (const k of XL_EDIT) {
        if (col[k] == null) continue;
        let v = String(r[col[k]] ?? '').trim();
        const cur = k === 'va' ? (it.va == null ? '' : String(it.va)) : String(it[k] ?? '');
        if (k === 'va' && v !== '' && pnum(v) === pnum(cur) && cur !== '') continue;
        if (v === cur) continue;
        applyItemChange(it, k, v); ch++;
      }
      if (ch) { updated++; changes += ch; }
    }
  });
  return { updated, unknown, changes };
}
async function importDevicesXlsx() {
  const r = await host.openBinary('Excel workbook', 'xlsx'); if (!r) return;
  try {
    const rows = await readXlsx(b64Decode(r.content), 'Devices');
    const res = applyDeviceRows(rows);
    if (res.error) { alert(res.error); return; }
    dialog('Excel import', [], null, 'OK', `<p>${res.updated} device(s) updated (${res.changes} change(s)).${res.unknown ? `<br>${res.unknown} row(s) with an ID not in this project were skipped.` : ''}</p><div class="note">Import only changes existing devices. Rows are matched by ID, and devices are never added or deleted. Use Undo to reverse the import.</div>`);
  } catch (e) { alert('Could not read the Excel file: ' + e.message); }
}
