// 1.16.0 floor plan drawing: Ortho off by default, free corners, press-drag-release, rectangle and polygon shapes
// with grips, properties and Explode, and dynamic input beside the cursor.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
async function blank(t, o = {}) {
  await t.open('#home'); await goFloor(t);
  await t.eval(o => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = o.shapes || []; PREFS.ortho = !!o.ortho; PREFS.polar = false; PREFS.osnapOn = o.osnap !== false; PREFS.dyn = o.dyn !== false; sel = new Set(); render(); }, o);
}
const shapes = t => t.eval(() => clone(levelOf(page()).shapes));
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const FT = 25.4 / 4;   // one real foot in plan millimetres at 1/4" = 1'
async function move(t, x, y) { const [a, b] = await t.scr(x, y); await t.page.mouse.move(a, b, { steps: 3 }); }
const dynText = t => t.eval(() => { const el = $('#dyn'); return el && !el.classList.contains('hidden') ? el.textContent : ''; });

export const tests = {
  'Ortho is off by default and dynamic input is on': async t => {
    await t.open('#home');
    t.eq(await t.eval(() => [PREFS.ortho, PREFS.dyn]), [false, true]);
  },
  'rectangle places with Ortho on (its corner is free) and is a rectangle shape': async t => {
    await blank(t, { ortho: true, osnap: false });
    await t.eval(() => setMode('d:rect')); await t.click(60, 60); await move(t, 100, 90); await t.click(100, 90);
    const s = await shapes(t);
    t.eq([s.length, s[0].t, s[0].c, s[0].w, s[0].h, s[0].rot], [1, 'rect', [80, 75], 40, 30, 0]);
    // the circle's radius point and the ellipse's other axis are free too
    await t.eval(() => setMode('d:circle')); await t.click(160, 100); await t.click(170, 110);
    t.ok(near((await shapes(t))[1].r, Math.hypot(10, 10), 0.02), 'circle radius not locked to a straight line');
  },
  'press, drag and release draws rectangles, lines and circles; click-click still works': async t => {
    await blank(t, { osnap: false });
    await t.eval(() => setMode('d:rect')); await t.drag(60, 60, 100, 80);
    await t.eval(() => setMode('d:circle')); await t.drag(160, 100, 172, 100);
    await t.eval(() => setMode('d:line')); await t.drag(60, 140, 120, 140); await t.key('Escape');
    await t.eval(() => setMode('d:rect')); await t.click(200, 60); await t.click(240, 100);
    await t.eval(() => setMode('d:wall')); await t.drag(60, 200, 140, 200); await t.key('Escape');
    t.ok(await t.eval(() => levelOf(page()).shapes.some(x => x.t === 'wall' && x.a[0] === 60 && x.b[0] === 140)), 'wall by dragging');
    await t.eval(() => { levelOf(page()).shapes = levelOf(page()).shapes.filter(x => x.t !== 'wall'); setMode('d:dimlin'); }); await t.drag(200, 160, 260, 160); await t.click(230, 150); await t.key('Escape');
    t.ok(await t.eval(() => levelOf(page()).shapes.some(x => x.t === 'dim' && x.p1[0] === 200 && x.p2[0] === 260)), 'dimension by dragging');
    await t.eval(() => { levelOf(page()).shapes = levelOf(page()).shapes.filter(x => x.t !== 'dim'); });
    const s = await shapes(t);
    t.eq(s.map(x => x.t), ['rect', 'circle', 'line', 'rect']);
    t.eq([s[0].c, s[0].w, s[0].h], [[80, 70], 40, 20]); t.eq([s[1].c, s[1].r], [[160, 100], 12]); t.eq([s[2].a, s[2].b], [[60, 140], [120, 140]]);
    t.eq([s[3].w, s[3].h], [40, 40]);
  },
  'rectangle grips: corners resize from the opposite corner, sides move one side, center moves': async t => {
    await blank(t, { shapes: [{ id: 'r', t: 'rect', c: [100, 100], w: 40, h: 20, rot: 0 }], osnap: false });
    await t.eval(() => { sel = new Set(['r']); setMode('select'); render(); });
    t.eq(await t.eval(() => shapeGrips(levelOf(page()).shapes[0]).length), 9);
    await t.drag(120, 90, 130, 80);   // upper right corner (lower left stays at 80,110)
    let s = (await shapes(t))[0]; t.eq([s.c, s.w, s.h], [[105, 95], 50, 30]);
    await t.drag(130, 95, 140, 95);   // right side middle
    s = (await shapes(t))[0]; t.eq([s.c, s.w, s.h], [[110, 95], 60, 30]);
    await t.drag(110, 95, 120, 106);  // center
    s = (await shapes(t))[0]; t.eq([s.c, s.w, s.h], [[120, 106], 60, 30]);
    const r = await t.eval(() => { const s = levelOf(page()).shapes[0]; s.rot = 90; return shapeGrips(s).slice(0, 4).map(rp); });
    t.eq(r, [[135, 136], [135, 76], [105, 76], [105, 136]], 'corners follow the rotation');
  },
  'rectangle and polygon properties, rotation, ellipse rotation and arc angles': async t => {
    await blank(t, { shapes: [{ id: 'r', t: 'rect', c: [100, 100], w: 40, h: 20, rot: 0 }, { id: 'p', t: 'polygon', c: [200, 100], n: 6, r: 10, rot: 90, ic: 'I' }, { id: 'e', t: 'ellipse', c: [100, 200], rx: 20, ry: 10, rot: 0 }, { id: 'a', t: 'arc', c: [200, 200], r: 10, a0: 0, a1: 90 }] });
    const r = await t.eval(() => {
      const pg = page(), lv = levelOf(pg), [R, Pg, E, A] = lv.shapes;
      const html = shapePropsHTML(pg, lv, [R]);
      applyShapeProp(pg, lv, R, 'w', `10'`); applyShapeProp(pg, lv, R, 'h', `5'`); applyShapeProp(pg, lv, R, 'rot', '30'); applyShapeProp(pg, lv, R, 'corner', 'round'); applyShapeProp(pg, lv, R, 'csize', `1'`);
      applyShapeProp(pg, lv, Pg, 'n', '8'); applyShapeProp(pg, lv, Pg, 'ic', 'C'); applyShapeProp(pg, lv, Pg, 'rot', '0');
      applyShapeProp(pg, lv, E, 'rot', '45'); applyShapeProp(pg, lv, A, 'a0', '30'); applyShapeProp(pg, lv, A, 'a1', '270');
      return [/Width/.test(html) && /Height/.test(html) && /Corners/.test(html) && /Explode/.test(html), R.w, R.h, R.rot, R.r, Pg.n, Pg.ic, Pg.rot, E.rot, A.a0, A.a1, /Sides/.test(shapePropsHTML(pg, lv, [Pg])), /Rotation/.test(shapePropsHTML(pg, lv, [E])), /Start angle/.test(shapePropsHTML(pg, lv, [A]))];
    });
    t.eq(r, [true, 63.5, 31.75, 30, 6.35, 8, 'C', 0, 45, 30, 270, true, true, true]);
  },
  'polygon grips set the radius and turn it; move, rotate and mirror keep rectangles and polygons': async t => {
    await blank(t, { shapes: [{ id: 'p', t: 'polygon', c: [100, 100], n: 4, r: 10, rot: 0, ic: 'I' }, { id: 'r', t: 'rect', c: [200, 100], w: 40, h: 20, rot: 0 }] });
    const r = await t.eval(() => {
      const [Pg, R] = levelOf(page()).shapes.map(clone);
      gripStretch(Pg, 1, [100, 80]); const g = [Pg.r, Pg.rot];
      const R2 = transformShape(clone(R), tRotate([200, 100], 90)), R3 = transformShape(clone(R), tMirror([0, 0], 45)), R4 = transformShape(clone(R), tScale([200, 100], 2));
      const P2 = transformShape(clone(Pg), tRotate([100, 100], 45));
      return [g, [R2.t, R2.rot, R2.w], [R3.t, R3.rot, R3.c], [R4.w, R4.h], [P2.t, P2.rot]];
    });
    t.eq(r, [[20, 90], ['rect', 90, 40], ['rect', 90, [-100, -200]], [80, 40], ['polygon', 135]]);
  },
  'Explode turns rectangles and polygons into polylines; offset keeps them; fillet a corner': async t => {
    await blank(t, { shapes: [{ id: 'r', t: 'rect', c: [100, 100], w: 40, h: 20, rot: 0 }, { id: 'p', t: 'polygon', c: [200, 100], n: 6, r: 10, rot: 90, ic: 'C' }, { id: 'q', t: 'rect', c: [100, 200], w: 40, h: 20, rot: 0 }] });
    const r = await t.eval(() => {
      const lv = levelOf(page());
      const o1 = offsetShape({ s: lv.shapes[0], cv: curveOf(lv.shapes[0]) }, 5, [100, 60]); const o2 = offsetShape({ s: lv.shapes[1], cv: curveOf(lv.shapes[1]) }, 2, [200, 80]);
      sel = new Set(['r', 'p']); explodeSel(lv);
      return [[o1.t, o1.w, o1.h], [o2.t, o2.r], lv.shapes.map(s => [s.t, s.closed || false, (s.pts || []).length])];
    });
    t.eq(r, [['rect', 50, 30], ['polygon', 12], [['pline', true, 4], ['pline', true, 6], ['rect', false, 0]]]);
    // fillet one corner of a rectangle: it becomes a polyline with one arc
    await t.eval(() => { setMode('d:fillet'); fpTyped('R'); fpTyped('4'); });
    await t.click(100, 210); await t.click(120, 200);
    const q = (await shapes(t))[2];
    t.eq([q.t, q.pts.length, (q.b || []).filter(x => x).length], ['pline', 5, 1]);
  },
  'rectangles and polygons snap, export to DXF and become rooms': async t => {
    await blank(t, { shapes: [{ id: 'r', t: 'rect', c: [100, 100], w: 40, h: 20, rot: 0, layer: undefined }, { id: 'p', t: 'polygon', c: [200, 100], n: 5, r: 10, rot: 90, ic: 'I' }] });
    const r = await t.eval(() => {
      const pg = page(), lv = levelOf(pg);
      const g = osnapGeom(pg, lv); const has = (p, k) => g.pts.some(x => x.k === k && Math.abs(x.p[0] - p[0]) < 1e-6 && Math.abs(x.p[1] - p[1]) < 1e-6);
      const prims = exportPrims(lv).filter(x => x.t === 'pline' && x.closed);
      const dx = dxfWrite(lv); return [has([80, 90], 'end'), has([100, 90], 'mid'), has([100, 100], 'cen'), has([200, 100], 'cen'), prims.length, shapeRoomPts(lv.shapes[0]).pts.length, (dx.match(/LWPOLYLINE/g) || []).length];
    });
    t.eq(r, [true, true, true, true, 2, 4, 2]);
  },
  'dynamic input: rectangle width Tab height Enter': async t => {
    await blank(t, { osnap: false });
    await t.eval(() => setMode('d:rect')); await move(t, 60, 60); await t.click(60, 60); await move(t, 90, 80);
    t.ok(/Width/.test(await dynText(t)) && /Height/.test(await dynText(t)), 'width and height boxes show');
    await t.page.keyboard.type(`4'`); await t.key('Tab'); await t.page.keyboard.type(`2'`); await t.key('Enter');
    const s = (await shapes(t))[0];
    t.ok(s && s.t === 'rect' && near(s.w, 4 * FT) && near(s.h, 2 * FT), 'typed size');
    t.ok(near(s.c[0], 60 + 2 * FT) && near(s.c[1], 60 + FT), 'grows toward the cursor');
  },
  'dynamic input: length and angle, a locked length follows the cursor direction, X,Y with a comma': async t => {
    await blank(t, { osnap: false });
    await t.eval(() => setMode('d:line')); await move(t, 60, 100); await t.click(60, 100); await move(t, 80, 100);
    t.ok(/Length/.test(await dynText(t)) && /Angle/.test(await dynText(t)), 'length and angle boxes show');
    await t.page.keyboard.type(`10'`); await t.key('Tab'); await t.page.keyboard.type('90'); await t.key('Enter');
    let s = await shapes(t); t.ok(near(s[0].b[0], 60) && near(s[0].b[1], 100 - 10 * FT), 'line 10 feet straight up');
    // lock 5' and click somewhere to the right: the line is 5' long in that direction
    await move(t, 80, 70); await t.page.keyboard.type(`5'`); await t.key('Tab'); await move(t, 100, 100 - 10 * FT); await t.click(100, 100 - 10 * FT);
    s = await shapes(t); t.ok(near(Math.hypot(s[1].b[0] - s[1].a[0], s[1].b[1] - s[1].a[1]), 5 * FT) && s[1].b[0] > s[1].a[0] + 5 * FT - 0.5, 'locked length along the cursor direction');
    await t.key('Escape');
    // a first point typed as X,Y (absolute)
    await t.eval(() => setMode('d:line')); await move(t, 100, 150);
    t.ok(/X/.test(await dynText(t)) && /Y/.test(await dynText(t)), 'first point shows X and Y');
    await t.page.keyboard.type(`10'`); await t.page.keyboard.type(','); await t.page.keyboard.type(`5'`); await t.key('Enter');
    const want = await t.eval(() => rp(realToPlan(page(), [10 * 12 * 25.4, 5 * 12 * 25.4])));
    const p0 = await t.eval(() => DRAW.pts[0]); t.ok(near(p0[0], want[0]) && near(p0[1], want[1]), 'absolute first point');
    // relative X,Y for the next point
    await t.page.keyboard.type(`2'`); await t.page.keyboard.type(','); await t.page.keyboard.type(`3'`); await t.key('Enter');
    s = await shapes(t); const l = s[s.length - 1]; t.ok(near(l.b[0] - l.a[0], 2 * FT) && near(l.a[1] - l.b[1], 3 * FT), 'relative X,Y');
  },
  'dynamic input: Down arrow lists the options, Escape clears typing, F12 sends typing to the command line': async t => {
    await blank(t, { osnap: false });
    await t.eval(() => setMode('d:rect')); await move(t, 80, 80);
    t.ok(/Specify first corner/.test(await dynText(t)), 'prompt beside the cursor');
    await t.key('ArrowDown'); t.eq(await t.eval(() => [...document.querySelectorAll('#dyn .dynopt')].map(x => x.textContent)), ['Fillet', 'Chamfer']);
    await t.key('Enter'); t.eq(await t.eval(() => DRAW.stage), 'f', 'Fillet chosen');
    t.ok(/Radius/.test(await dynText(t)), 'corner radius box');
    await t.page.keyboard.type('3'); await t.key('Escape'); t.eq(await t.eval(() => [DYN.typed[0], DRAW.stage]), ['', 'f'], 'Escape clears the typing first');
    await t.key('Enter'); await t.key('F12');
    t.eq(await t.eval(() => [PREFS.dyn, $('#dyn').classList.contains('ro')]), [false, true], 'values still show, read only');
    await t.page.keyboard.type('7'); t.eq(await t.eval(() => $('#cmdinput').value), '7', 'typing goes to the command line');
    await t.key('Escape'); await t.key('F12'); t.eq(await t.eval(() => PREFS.dyn), true);
  },
  'dynamic input box is readable on a dark sheet and hides when no command waits': async t => {
    await blank(t, { osnap: false });
    await t.eval(() => { PREFS.sheet = 'dark'; render(); setMode('d:circle'); }); await move(t, 100, 100); await t.click(100, 100); await move(t, 110, 100);
    const r = await t.eval(() => { const el = $('#dyn'); const b = el.querySelector('.dynf'); const cs = getComputedStyle(b), vs = getComputedStyle(b.querySelector('b')); return [el.classList.contains('dk') === sheetDark(), cs.backgroundColor, vs.color, el.textContent]; });
    t.ok(r[0], 'follows the sheet'); t.ok(/Radius/.test(r[3]), 'radius box');
    await t.key('Escape'); await t.key('Escape'); await t.eval(() => setMode('select')); await move(t, 120, 120);
    t.eq(await dynText(t), '', 'hidden in select mode');
    await t.eval(() => { PREFS.sheet = 'white'; render(); });
  },
  'grips show their values in the dynamic input box and take a typed angle': async t => {
    await blank(t, { shapes: [{ id: 'l', t: 'line', a: [60, 60], b: [100, 60] }], osnap: false });
    await t.eval(() => { sel = new Set(['l']); setMode('select'); render(); });
    await t.click(100, 60); await move(t, 110, 60);
    t.ok(/Length/.test(await dynText(t)), 'stretch shows length and angle');
    await t.key(' '); await t.key(' ');
    t.ok(/Angle/.test(await dynText(t)), 'rotate shows an angle');
    await t.page.keyboard.type('90'); await t.key('Enter');
    t.eq((await shapes(t))[0].a, [100, 100]);
  },
};
