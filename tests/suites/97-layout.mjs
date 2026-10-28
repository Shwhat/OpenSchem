// 2D panel layout pages.
export const tests = {
  'panel layout: new page, place devices and rails, move, rotate, footprint from part': async t => {
    await t.open('#ind');
    await t.eval(() => newLayoutPage());
    await t.page.fill('input[name="fn"]', 'M01'); await t.page.fill('input[name="loc"]', 'CP1'); await t.confirm();
    t.eq(await t.eval(() => [page().kind, page().num, page().scale, pageName(page())]), ['layout', 'L1', 5, '=M01+CP1/L1']);
    t.ok(await t.eval(() => allPages().indexOf(page()) > P.pages.filter(p => !p.kind).length), 'after the schematic pages');
    const un = await t.eval(() => [...document.querySelectorAll('[data-layplace]')].map(e => e.textContent));
    t.ok(un.some(s => s.includes('-K1')) && !un.some(s => s.includes('-M1')), 'cabinet devices listed, motor left out: ' + un.join(' | '));
    // DIN rail by dragging
    await t.eval(() => setMode('lrail'));
    const [a, b] = await t.eval(() => toLSheet(page(), 20, 100)); const [c, d] = await t.eval(() => toLSheet(page(), 520, 100));
    await t.drag(a, b, c, d);
    t.eq(await t.eval(() => page().lay.map(o => [o.t, o.x, o.y, o.w, o.h])), [['rail', 20, 100, 500, 35]]);
    // place K1
    await t.eval(() => { setMode('select'); sel.clear(); render(); }); await t.page.click('[data-layplace] >> text=-K1');
    const [px, py] = await t.eval(() => toLSheet(page(), 100, 120));
    await t.click(px, py);
    const k = await t.eval(() => page().lay.find(o => o.t === 'dev'));
    t.eq([k.w, k.h], [45, 85]); t.ok(Math.abs(k.x - 77.5) <= 2.5 && k.x % 5 === 0, 'centered on the click, on the 5 mm grid');
    t.ok(await t.eval(() => $('#content').textContent.includes('-K1')), 'label drawn');
    // move it 50 mm right
    const [sx, sy] = await t.eval(() => toLSheet(page(), 100, 120));
    await t.drag(sx, sy, sx + 10, sy);
    t.eq(await t.eval(() => page().lay.find(o => o.t === 'dev').x), k.x + 50);
    await t.key('r'); t.eq(await t.eval(() => { const o = page().lay.find(o => o.t === 'dev'); return [o.w, o.h]; }), [85, 45]);
    // part width and height decide the footprint
    await t.eval(() => { PARTS = [{ pn: 'BIG', w: '120', h: '200' }]; const f = [...allItems()].find(i => i.tag === 'Q1' && i.role === 'main'); f.part = 'BIG'; sel.clear(); render(); });
    t.ok(await t.eval(() => [...document.querySelectorAll('[data-layplace]')].some(e => e.textContent.includes('-Q1') && e.textContent.includes('120 × 200'))));
    // scale change redraws, undo works, delete
    await t.eval(() => { sel.clear(); render(); });
    await t.page.fill('[data-k="lpg.scale"]', '10'); await t.page.press('[data-k="lpg.scale"]', 'Tab');
    t.eq(await t.eval(() => page().scale), 10);
    await t.eval(() => document.activeElement.blur()); await t.key('Control+z'); t.eq(await t.eval(() => page().scale), 5);
    await t.eval(() => { sel = new Set(page().lay.map(o => o.id)); }); await t.key('Delete');
    t.eq(await t.eval(() => page().lay.length), 0);
    // graphics and dimensions work on layout pages, with real lengths
    await t.eval(() => gfxMode('dim'));
    await t.click(...await t.eval(() => toLSheet(page(), 0, 300))); await t.click(...await t.eval(() => toLSheet(page(), 200, 300)));
    t.ok(await t.eval(() => /200 mm/.test(dimText(page().gfx[0], page()))), 'dimension in real mm');
  },
};
