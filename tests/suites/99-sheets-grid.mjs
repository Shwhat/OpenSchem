// Paper sizes, align to grid, room resizing, PLC cards with inputs and outputs and variants.
export const tests = {
  'paper sizes: note card page, frame fits, print and PDF use each page size': async t => {
    await t.open();
    await t.eval(() => addPage()); await t.page.fill('input[name="desc"]', 'Card'); await t.page.selectOption('select[name="size"]', 'CARD'); await t.confirm();
    t.eq(await t.eval(() => [page().size, sheetOf(page()).w, sheetOf(page()).h]), ['CARD', 127, 76.2]);
    const r = await t.eval(() => { const b = $('#content .sheet').getBBox(); return [r2(b.width), r2(b.height)]; });
    t.eq(r, [127, 76.2]);
    t.ok(await t.eval(() => $('#content').textContent.includes('Card')), 'title on the card');
    // columns follow the sheet: 4 columns on a card
    t.eq(await t.eval(() => [colOf(10, page()), colOf(120, page()), colOf(120, P.pages[0])]), [1, 4, 3]);
    // reports stay A3, other pages keep A3
    t.eq(await t.eval(() => [sheetOf(P.pages[0]).name, sheetOf(REPORTS[0]).name]), ['A3 landscape', 'A3 landscape']);
    // print area uses the page's size
    await t.eval(() => { window.print = () => {}; printAll(); });
    await t.page.waitForTimeout(80);
    t.ok(await t.eval(() => [...$('#printarea').children].some(s => s.getAttribute('viewBox') === '0 0 127 76.2' && /page:\s*szCARD/.test(s.getAttribute('style')))), 'print sheet size');
    // project default size
    await t.eval(() => commit(() => { P.size = 'A4L'; }));
    t.eq(await t.eval(() => [sheetOf(P.pages[0]).name, sheetOf(page()).name]), ['A4 landscape', 'Note card 3 × 5 in']);
    // page properties panel changes the size
    await t.page.selectOption('[data-k="pg.size"]', 'LTRL');
    t.eq(await t.eval(() => page().size), 'LTRL');
    await t.page.selectOption('[data-k="pg.size"]', 'A4L');
    t.eq(await t.eval(() => page().size), undefined, 'same as the project default is stored as default');
  },
  'align to grid moves symbols onto the grid and wires follow': async t => {
    await t.open();
    await t.eval(() => commit(() => { const pg = page(); pg.items.push(makeItem('coil', 101.5, 98.75, 0, pg)); pg.wires.push({ id: 'w1', pts: [[101.5, 106.75], [101.5, 140]] }); }));
    t.eq(await t.eval(() => [page().items[0].x, page().items[0].y]), [101.5, 98.75]);
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.key('Shift+G');
    t.eq(await t.eval(() => [page().items[0].x, page().items[0].y]), [100, 100]);
    t.eq(await t.eval(() => page().wires[0].pts[0]), [100, 108], 'wire end follows the connection point');
    await t.key('Control+z'); t.eq(await t.eval(() => page().items[0].x), 101.5);
  },
  'floor plan rooms resize by corner and by wall': async t => {
    await t.open('#home');
    await t.eval(() => goPage(P.pages.find(p => isFloor(p) && p.view === 'level').id));
    const rm = await t.eval(() => { const lv = levelOf(page()); const r = lv.rooms[0]; sel = new Set([r.id]); render(); return { id: r.id, pts: r.pts }; });
    t.eq(await t.eval(() => document.querySelectorAll('#content [data-rh]').length), rm.pts.length * 2);
    // drag the first wall (top edge) up by 10
    const [a, b] = rm.pts; const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s0 = await t.eval(m => toSheet(page(), m[0], m[1]), mid), s1 = await t.eval(m => toSheet(page(), m[0], m[1] - 10), mid);
    const p0 = await t.scr(...s0), p1 = await t.scr(...s1);
    await t.page.mouse.move(...p0); await t.page.mouse.down(); await t.page.mouse.move(...p1, { steps: 5 }); await t.page.mouse.up();
    const after = await t.eval(id => levelOf(page()).rooms.find(r => r.id === id).pts, rm.id);
    t.eq([after[0][1], after[1][1]], [a[1] - 10, b[1] - 10]);
    t.eq([after[2], after[3]], [rm.pts[2], rm.pts[3]], 'other corners stay');
    await t.key('Control+z');
    t.eq(await t.eval(id => levelOf(page()).rooms.find(r => r.id === id).pts, rm.id), rm.pts);
    // corner drag keeps the walls square
    const c = rm.pts[2]; const c0 = await t.scr(...await t.eval(m => toSheet(page(), m[0], m[1]), c)), c1 = await t.scr(...await t.eval(m => toSheet(page(), m[0] + 6, m[1] + 6), c));
    await t.eval(id => { sel = new Set([id]); render(); }, rm.id);
    await t.page.mouse.move(...c0); await t.page.mouse.down(); await t.page.mouse.move(...c1, { steps: 5 }); await t.page.mouse.up();
    const p2 = await t.eval(id => levelOf(page()).rooms.find(r => r.id === id).pts, rm.id);
    t.eq(p2[2], [c[0] + 6, c[1] + 6]); t.eq(p2[1][0], c[0] + 6); t.eq(p2[3][1], c[1] + 6);
  },
  'PLC card with inputs and outputs, rotated with variants': async t => {
    await t.open();
    await t.eval(() => setMode('place', 'plccard')); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.page.selectOption('[data-k="bx.kind"]', 'DIO');
    await t.page.fill('[data-k="bx.cho"]', '4'); await t.page.press('[data-k="bx.cho"]', 'Tab');
    const it = () => t.eval(() => { const i = page().items[0]; return { cl: i.cl, pts: connPts(i).map(c => [c.x, c.y]) }; });
    const r = await it();
    t.eq(r.cl.length, 12); t.eq([r.cl[0], r.cl[7], r.cl[8], r.cl[11]], ['%I0.0', '%I0.7', '%Q0.0', '%Q0.3']);
    t.eq([r.pts[0], r.pts[8]], [[108, 100], [108, 116]], 'inputs on top, outputs on the bottom');
    await t.page.selectOption('[data-k="it.variant"]', 'B');
    t.eq(await t.eval(() => [variantOf(page()).items ? 0 : 0, variantOf(page().items[0])]), [0, 'B']);
    t.eq((await it()).pts[0], [100, 108], 'rotated 90 degrees');
    await t.key('Escape'); await t.eval(() => { sel = new Set([page().items[0].id]); render(); }); await t.key('m');
    t.eq(await t.eval(() => variantOf(page().items[0])), 'F');
    // placing with Tab cycles variants for cards
    await t.eval(() => setMode('place', 'plccard'));
    const [x, y] = await t.scr(200, 100); await t.page.mouse.move(x, y); await t.key('Tab');
    await t.click(200, 100); await t.key('Escape');
    t.eq(await t.eval(() => variantOf(page().items[1])), 'B');
  },
};
