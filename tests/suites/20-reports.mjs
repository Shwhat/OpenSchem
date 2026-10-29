// Generated report pages.
const rows = (t, kind) => t.eval(k => REPORTS.filter(r => r.report === k).flatMap(r => r.rows.map(x => x.cells.map(c => c.join(' ')))), kind);

export const tests = {
  'industrial demo: report set and terminal diagram targets': async t => {
    await t.open('#ind');
    t.eq(await t.eval(() => REPORTS.map(r => r.report)), ['cover', 'toc', 'bom', 'term', 'term', 'conn', 'conn']);
    const x1 = await t.eval(() => terminalRows([...IX.dev.values()].find(d => d.tag === 'X1')).map(r => [r.tn, r.intT, r.extT]));
    t.eq(x1, [['1', '-K1:24', '-P1:X1'], ['2', '-P1:X2', '> L21, -F1:96']]);
  },
  'BOM groups by part number and flags missing parts': async t => {
    await t.open('#ind');
    const bom = await t.eval(() => bomRows().map(r => [r.qty, r.part, r.missing]));
    t.ok(bom.some(r => r[0] === 2 && r[1] === 'SCH.DF101'), 'two fuses share one row');
    t.eq(bom.filter(r => r[2]).length, 2, 'devices without part numbers');
    t.ok(bom.findIndex(r => r[2]) > bom.findIndex(r => !r[2]), 'missing parts sorted last');
  },
  'home demo: panel schedule rows with rooms': async t => {
    await t.open('#home');
    t.eq(await rows(t, 'panel'), [
      ['1', 'CKT 1', 'Breaker 1', '15', '1', 'Standard', 'Kitchen and dining lights', 'Dining, Kitchen', '120', '6.7%', ''],
      ['2', 'CKT 2', 'Breaker 2', '20', '1', 'Standard', 'Kitchen and dining outlets', 'Dining, Kitchen', '540', '22.5%', ''],
      ['3', 'CKT 3', 'Breaker 3', '20', '1', 'GFCI', 'Bathroom', 'Bath', '135', '5.6%', ''],
      ['5', 'CKT 4', 'Breaker 4', '30', '2', '2-pole', 'Dryer', 'Laundry', '', '', ''],
      ['', '', '', '', '', '', 'Panel total: 795 VA, 3.3 A at 240 V', '', '795', '', '']]);
  },
  'long reports continue on extra sheets': async t => {
    await t.open('#ind');
    await t.eval(() => { const pg = P.pages[1]; for (let i = 0; i < 80; i++) pg.items.push({ id: 'tt' + i, sym: 'term', x: 300, y: 20 + i, rot: 0, fn: 'M01', loc: 'CP1', tag: 'X9', tn: String(i + 1), role: 'term', cl: ['', ''] }); render(); });
    t.eq(await t.eval(() => REPORTS.filter(r => r.id.includes('X9')).map(r => r.sheet + '/' + r.sheets)), ['1/3', '2/3', '3/3']);
  },
  'table of contents lists every page and is clickable': async t => {
    await t.open('#home');
    const toc = await rows(t, 'toc');
    t.eq(toc.length, await t.eval(() => allPages().length));
    await t.eval(() => goPage('rep:toc:1'));
    await t.page.click('.reprow >> nth=2');
    t.eq(await t.eval(() => pageName(page())), 'CKT 1/1');
  },
  'connection list sources and targets': async t => {
    await t.open('#home');
    const c = await rows(t, 'conn');
    t.ok(c.some(r => r[1].includes('Kitchen · Switch 1:SW') && r[2].includes('Kitchen · Light 1:H')), 'switch leg row');
  },
  'clicking a report row jumps to the device': async t => {
    await t.open('#ind');
    await t.eval(() => goPage(REPORTS.find(r => r.report === 'bom').id));
    await t.page.click('.reprow');
    t.eq(await t.eval(() => [isFloor(page()) || !!page().report, sel.size]), [false, 1]);
  },
};
