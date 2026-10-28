// Page graphics, black boxes, device boxes, PLC cards.
export const tests = {
  'graphics: draw line, rectangle, polyline, dimension; select, move, style, copy, delete, undo': async t => {
    await t.open();
    await t.eval(() => gfxMode('line')); await t.click(100, 100); await t.click(140, 100);
    await t.eval(() => gfxMode('rect')); await t.click(160, 80); await t.click(200, 120);
    await t.eval(() => gfxMode('poly')); await t.click(100, 150); await t.click(120, 170); await t.page.mouse.dblclick(...await t.scr(140, 150));
    await t.eval(() => gfxMode('dim')); await t.click(100, 200); await t.click(152, 200);
    t.eq(await t.eval(() => page().gfx.map(g => [g.t, g.pts.length])), [['line', 2], ['rect', 2], ['poly', 3], ['dim', 2]]);
    t.ok((await t.eval(() => $('#content').textContent)).includes('52 mm'), 'dimension text');
    await t.key('Escape'); await t.key('Escape');
    await t.click(160, 100); // on the rectangle edge
    t.eq(await t.eval(() => [...sel].map(id => findItem(id).g.t)), ['rect']);
    await t.page.selectOption('[data-k="gf.dash"]', 'dash');
    await t.page.fill('[data-k="gf.w"]', '0.7'); await t.page.press('[data-k="gf.w"]', 'Tab');
    t.eq(await t.eval(() => { const g = page().gfx[1]; return [g.dash, g.w]; }), ['dash', 0.7]);
    await t.drag(160, 100, 168, 104);
    t.eq(await t.eval(() => page().gfx[1].pts), [[168, 84], [208, 124]]);
    await t.key('Control+c'); await t.key('Control+v');
    t.eq(await t.eval(() => page().gfx.length), 5);
    await t.key('Delete'); t.eq(await t.eval(() => page().gfx.length), 4);
    await t.key('Control+z'); t.eq(await t.eval(() => page().gfx.length), 5);
    // graphics layer hides them
    await t.eval(() => commit(() => { P.layers = { gfx: { hide: true } }; }));
    t.eq(await t.eval(() => document.querySelectorAll('#content .gfx').length), 0);
  },
  'black box: pins on edges, wires connect and follow resizing': async t => {
    await t.open();
    await t.eval(() => setMode('place', 'bbox')); await t.click(100, 100); await t.key('Escape');
    t.eq(await t.eval(() => connPts(page().items[0]).map(c => [c.x, c.y])), [[108, 100], [116, 100], [108, 116], [116, 116]]);
    t.eq(await t.eval(() => page().items[0].tag), 'A1');
    await t.key('w'); await t.click(108, 116); await t.click(108, 140); await t.key('Escape'); await t.key('Escape');
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.page.fill('[data-k="bx.h"]', '24'); await t.page.press('[data-k="bx.h"]', 'Tab');
    t.eq(await t.eval(() => page().wires[0].pts[0]), [108, 124], 'wire follows the bottom edge');
    await t.page.selectOption('[data-k="pin.0.s"]', 'l');
    t.eq(await t.eval(() => connPts(page().items[0])[0]), { x: 100, y: 108, i: 0 });
    await t.eval(() => bbAddPin());
    t.eq(await t.eval(() => [page().items[0].pins.length, page().items[0].cl[4]]), [5, '5']);
  },
  'device box: symbols inside join the device and move with it': async t => {
    await t.open();
    await t.eval(() => setMode('place', 'dbox')); await t.click(100, 80); await t.key('Escape');
    await t.eval(() => setMode('place', 'coil')); await t.click(120, 92); await t.key('Escape');
    await t.eval(() => setMode('place', 'coil')); await t.click(200, 92); await t.key('Escape');
    const st = () => t.eval(() => page().items.map(i => [i.sym, i.tag, i.role]));
    t.eq(await st(), [['dbox', 'A1', 'main'], ['coil', 'A1', 'aux'], ['coil', 'K1', 'main']]);
    t.eq(await t.eval(() => IX.dev.get(devKey(page().items[0])).items.length), 2);
    await t.key('Escape'); await t.drag(100, 90, 108, 90);
    t.eq(await t.eval(() => [page().items[0].x, page().items[1].x]), [108, 128], 'contents moved');
    // drag the coil out of the box: it becomes its own device again
    await t.key('Escape'); await t.drag(128, 92, 128, 160);
    t.eq(await t.eval(() => page().items[1].role), 'main');
    t.ok(await t.eval(() => page().items[1].tag !== 'A1'), 'new tag');
  },
  'PLC card: channels, addresses and type': async t => {
    await t.open();
    await t.eval(() => setMode('place', 'plccard')); await t.click(100, 100); await t.key('Escape');
    const it = () => t.eval(() => { const i = page().items[0]; return [i.cl.slice(0, 3).concat(i.cl.slice(-1)), connPts(i).length, connPts(i)[0]]; });
    t.eq(await it(), [['%I0.0', '%I0.1', '%I0.2', '%I0.7'], 8, { x: 108, y: 100, i: 0 }]);
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.page.fill('[data-k="bx.ch"]', '16'); await t.page.press('[data-k="bx.ch"]', 'Tab');
    t.eq((await it())[0].slice(-1), ['%I1.7']);
    await t.page.selectOption('[data-k="bx.kind"]', 'AO');
    t.eq(await t.eval(() => [page().items[0].cl[0], page().items[0].cl[1], connPts(page().items[0])[0].y]), ['%QW64', '%QW66', 116]);
  },
};
