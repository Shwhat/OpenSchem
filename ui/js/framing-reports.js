// ---------- framing reports: lumber list, cut list and cutting plan per building ----------
const FR_SECS = ['Floor', 'Front wall', 'Right wall', 'Back wall', 'Left wall', 'Wall', 'Roof'];
const FR_ORDER = ['Skid', 'Rim joist', 'Floor joist', 'Bottom plate', 'Top plate', 'Cap plate', 'End stud', 'Stud', 'King stud', 'Jack stud', 'Header', 'Header spacer', 'Sill plate', 'Cripple over header', 'Cripple under sill', 'Gable stud', 'Rake wall stud', 'Ridge board', 'Rafter', 'Barge rafter', 'Rafter tie'];
const LUM_COLS = () => [{ h: 'Item', w: 90 }, { h: 'Size', w: 70 }, { h: 'Length or sheet size', w: 120 }, { h: 'Qty', w: 30, a: 'middle' }, { h: 'Notes', w: 90 }];
const CUT_COLS = () => [{ h: 'Piece', w: 100 }, { h: 'Size', w: 60 }, { h: 'Length', w: 60 }, { h: 'Qty', w: 30, a: 'middle' }, { h: 'Notes', w: 150 }];
const CPLAN_COLS = () => [{ h: 'Qty', w: 22, a: 'middle' }, { h: 'Board', w: 78 }, { h: 'Cut into', w: 250 }, { h: 'Offcut each', w: 50 }];
const sizeRank = s => { const m = String(s).match(/(\d+)x(\d+)/); return m ? (+m[1]) * 1000 + (+m[2]) : 1e9; };
function frameGroupPieces(pieces) {
  const g = new Map();
  for (const p of pieces) { const k = [p.sec, p.name, p.size, Math.round(p.len * 10), p.note].join('|'); if (!g.has(k)) g.set(k, Object.assign({}, p, { qty: 0 })); g.get(k).qty++; }
  return [...g.values()].sort((a, b) => FR_SECS.indexOf(a.sec) - FR_SECS.indexOf(b.sec) || FR_ORDER.indexOf(a.name) - FR_ORDER.indexOf(b.name) || b.len - a.len);
}
function frameBuyList(M) {
  const g = new Map();
  for (const bd of M.boards) { const k = bd.size + '|' + bd.stock.label; if (!g.has(k)) g.set(k, { size: bd.size, label: bd.stock.ft ? bd.stock.label + ' board' : bd.stock.label, len: bd.stock.len, ft: bd.stock.ft, qty: 0 }); g.get(k).qty++; }
  return [...g.values()].sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.size.localeCompare(b.size) || (a.ft - b.ft) || a.len - b.len);
}
function frameCutPlan(M) {
  const g = new Map();
  for (const bd of M.boards) {
    const cuts = [...bd.cuts].sort((a, b) => b.need - a.need);
    const k = bd.size + '|' + bd.stock.label + '|' + cuts.map(p => p.name + Math.round(p.len)).join(',');
    if (!g.has(k)) g.set(k, { bd, cuts, qty: 0 }); g.get(k).qty++;
  }
  return [...g.values()].sort((a, b) => sizeRank(a.bd.size) - sizeRank(b.bd.size) || a.bd.size.localeCompare(b.bd.size) || b.bd.stock.len - a.bd.stock.len);
}
function frameSpacerSheets(M) {
  const sp = M.pieces.filter(p => p.ply); if (!sp.length) return null;
  const area = sp.reduce((a, p) => a + p.len * (p.wide || 0), 0), sheet = LC().sheetW * LC().sheets[0];
  return { n: sp.length, sheets: Math.max(1, Math.ceil(area / sheet)) };
}
function frameSheetText(s) { return lumberKey() === 'na' ? `4' x ${Math.round(s.l / IN_MM / 12)}'` : `${Math.round(s.w)} x ${Math.round(s.l)} mm`; }
function buildFramingReports(reps) {
  (P.buildings || []).forEach((b, bi) => {
    const M = frameModel(b); if (!M.boards) return;
    const link = v => { const pg = P.pages.find(p => p.bld === b.id && p.view === v); return pg ? pg.id : ''; };
    const secPage = sec => link(sec === 'Floor' ? 'floor' : sec === 'Roof' ? 'roof' : sec === 'Wall' ? 'wall' : sec.split(' ')[0].toLowerCase());
    const first = link(b.mode === 'wall' ? 'wall' : 'plan');
    const n = bi + 1;
    // lumber list
    const rows = [{ cells: ['Boards to buy', '', '', '', ''], cls: 'grp', link: first, goto: 'page:' + first }];
    for (const x of frameBuyList(M)) rows.push({ cells: ['Lumber', x.size, x.label, String(x.qty), x.size.includes(LC().treated) ? 'treated for ground contact' : ''], link: first });
    rows.push({ cells: ['Total boards', '', '', String(M.boards.length), ''], cls: 'grp' });
    const sp = frameSpacerSheets(M);
    if (M.sheets.length || sp) {
      rows.push({ cells: ['Sheet goods', '', '', '', ''], cls: 'grp' });
      for (const s of M.sheets) rows.push({ cells: [s.sec === 'Floor' ? 'Floor decking' : s.sec === 'Walls' ? 'Wall sheathing' : 'Roof sheathing', s.mat, frameSheetText(s), String(s.count), s.sec === 'Walls' ? 'openings not deducted' : ''], link: secPage(s.sec === 'Walls' ? (b.mode === 'wall' ? 'Wall' : 'Front wall') : s.sec) });
      if (sp) rows.push({ cells: ['Header spacers', LC().spacer, sp.n + ' strips', String(sp.sheets), 'offcuts work'] });
    }
    mkReport(reps, { id: 'rep:lumber:' + b.id, report: 'lumber', bld: b.id, num: 'LUM' + n, desc: 'Lumber list ' + b.name, title: 'Lumber list ' + b.name }, rows, LUM_COLS());
    // cut list
    const cr = []; let sec = null;
    for (const x of frameGroupPieces(M.pieces)) {
      if (x.sec !== sec) { sec = x.sec; cr.push({ cells: [sec, '', '', '', ''], cls: 'grp', link: secPage(sec), goto: 'page:' + secPage(sec) }); }
      cr.push({ cells: [x.name, x.size, fmtCut(x.len), String(x.qty), x.note], link: secPage(sec) });
    }
    cr.push({ cells: ['Total pieces', '', '', String(M.pieces.length), ''], cls: 'grp' });
    mkReport(reps, { id: 'rep:cutlist:' + b.id, report: 'cutlist', bld: b.id, num: 'CUT' + n, desc: 'Cut list ' + b.name, title: 'Cut list ' + b.name }, cr, CUT_COLS());
    // cutting plan
    const pr = frameCutPlan(M).map(x => ({ cells: [String(x.qty), x.bd.size + ' ' + (x.bd.stock.ft ? x.bd.stock.label : x.bd.stock.label), x.cuts.map(p => p.name + ' ' + fmtCut(p.len)).join(', '), fmtCut(x.bd.offcut)] }));
    mkReport(reps, { id: 'rep:cutplan:' + b.id, report: 'cutplan', bld: b.id, num: 'CPL' + n, desc: 'Cutting plan ' + b.name, title: 'Cutting plan ' + b.name }, pr, CPLAN_COLS());
  });
}
async function frameExportXlsx() {
  const list = (P.buildings || []).map(b => ({ b, M: frameModel(b) })).filter(x => x.M.boards);
  if (!list.length) { flash('No buildings with a lumber list yet'); return; }
  const sheets = [], used = new Set();
  const nm = s => { let n = s.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31); let i = 2; while (used.has(n)) n = (s.slice(0, 27) + ' ' + i++).slice(0, 31); used.add(n); return n; };
  for (const { b, M } of list) {
    const lum = [['Item', 'Size', 'Length or sheet size', 'Qty']];
    for (const x of frameBuyList(M)) lum.push(['Lumber', x.size, x.label, x.qty]);
    lum.push(['Total boards', '', '', M.boards.length]);
    for (const s of M.sheets) lum.push([s.sec === 'Floor' ? 'Floor decking' : s.sec === 'Walls' ? 'Wall sheathing' : 'Roof sheathing', s.mat, frameSheetText(s), s.count]);
    const sp = frameSpacerSheets(M); if (sp) lum.push(['Header spacers', LC().spacer, sp.n + ' strips', sp.sheets]);
    sheets.push({ name: nm('Lumber ' + b.name), rows: lum });
    sheets.push({ name: nm('Cut list ' + b.name), rows: [['Section', 'Piece', 'Size', 'Length', 'Length (mm)', 'Qty', 'Notes']].concat(frameGroupPieces(M.pieces).map(x => [x.sec, x.name, x.size, fmtCut(x.len), Math.round(x.len), x.qty, x.note])) });
    sheets.push({ name: nm('Cutting plan ' + b.name), rows: [['Qty', 'Board', 'Cut into', 'Offcut each']].concat(frameCutPlan(M).map(x => [x.qty, x.bd.size + ' ' + x.bd.stock.label, x.cuts.map(p => p.name + ' ' + fmtCut(p.len)).join(', '), fmtCut(x.bd.offcut)])) });
  }
  const bytes = buildXlsx(sheets);
  const p = await host.saveBinary(b64Encode(bytes), (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' framing materials.xlsx', 'Excel workbook', 'xlsx'); if (p) flash('Exported ' + p);
}
