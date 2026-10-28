// ---------- load calculation and voltage drop (home circuits) ----------
const LOAD_DEFAULTS = { rout: 180, routgf: 180, routsw: 180, rout240: 0, rlgt: 60, rfan: 75, rsmk: 5, rapp: 0, rjbx: 0 };
const loadDefaults = () => Object.assign({}, LOAD_DEFAULTS, S().loadDefaults || {});
const hasLoad = d => d && d.res && !d.brk && d.prefix && d.prefix !== 'PNL' && !d.sw && d.role !== 'bar';
// load of one device in VA: entered value, else the part's watts, else the default for its symbol
function deviceLoad(it) {
  const d = SYM[it.sym]; if (!hasLoad(d)) return 0;
  if (it.va != null && it.va !== '') return pnum(it.va);
  const p = partOf(it.part); if (p && p.watts) return pnum(p.watts);
  return pnum(loadDefaults()[it.sym] ?? 0);
}
const CM = { 14: 4110, 12: 6530, 10: 10380, 8: 16510, 6: 26240, 4: 41740, 3: 52620, 2: 66360, 1: 83690 };
const K_CU = 12.9;
// run length in feet from a text like "25 ft", "7.5 m" or "30"
function feet(v) { const s = String(v || '').toLowerCase(); const n = pnum(s); return /\bm\b|meter|metre/.test(s) && !/ft|feet|'/.test(s) ? n * 3.281 : n; }
function circuitInfo(brk) {
  const d = SYM[brk.sym]; const fn = brk.fn || '';
  const volts = d.poles === 2 ? 240 : 120;
  const amps = pnum(brk.amps || d.amps);
  let load = 0;
  if (fn) for (const it of allItems()) if (it.fn === fn && it !== brk) load += deviceLoad(it);
  if (fn) load += blockLoad(fn);
  // wire size: the smallest wire (largest AWG number) on the circuit's pages, else the default size
  let awg = 0;
  for (const p of P.pages) if (!isFloor(p) && fn && p.fn === fn) for (const w of p.wires) if (w.awg && +w.awg > awg) awg = +w.awg;
  if (!awg) awg = +(S().defAwg || 14);
  let len = feet(brk.run);
  if (!len && fn) for (const p of P.pages) if (!isFloor(p) && p.fn === fn) for (const c of p.cables || []) len += feet(c.len);
  const cur = volts ? load / volts : 0;
  const vd = len && CM[awg] ? (2 * K_CU * cur * len / CM[awg]) / volts * 100 : null;
  return { fn, volts, amps, load, pct: amps ? load / (amps * volts) * 100 : 0, awg, len, vd, cur };
}
const fmtPct = v => v == null ? '' : (Math.round(v * 10) / 10) + '%';

function loadDefaultsDlg() {
  const d = loadDefaults();
  const keys = Object.keys(LOAD_DEFAULTS);
  dialog('Load defaults', keys.map(k => [k, SYM[k].name + ' (VA)', String(d[k]), 'number']), v => {
    commit(() => { S().loadDefaults = Object.fromEntries(keys.map(k => [k, pnum(v[k])])); });
  }, 'OK', '<div class="note">Used for devices that have no load entered and no part with watts. Enter appliance loads on the device itself.</div>');
}

// ---------- panel directory (printable breaker labels) ----------
function panelDirectorySVG(pn, size) {
  const groups = panelRows(); const list = groups.get(pn) || [];
  const brks = [...allItems()].filter(it => SYM[it.sym] && SYM[it.sym].brk && (it.panel || [...groups.keys()][0] || '') === pn);
  const bySlot = new Map();
  for (const b of brks) {
    const s = parseInt(b.slot, 10); if (!s) continue;
    const info = circuitInfo(b); const row = list.find(r => r.goto === b.id) || {};
    const txt = row.desc || (b.fn ? friendlyCkt(b.fn) : dispTag(b.tag));
    bySlot.set(s, { text: txt, amps: info.amps, poles: SYM[b.sym].poles, rooms: row.rooms || '' });
    if (SYM[b.sym].poles === 2) bySlot.set(s + 2, { cont: s, amps: info.amps });
  }
  const maxSlot = Math.max(20, ...[...bySlot.keys()]);
  const rows = Math.ceil(maxSlot / 2);
  const [W, H] = size === 'label' ? [101.6, 152.4] : [215.9, 279.4];
  const m = size === 'label' ? 5 : 12;
  const title = 'Panel directory' + (pn ? ': ' + dispTag(pn) : '');
  const head = size === 'label' ? 9 : 22;
  const rh = Math.min(size === 'label' ? 9 : 11, (H - m * 2 - head - 6) / rows);
  const cw = (W - m * 2) / 2; const fs = Math.min(rh * 0.42, size === 'label' ? 2.6 : 3.4);
  let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
  s += `<text x="${m}" y="${m + (size === 'label' ? 4 : 7)}" font-size="${size === 'label' ? 4 : 6.5}" font-weight="bold" font-family="Arial">${esc(title)}</text>`;
  if (size !== 'label') s += `<text x="${m}" y="${m + 14}" font-size="3.6" font-family="Arial" fill="#444">${esc([P.name, P.desc].filter(Boolean).join(' · '))}</text><text x="${W - m}" y="${m + 14}" font-size="3.2" font-family="Arial" fill="#444" text-anchor="end">${esc(today())}</text>`;
  const y0 = m + head;
  for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) {
    const slot = r * 2 + c + 1; const x = m + c * cw, y = y0 + r * rh; const e = bySlot.get(slot);
    s += `<rect x="${x}" y="${y}" width="${cw}" height="${rh}" fill="none" stroke="#333" stroke-width="0.25"/>`;
    const nx = c === 0 ? x + 2 : x + cw - 2;
    s += `<text x="${nx}" y="${y + rh * 0.62}" font-size="${fs}" font-family="Arial" font-weight="bold" text-anchor="${c === 0 ? 'start' : 'end'}">${slot}</text>`;
    if (!e) continue;
    const tx = c === 0 ? x + fs * 2.6 : x + 2; const ax = c === 0 ? x + cw - 2 : x + cw - fs * 2.6;
    const label = e.cont ? `(2-pole, with ${e.cont})` : e.text;
    s += `<text x="${tx}" y="${y + rh * (e.rooms && !e.cont && size !== 'label' ? 0.45 : 0.62)}" font-size="${fs}" font-family="Arial">${esc(label.length > 40 ? label.slice(0, 39) + '…' : label)}</text>`;
    if (e.rooms && !e.cont && size !== 'label') s += `<text x="${tx}" y="${y + rh * 0.82}" font-size="${fs * 0.75}" font-family="Arial" fill="#555">${esc(e.rooms)}</text>`;
    if (!e.cont) s += `<text x="${ax}" y="${y + rh * 0.62}" font-size="${fs}" font-family="Arial" text-anchor="end">${e.amps}A</text>`;
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">${s}</svg>`, W, H };
}
function panelDirectoryDlg() {
  buildIndex(); NETS = computeNets();
  const pans = [...panelRows().keys()];
  if (!pans.length) { flash('No breakers in the project yet'); return; }
  dialog('Breaker labels', [
    ['pn', 'Panel', pans[0], 'select', pans.map(p => [p, p ? dispTag(p) : '(no panel)'])],
    ['size', 'Size', 'letter', 'select', [['letter', 'Letter page (8.5 × 11 in)'], ['label', 'Door label (4 × 6 in, trim to fit)']]],
    ['out', 'Output', 'pdf', 'select', [['pdf', 'Save as PDF'], ['print', 'Print']]],
  ], async v => {
    const d = panelDirectorySVG(v.pn, v.size);
    if (v.out === 'print') {
      const st = document.createElement('style'); st.id = 'pdstyle'; st.textContent = `@media print{@page{size:${d.W}mm ${d.H}mm;margin:0}#printarea svg{width:${d.W}mm!important;height:${d.H}mm!important}}`;
      document.head.appendChild(st); $('#printarea').innerHTML = d.svg;
      setTimeout(() => { window.print(); setTimeout(() => st.remove(), 500); }, 50);
      return;
    }
    if (!window.jspdf || !window.svg2pdf) { alert('PDF export is not available in this build.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [d.W, d.H] });
    const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-4000px;top:0'; box.innerHTML = d.svg; document.body.appendChild(box);
    try { await window.svg2pdf.svg2pdf(box.firstElementChild, doc, { x: 0, y: 0, width: d.W, height: d.H }); } finally { box.remove(); }
    const name = (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' panel directory.pdf';
    const p = await host.saveBinary(doc.output('datauristring').split(',')[1], name, 'PDF document', 'pdf'); if (p) flash('Exported ' + p);
  }, 'Create');
}
