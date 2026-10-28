// Walls, doors, windows, openings, rooms from walls, schedule, view sheets.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
async function blank(t, shapes = []) {
  await t.open('#home'); await goFloor(t);
  await t.eval(sh => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = sh; PREFS.ortho = true; PREFS.polar = false; PREFS.osnapOn = true; PREFS.wall = null; PREFS.openW = null; sel = new Set(); render(); }, shapes);
}
const shapes = t => t.eval(() => clone(levelOf(page()).shapes));
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const nearPt = (p, q, e = 0.05) => near(p[0], q[0], e) && near(p[1], q[1], e);
const IN = 25.4 / 48;
const W = (id, a, b, th = 4.5 * IN, just = 'c') => ({ id, t: 'wall', a, b, th, just, h: 2438.4, kind: '2x4 interior' });
const box = () => [W('w1', [60, 60], [180, 60]), W('w2', [180, 60], [180, 140]), W('w3', [180, 140], [60, 140]), W('w4', [60, 140], [60, 60])];

export const tests = {
  'wall presets, faces and the reference line': async t => {
    await t.open('#home');
    const r = await t.eval(() => [WALL_PRESETS.map(p => [p[0], r2(p[1] / 25.4)]), wallPoly({ t: 'wall', a: [0, 0], b: [10, 0], th: 2, just: 'c' }), wallPoly({ t: 'wall', a: [0, 0], b: [10, 0], th: 2, just: 'l' })]);
    t.eq(r[0], [['2x4 interior', 4.5], ['2x6 exterior', 6.5], ['Mobile home 2x3 interior', 3.5], ['Mobile home 2x4 exterior', 4.5]]);
    t.ok(nearPt(r[1][0], [0, -1]) && nearPt(r[1][2], [10, 1]), 'centered wall');
    t.ok(nearPt(r[2][0], [0, 0]) && nearPt(r[2][2], [10, 2]), 'left face on the line, wall to the right');
  },
  'draw walls with the wall tool: corners are mitered, height and type stored': async t => {
    await blank(t);
    await t.eval(() => setMode('d:wall'));
    await t.click(60, 60); await t.click(180, 60); await t.click(180, 140); await t.click(60, 140); await t.eval(() => fpTyped('C'));
    const s = await shapes(t);
    t.eq(s.length, 4); t.eq(s.map(w => w.t), ['wall', 'wall', 'wall', 'wall']);
    t.ok(near(s[0].th, 4.5 * IN, 0.002) && s[0].h === 96 * 25.4 && s[0].kind === '2x4 interior');
    const c = await t.eval(() => { const m = wallCorners(levelOf(page())); const l = levelOf(page()).shapes; return [m.get(l[0].id), m.get(l[1].id)]; });
    t.ok(nearPt(c[0].L1, c[1].L0) && nearPt(c[0].R1, c[1].R0), 'neighbouring walls share their corner points');
    t.ok(nearPt(c[0].L1, [180 + 2.25 * IN, 60 - 2.25 * IN], 0.01), 'outside corner is square');
    t.ok(await t.eval(() => document.querySelectorAll('#content .walls polygon').length >= 8), 'outlines and fills drawn');
  },
  'wall settings: preset, reference line, height': async t => {
    await blank(t);
    await t.eval(() => wallSettingsDlg());
    await t.page.selectOption('#dlgbody select[name="preset"]', 'Mobile home 2x3 interior'); await t.page.selectOption('#dlgbody select[name="just"]', 'l'); await t.page.fill('#dlgbody input[name="h"]', `7'6"`); await t.confirm();
    await t.eval(() => setMode('d:wall')); await t.click(60, 60); await t.click(140, 60); await t.key('Enter');
    const w = (await shapes(t))[0];
    t.eq([w.kind, w.just, w.h], ['Mobile home 2x3 interior', 'l', 90 * 25.4]); t.ok(near(w.th, 3.5 * IN, 0.002));
  },
  'doors, windows and openings go into walls with tags, and cut the wall': async t => {
    await blank(t, box());
    await t.eval(() => setMode('d:door:single')); await t.click(100, 61);
    await t.eval(() => setMode('d:door:double')); await t.click(180, 100);
    await t.eval(() => setMode('d:window')); await t.click(120, 139);
    await t.eval(() => setMode('d:opening')); await t.click(61, 100); await t.key('Escape');
    const s = (await shapes(t)).filter(x => x.t === 'opening');
    t.eq(s.map(o => [o.kind, o.style || '', o.tag || '', o.wall]), [['door', 'single', 'D1', 'w1'], ['door', 'double', 'D2', 'w2'], ['window', '', 'W1', 'w3'], ['opening', '', '', 'w4']]);
    t.eq(s[0].side, -1, 'clicked below the wall line (inside the room) swings inside');
    t.ok(near(s[0].w, 36 * IN, 0.002) && near(s[1].w, 60 * IN, 0.002));
    const pieces = await t.eval(() => { const lv = levelOf(page()); const cr = wallCorners(lv); return lv.shapes.filter(isWall).map(w => wallPieces(lv, w, cr.get(w.id)).length); });
    t.eq(pieces, [2, 2, 2, 2]);
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .otag text')].map(e => e.textContent).join() === 'D1,D2,W1'), 'tags drawn');
  },
  'openings move with their wall, stay put when the wall is stretched, and follow a split': async t => {
    await blank(t, box().concat([{ id: 'o1', t: 'opening', wall: 'w1', c: [100, 60], w: 18, kind: 'door', style: 'single', side: -1, hinge: 'a', tag: 'D1', h: 2032 }]));
    await t.eval(() => { sel = new Set(['w1']); render(); setMode('d:move'); });
    await t.click(60, 30); await t.click(60, 20);
    let s = await shapes(t); t.ok(nearPt(s.find(x => x.id === 'o1').c, [100, 50]), 'door moved with the wall');
    await t.eval(() => { sel = new Set(['w1']); render(); });
    await t.drag(180, 50, 220, 50);
    s = await shapes(t); t.ok(nearPt(s.find(x => x.id === 'w1').b, [220, 50]) && nearPt(s.find(x => x.id === 'o1').c, [100, 50]), 'stretching the end keeps the door in place');
    await t.key('Escape');
    await t.eval(() => { sel = new Set(); setMode('d:breakat'); }); await t.click(150, 50); await t.click(150, 50); await t.key('Escape'); await t.key('Escape');
    s = await shapes(t); const o = s.find(x => x.id === 'o1'); const host = s.find(x => x.id === o.wall);
    t.ok(host && host.t === 'wall' && nearPt(host.a, [60, 50]) && nearPt(host.b, [150, 50]), 'door rehosted on the piece it sits on');
  },
  'door properties: width, flip swing and hinge, kind; schedule report': async t => {
    await blank(t, box().concat([{ id: 'o1', t: 'opening', wall: 'w1', c: [100, 60], w: 18, kind: 'door', style: 'single', side: -1, hinge: 'a', tag: 'D1', h: 2032 }, { id: 'o2', t: 'opening', wall: 'w3', c: [120, 140], w: 36 * IN, kind: 'window', side: 1, tag: 'W1', h: 1219.2, sill: 914.4 }]));
    await t.eval(() => { const lv = levelOf(page()); lv.rooms.push({ id: 'r1', name: 'Office', pts: [[60, 60], [180, 60], [180, 140], [60, 140]] }); sel = new Set(['o1']); render(); });
    const setProp = (k, v) => t.eval(([k, v]) => { const el = document.querySelector(`#props [data-k="${k}"]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v]);
    await setProp('shp.ow', `2'8"`); await setProp('shp.ostyle', 'pocket');
    await t.page.click('[data-act="flipSwing"]'); await t.page.click('[data-act="flipHinge"]');
    const o = (await shapes(t)).find(x => x.id === 'o1');
    t.ok(near(o.w, 32 * IN, 0.002)); t.eq([o.style, o.side, o.hinge], ['pocket', 1, 'b']);
    const rep = await t.eval(() => { buildIndex(); REPORTS = buildReports ? (buildReports(), REPORTS) : REPORTS; const r = allPages().find(p => p.report === 'doors'); return r && r.rows.map(x => x.cells.slice(0, 8).map(c => [].concat(c).join(' '))); });
    t.eq(rep, [['D1', 'Door', 'Pocket', `2'-8"`, `6'-8"`, '', 'Main floor', 'Office'], ['W1', 'Window', '', `3'-0"`, `4'-0"`, `3'-0"`, 'Main floor', 'Office']]);
  },
  'room from walls: click inside, the room follows the inside faces; partitions split rooms': async t => {
    await blank(t, box().concat([W('w5', [120, 60], [120, 140])]));
    await t.eval(() => setMode('d:roompick')); await t.click(90, 100);
    await t.page.fill('#dlgbody input[name="name"]', 'Bed 1'); await t.confirm();
    const h = 2.25 * IN;
    const pts = await t.eval(() => levelOf(page()).rooms[0].pts);
    const b = await t.eval(p => bboxPts(p), pts);
    t.ok(near(b[0], 60 + h, 0.01) && near(b[2], 120 - h, 0.01) && near(b[1], 60 + h, 0.01) && near(b[3], 140 - h, 0.01), 'inside faces of the left part');
    t.eq(pts.length, 4);
    await t.click(400, 250);
    t.ok(await t.eval(() => !$('#dlg').open), 'no room outside the walls');
  },
  'wall edits: offset makes a parallel wall, fillet squares a corner': async t => {
    await blank(t, [W('a', [60, 60], [140, 60]), W('b', [160, 80], [160, 140])]);
    await t.eval(() => setMode('d:fillet')); await t.click(100, 60); await t.click(160, 110);
    let s = await shapes(t); t.ok(nearPt(s[0].b, [160, 60]) && nearPt(s[1].a, [160, 60]), 'walls meet at the corner');
    await t.key('Escape'); await t.key('Escape');
    await t.eval(() => setMode('d:offset')); await t.eval(() => fpTyped(`4'`)); await t.click(100, 60); await t.click(100, 80); await t.key('Enter');
    s = await shapes(t); t.eq(s.length, 3); t.ok(s[2].t === 'wall' && near(s[2].a[1], 60 + 48 * IN, 0.01), 'parallel wall 4 ft away');
  },
  'view sheet: several views at their own scales': async t => {
    await t.open('#home'); await goFloor(t);
    await t.eval(() => newViewSheet());
    t.eq(await t.eval(() => [page().view, mode]), ['sheet', 'vpadd']);
    await t.drag(40, 40, 200, 160);
    await t.page.selectOption('#dlgbody select[name="scale"]', '96'); await t.confirm();
    await t.eval(() => setMode('vpadd')); await t.drag(220, 40, 380, 160);
    const kitchen = await t.eval(() => 'room:' + P.levels[0].rooms.find(r => r.name === 'Kitchen').id);
    await t.page.selectOption('#dlgbody select[name="show"]', kitchen); await t.confirm();
    const r = await t.eval(() => [page().vps.length, page().vps.map(v => [v.show, v.scale]), document.querySelectorAll('#content [data-vp]').length, document.querySelectorAll('#content clipPath[id^="vpc-"]').length]);
    t.eq(r, [2, [['level', 96], ['room', 0]], 2, 2]);
    t.ok(await t.eval(() => [...document.querySelectorAll('#content text')].some(e => e.textContent === `1/8" = 1'`)), 'scale shown under the view');
    await t.click(300, 100); t.eq(await t.eval(() => sel.size), 1);
    await t.drag(300, 100, 310, 110); t.eq(await t.eval(() => page().vps[1].rect[0]), 230, 'view moved');
    await t.key('Delete'); t.eq(await t.eval(() => page().vps.length), 1);
  },
  'align to grid covers walls, openings, shapes, dimensions and blocks': async t => {
    const op = { id: 'o1', t: 'opening', wall: 'w1', c: [90.2, 60.4], w: 20, kind: 'door', style: 'single', hinge: 'l', side: 1, tag: 'D1' };
    await blank(t, [W('w1', [61.4, 59.2], [119.3, 60.8]), W('w2', [119.3, 60.8], [119.3, 140.6]), op,
      { id: 'd1', t: 'dim', kind: 'lin', p1: [10.3, 10.2], p2: [50.4, 10.1], loc: [30.2, 20.3], style: 'Standard' },
      { id: 'c1', t: 'circle', c: [100.9, 100.6], r: 5 }, { id: 'l1', t: 'line', a: [10.3, 90.2], b: [40.4, 90.1] }]);
    await t.eval(() => { const lv = levelOf(page()); lv.shapes.push({ id: 'b1', t: 'insert', name: BLOCKLIB[0].name, p: [150.7, 100.3], rot: 0, k: 1, vals: {} }); lv.shapes.push({ id: 'd2', t: 'dim', kind: 'lin', p1: [10.3, 10.2], p2: [50.4, 10.1], loc: [30.2, 20.3], style: 'Standard', r1: { id: 'l1', g: 0 }, r2: { id: 'l1', g: 1 } }); sel = new Set(); render(); });
    const s0 = await t.eval(() => { const lv = levelOf(page()); return openingAt(lvShapes(lv).find(x => x.id === 'o1'), wallById(lv, 'w1')); });
    await t.eval(() => alignToGrid());
    const s = Object.fromEntries((await shapes(t)).map(x => [x.id, x]));
    t.eq([s.w1.a, s.w1.b, s.w2.a, s.w2.b], [[62, 60], [120, 60], [120, 60], [120, 140]], 'walls snap and the shared corner stays joined');
    t.ok(near(s.o1.c[1], 60) && near(s.o1.c[0], 62 + s0, 0.1), 'door stays on its wall at the same distance along it');
    t.eq([s.d1.p1, s.d1.p2, s.d1.loc], [[10, 10], [50, 10], [30, 20]], 'free dimension');
    t.eq(s.d2.loc, [30.2, 20.3], 'dimension that follows geometry is left to the geometry');
    t.eq([s.c1.c, s.l1.a, s.l1.b, s.b1.p], [[100, 100], [10, 90], [40, 90], [150, 100]]);
  },
  'a door picked on its own slides to the grid along its wall': async t => {
    await blank(t, [W('w1', [60, 60], [180, 60]), { id: 'o1', t: 'opening', wall: 'w1', c: [100.7, 60], w: 20, kind: 'door', style: 'single', hinge: 'l', side: 1, tag: 'D1' }]);
    await t.eval(() => { sel = new Set(['o1']); alignToGrid(); });
    const s = Object.fromEntries((await shapes(t)).map(x => [x.id, x]));
    t.ok(near(s.o1.c[0], 100) && near(s.o1.c[1], 60), 'door moved along the wall');
    t.eq(s.w1.a, [60, 60], 'wall not touched');
  },
};
