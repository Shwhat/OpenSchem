// Automatic connections between facing connection points, and round and oval rooms.
export const tests = {
  'auto connect: placing a symbol in line joins facing points, toggles off': async t => {
    await t.open(); await t.eval(() => { PREFS.autoConnect = true; });
    await t.eval(() => setMode('place', 'no')); await t.click(100, 60); await t.key('Escape');
    await t.eval(() => setMode('place', 'coil')); await t.click(100, 120);
    // preview while placing
    await t.eval(() => setMode('place', 'coil')); const [x, y] = await t.scr(160, 120); await t.page.mouse.move(x, y);
    await t.key('Escape');
    t.eq(await t.eval(() => page().wires.map(w => [w.pts, !!w.auto])), [[[[100, 68], [100, 112]], true]]);
    // a symbol in the way blocks it, a side-by-side symbol does not connect
    await t.eval(() => setMode('place', 'coil')); await t.click(140, 120); await t.key('Escape');
    t.eq(await t.eval(() => page().wires.length), 1);
    // turning it off
    await t.eval(() => toggleAutoConnect());
    await t.eval(() => setMode('place', 'no')); await t.click(140, 60); await t.key('Escape');
    t.eq(await t.eval(() => page().wires.length), 1);
    await t.eval(() => toggleAutoConnect());
    t.eq(await t.eval(() => PREFS.autoConnect), true);
  },
  'auto connect: moving out of line removes the connection, moving back reconnects': async t => {
    await t.open(); await t.eval(() => { PREFS.autoConnect = true; });
    await t.eval(() => setMode('place', 'no')); await t.click(100, 60); await t.key('Escape');
    await t.eval(() => setMode('place', 'coil')); await t.click(100, 120); await t.key('Escape'); await t.key('Escape');
    t.eq(await t.eval(() => page().wires.length), 1);
    await t.drag(100, 120, 140, 120);
    t.eq(await t.eval(() => page().wires.length), 0, 'crooked automatic connection removed');
    await t.key('Escape'); await t.drag(140, 120, 100, 124);
    t.eq(await t.eval(() => page().wires.map(w => w.pts)), [[[100, 68], [100, 116]]]);
    await t.key('Control+z'); t.eq(await t.eval(() => page().wires.length), 0);
  },
  'auto connect does not double up a point that already has a wire': async t => {
    await t.open();
    await t.eval(() => setMode('place', 'no')); await t.click(100, 60); await t.key('Escape');
    await t.key('w'); await t.click(100, 68); await t.click(100, 90); await t.key('Escape'); await t.key('Escape');
    await t.eval(() => { PREFS.autoConnect = true; setMode('place', 'coil'); }); await t.click(100, 120); await t.key('Escape');
    t.eq(await t.eval(() => page().wires.length), 1);
  },
  'round and oval rooms: draw, contain devices, resize, change shape': async t => {
    await t.open('#home');
    await t.eval(() => goPage(P.pages.find(p => isFloor(p) && p.view === 'level').id));
    t.promptAnswer = 'X';
    await t.eval(() => setMode('roomcirc'));
    const sh = p => t.eval(q => toSheet(page(), q[0], q[1]), p);
    await t.drag(...await sh([300, 150]), ...await sh([340, 170]));
    await t.page.fill('input[name="name"]', 'Foyer'); await t.confirm();
    const r = await t.eval(() => levelOf(page()).rooms.find(r => r.name === 'Foyer'));
    t.eq([r.shape, r.pts], ['circle', [[300, 150], [340, 150], [340, 190], [300, 190]]], 'square bounding box');
    t.ok(await t.eval(() => !!document.querySelector('#content ellipse.roomp')), 'drawn as an ellipse');
    t.eq(await t.eval(() => roomAt(levelOf(page()), [320, 170]).name), 'Foyer');
    t.ok(await t.eval(() => (roomAt(levelOf(page()), [301, 151]) || {}).name !== 'Foyer'), 'corner of the box is outside the circle');
    // resize by its right wall: stays round
    await t.eval(id => { setMode('select'); sel = new Set([id]); render(); }, r.id);
    const p0 = await t.scr(...await sh([340, 170])), p1 = await t.scr(...await sh([360, 170]));
    await t.page.mouse.move(...p0); await t.page.mouse.down(); await t.page.mouse.move(...p1, { steps: 4 }); await t.page.mouse.up();
    const b = await t.eval(id => bboxPts(levelOf(page()).rooms.find(r => r.id === id).pts), r.id);
    t.eq([b[2] - b[0], b[3] - b[1]], [60, 60]);
    // oval room by dragging a box, then switch shape in properties
    await t.eval(() => setMode('roomoval'));
    await t.drag(...await sh([300, 40]), ...await sh([350, 60]));
    await t.page.fill('input[name="name"]', 'Nook'); await t.confirm();
    const o = await t.eval(() => levelOf(page()).rooms.find(r => r.name === 'Nook'));
    t.eq(o.shape, 'ellipse');
    await t.eval(id => { setMode('select'); sel = new Set([id]); render(); }, o.id);
    await t.page.selectOption('[data-k="room.shape"]', '');
    t.eq(await t.eval(id => levelOf(page()).rooms.find(r => r.id === id).shape, o.id), undefined);
  },
};
