// Details from the approved chunk lists: elliptical arcs, multi-line aligned text, device rotate grip, right-click make
// room, hidden and center line types, per-view layers, rooms that follow their walls, room moves updating devices.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
async function blank(t, shapes = []) {
  await t.open('#home'); await goFloor(t);
  await t.eval(sh => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = sh; PREFS.ortho = false; PREFS.polar = false; PREFS.osnapOn = true; sel = new Set(); render(); }, shapes);
}
const shapes = t => t.eval(() => clone(levelOf(page()).shapes));
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const IN = 25.4 / 48;
const W = (id, a, b) => ({ id, t: 'wall', a, b, th: 4.5 * IN, just: 'c', h: 2438.4, kind: '2x4 interior' });

export const tests = {
  'elliptical arcs from the ellipse tool, exported as DXF ellipse arcs': async t => {
    await blank(t);
    await t.eval(() => { setMode('d:ellipse'); fpTyped('A'); }); await t.click(100, 100); await t.click(120, 100);
    await t.eval(() => { fpTyped(`1'`); fpTyped('0'); fpTyped('90'); });
    const s = (await shapes(t))[0];
    t.eq([s.t, s.rx, s.ry, s.a0, s.a1], ['ellipse', 20, 6.35, 0, 90]);
    const r = await t.eval(() => { const s = levelOf(page()).shapes[0]; const o = shapeOutline(s); return [o.closed, shapeClosed(s), /ELLIPSE[\s\S]*?\r\n 41|ELLIPSE/.test(dxfWrite(levelOf(page())))]; });
    t.eq(r, [false, false, true]);
  },
  'text with several lines and an alignment': async t => {
    await blank(t);
    await t.eval(() => setMode('d:text')); await t.click(100, 100);
    await t.page.fill('#dlgbody input[name="text"]', 'Master|bedroom'); await t.page.selectOption('#dlgbody select[name="align"]', 'center'); await t.confirm();
    const s = (await shapes(t))[0]; t.eq([s.text, s.align], ['Master\nbedroom', 'center']);
    t.eq(await t.eval(() => { const e = document.querySelector('#content .shp text'); return [e.getAttribute('text-anchor'), e.querySelectorAll('tspan').length]; }), ['middle', 2]);
  },
  'devices have a rotate grip': async t => {
    await blank(t);
    await t.eval(() => setMode('fpplace', 'rout')); await t.click(100, 100); await t.key('Escape');
    t.eq(await t.eval(() => document.querySelectorAll('#content .grip.grot').length), 1);
    await t.click(108, 100); t.eq(await t.eval(() => gripOp && gripOp.mode), 'rotate');
    await t.click(100, 80);
    t.eq(await t.eval(() => levelOf(page()).places[0].rot), 270, 'turned a quarter turn counter-clockwise');
  },
  'right-click a closed shape to make it a room': async t => {
    await blank(t, [{ id: 'c', t: 'circle', c: [100, 100], r: 20 }]);
    const [x, y] = await t.scr(120, 100); await t.page.mouse.click(x, y, { button: 'right' });
    await t.page.fill('#dlgbody input[name="name"]', 'Gazebo'); await t.confirm();
    t.eq(await t.eval(() => levelOf(page()).rooms.map(r => [r.name, r.shape])), [['Gazebo', 'circle']]);
  },
  'hidden and center line types': async t => {
    await blank(t, [{ id: 'a', t: 'line', a: [60, 60], b: [120, 60], dash: 'hidden' }, { id: 'b', t: 'line', a: [60, 80], b: [120, 80], dash: 'center' }]);
    t.eq(await t.eval(() => [...document.querySelectorAll('#content .shp path[stroke-dasharray]')].length), 2);
    const dxf = await t.eval(() => dxfWrite(levelOf(page())));
    t.ok(/\r\nHIDDEN\r\n/.test(dxf) && /\r\nCENTER\r\n/.test(dxf), 'line types in the DXF');
  },
  'a view can hide layers': async t => {
    await blank(t, [{ id: 'a', t: 'line', a: [60, 60], b: [120, 60], layer: 'Lfurn' }, { id: 'b', t: 'circle', c: [100, 100], r: 10 }]);
    await t.eval(() => { P.ulayers = [{ id: 'Lfurn', name: 'Furniture' }]; const lv = levelOf(page()); const np = newFloorPage(lv.id, 9, 'Views', 'sheet', { vps: [{ id: 'v1', level: lv.id, show: 'level', rect: [30, 40, 200, 200], scale: 0 }, { id: 'v2', level: lv.id, show: 'level', rect: [210, 40, 400, 200], scale: 0, hide: ['Lfurn'] }] }); P.pages.push(np); goPage(np.id); });
    const r = await t.eval(() => { const s = pageSVG(page(), { print: true }); const box = document.createElement('div'); box.innerHTML = `<svg>${s}</svg>`; return [...box.querySelectorAll('g[clip-path^="url(#vpc-"]')].map(g => g.querySelectorAll('path').length); });
    t.ok(r[0] > r[1], 'the second view leaves the furniture layer out: ' + r.join());
    await t.eval(() => { sel = new Set(['v1']); render(); });
    t.ok(await t.page.isVisible('#props [data-k="vp.ly.Lfurn"]'), 'layer switch in the view properties');
  },
  'rooms made from walls follow the walls': async t => {
    await blank(t, [W('w1', [60, 60], [180, 60]), W('w2', [180, 60], [180, 140]), W('w3', [180, 140], [60, 140]), W('w4', [60, 140], [60, 60])]);
    await t.eval(() => setMode('d:roompick')); await t.click(120, 100); await t.page.fill('#dlgbody input[name="name"]', 'Den'); await t.confirm();
    const before = await t.eval(() => bboxPts(levelOf(page()).rooms[0].pts));
    await t.eval(() => { sel = new Set(['w2']); render(); setMode('d:move'); }); await t.click(180, 30); await t.click(160, 30);
    const after = await t.eval(() => [bboxPts(levelOf(page()).rooms[0].pts), levelOf(page()).rooms[0].auto]);
    t.ok(near(before[2] - after[0][2], 20, 0.05), `room follows the wall: ${before} -> ${after[0]}`); t.eq(after[1], true);
  },
  'room from walls looks past furniture between the click and the wall': async t => {
    await blank(t, [W('w1', [60, 60], [180, 60]), W('w2', [180, 60], [180, 140]), W('w3', [180, 140], [60, 140]), W('w4', [60, 140], [60, 60]), { id: 'tb', t: 'pline', pts: [[100, 90], [140, 90], [140, 110], [100, 110]], closed: true }]);
    await t.eval(() => setMode('d:roompick')); await t.click(80, 100); await t.page.fill('#dlgbody input[name="name"]', 'Dining'); await t.confirm();
    const b = await t.eval(() => bboxPts(levelOf(page()).rooms[0].pts)); t.ok(near(b[2], 180 - 2.25 * IN, 0.01), 'the room reaches the far wall: ' + b);
  },
  'moving a room updates which room its devices are in': async t => {
    await blank(t);
    await t.eval(() => { const lv = levelOf(page()); lv.rooms.push({ id: 'r1', name: 'Den', pts: [[60, 60], [100, 60], [100, 100], [60, 100]] }, { id: 'r2', name: 'Office', pts: [[200, 60], [240, 60], [240, 100], [200, 100]] }); const it = makeItem('rout', 0, 0, 0, { fn: '', loc: '' }); P.pool.push(it); lv.places.push({ id: 'p1', item: it.id, x: 80, y: 80, rot: 0 }); autoRoom(lv, lv.places[0]); render(); });
    t.eq(await t.eval(() => itemById(levelOf(page()).places[0].item).loc), 'Den');
    await t.eval(() => { sel = new Set(['r1']); render(); setMode('d:move'); }); await t.click(60, 60); await t.click(60, 150);
    await t.eval(() => { sel = new Set(['r2']); render(); setMode('d:move'); }); await t.click(200, 60); await t.click(60, 60);
    t.eq(await t.eval(() => itemById(levelOf(page()).places[0].item).loc), 'Office');
  },
};
