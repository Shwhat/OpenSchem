// Floor plan shapes: draw tools, typed options, grips, make room, properties.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
async function blank(t) {
  await t.open('#home'); await goFloor(t);
  await t.eval(() => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = []; PREFS.ortho = false; PREFS.polar = false; PREFS.osnapOn = true; sel = new Set(); render(); });
}
const shapes = t => t.eval(() => clone(levelOf(page()).shapes));
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const nearPt = (p, q, e = 0.05) => near(p[0], q[0], e) && near(p[1], q[1], e);

export const tests = {
  'shape geometry: bulges, 3-point circles and arcs, polygons, rounded rectangles': async t => {
    await t.open('#home');
    const r = await t.eval(() => {
      const k = bulgeArc([0, 0], [20, 0], 1); const c = circ3([0, 0], [10, -10], [20, 0]); const a = arc3([60, 150], [80, 130], [100, 150]);
      const pg = polygonPts([0, 0], 6, 10, 90, 'I'); const rr = rectPline([0, 0], [40, 20], 5, 0);
      const m = transformShape({ t: 'arc', c: [0, 0], r: 10, a0: 0, a1: 90 }, tMirror([0, 0], 90));
      return [[r2(k.c[0]), r2(k.c[1]), r2(k.r), r2(k.sweep)], [r2(c.c[0]), r2(c.c[1]), r2(c.r)], [a.c, a.r, a.a0, a.a1], pg.length, rp(pg[0]), rr.pts.length, rr.b.length, [m.a0, m.a1]];
    });
    t.eq(r[0], [10, 0, 10, 180]); t.eq(r[1], [10, 0, 10]); t.eq(r[2], [[80, 150], 20, 0, 180]);
    t.eq([r[3], r[4]], [6, [0, -10]]); t.eq([r[5], r[6]], [8, 8]); t.eq(r[7], [90, 180]);
  },
  'line tool draws connected lines, Enter finishes, Close closes': async t => {
    await blank(t);
    await t.eval(() => setMode('d:line'));
    await t.click(60, 60); await t.click(120, 60); await t.click(120, 100); await t.key('Enter');
    let s = await shapes(t);
    t.eq(s.map(x => [x.t, x.a, x.b]), [['line', [60, 60], [120, 60]], ['line', [120, 60], [120, 100]]]);
    await t.click(160, 60); await t.click(200, 60); await t.click(200, 100);
    await t.eval(() => fpTyped('C'));
    s = await shapes(t); t.eq(s.length, 5); t.eq([s[4].a, s[4].b], [[200, 100], [160, 60]]);
    t.eq(await t.eval(() => mode), 'd:line');
    await t.key('Escape'); await t.key('Escape'); t.eq(await t.eval(() => mode), 'select');
  },
  'polyline with a tangent arc and a width': async t => {
    await blank(t);
    await t.eval(() => setMode('d:pline'));
    await t.click(60, 60); await t.click(120, 60);
    await t.eval(() => fpTyped('A')); await t.click(120, 100);
    await t.eval(() => { fpTyped('L'); fpTyped('W'); fpTyped('1"'); fpTyped(''); });
    await t.click(60, 100); await t.key('Enter');
    const s = (await shapes(t))[0];
    t.eq([s.t, s.pts, s.b, s.closed], ['pline', [[60, 60], [120, 60], [120, 100], [60, 100]], [0, -1, 0], false]);
    t.ok(near(s.wd[2][0], 25.4 / 48, 0.01) && near(s.wd[2][1], 25.4 / 48, 0.01) && !s.wd[0][0], 'only the last segment has the 1" width');
    t.ok(await t.page.isVisible('#content .shp polygon'), 'the wide segment is drawn as a band');
  },
  'circles: radius typed, two points, three points; arcs and ellipses': async t => {
    await blank(t);
    await t.eval(() => setMode('d:circle')); await t.click(100, 100); await t.eval(() => fpTyped(`2'`));
    await t.eval(() => setMode('d:circle:2p')); await t.click(150, 100); await t.click(170, 100);
    await t.eval(() => setMode('d:circle:3p')); await t.click(220, 80); await t.click(240, 100); await t.click(220, 120);
    await t.eval(() => setMode('d:circle')); await t.click(60, 200); await t.eval(() => { fpTyped('D'); fpTyped(`2'`); });
    await t.eval(() => setMode('d:arc')); await t.click(60, 150); await t.click(80, 130); await t.click(100, 150);
    await t.eval(() => setMode('d:ellipse')); await t.click(160, 160); await t.click(180, 160); await t.eval(() => fpTyped(`1'`));
    const s = await shapes(t);
    t.eq(s.map(x => x.t), ['circle', 'circle', 'circle', 'circle', 'arc', 'ellipse']);
    t.eq([s[0].c, s[0].r], [[100, 100], 12.7]); t.eq([s[1].c, s[1].r], [[160, 100], 10]);
    t.ok(nearPt(s[2].c, [220, 100]) && near(s[2].r, 20), 'three point circle');
    t.eq(s[3].r, 6.35, 'diameter option');
    t.eq([s[4].c, s[4].r, s[4].a0, s[4].a1], [[80, 150], 20, 0, 180]);
    t.eq([s[5].c, s[5].rx, s[5].ry, s[5].rot], [[160, 160], 20, 6.35, 0]);
  },
  'polygons, rounded rectangles and splines': async t => {
    await blank(t);
    await t.eval(() => setMode('d:polygon')); await t.eval(() => fpTyped('5')); await t.click(200, 180); await t.click(200, 160);
    await t.eval(() => setMode('d:rect')); await t.eval(() => { fpTyped('F'); fpTyped(`6"`); }); await t.click(60, 200); await t.click(120, 240);
    await t.eval(() => setMode('d:rect')); await t.click(140, 200); await t.eval(() => fpTyped(`4',2'`));
    await t.eval(() => setMode('d:spline')); await t.click(60, 60); await t.click(90, 80); await t.click(120, 60); await t.key('Enter');
    const s = await shapes(t);
    t.eq([s[0].t, s[0].n, s[0].c, s[0].r, s[0].rot, s[0].ic], ['polygon', 5, [200, 180], 20, 90, 'I']);
    t.eq(await t.eval(() => rp(polyVerts(levelOf(page()).shapes[0])[0])), [200, 160], 'first corner where clicked');
    t.eq([s[1].t, s[1].c, s[1].w, s[1].h, s[1].rot], ['rect', [90, 220], 60, 40, 0]);
    t.ok(near(s[1].r, 6 * 25.4 / 48, 0.02), 'corner radius is 6 inches');
    t.eq(await t.eval(() => { const p = asPline(levelOf(page()).shapes[1]); return [p.pts.length, p.b.filter(x => x).length]; }), [8, 4], 'drawn with rounded corners');
    t.ok(s[2].t === 'rect' && near(s[2].w, 48 * 25.4 / 48, 0.02) && near(s[2].h, 24 * 25.4 / 48, 0.02), 'typed width,height');
    t.eq([s[3].t, s[3].pts.length], ['spline', 3]);
  },
  'text tool places text with a height on paper': async t => {
    await blank(t);
    await t.eval(() => setMode('d:text')); await t.click(80, 80);
    await t.page.fill('#dlgbody input[name="text"]', 'Kitchen island'); await t.confirm();
    const s = (await shapes(t))[0];
    t.eq([s.t, s.p, s.text], ['text', [80, 80], 'Kitchen island']);
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .shp text')].some(e => e.textContent === 'Kitchen island')));
  },
  'shapes select by click, window and crossing, delete and undo': async t => {
    await blank(t);
    await t.eval(() => { lvShapes(levelOf(page())).push({ id: 's1', t: 'line', a: [60, 60], b: [120, 60] }, { id: 's2', t: 'circle', c: [200, 100], r: 10 }); render(); });
    await t.click(90, 60); t.eq(await t.eval(() => [...sel]), ['s1']);
    await t.eval(() => { sel = new Set(); render(); });
    await t.drag(50, 40, 130, 80); t.eq(await t.eval(() => [...sel]), ['s1']);
    await t.eval(() => { sel = new Set(); render(); });
    await t.drag(230, 130, 205, 95); t.eq(await t.eval(() => [...sel]), ['s2'], 'crossing touches the circle');
    await t.key('Delete'); t.eq((await shapes(t)).length, 1);
    await t.eval(() => undo()); t.eq((await shapes(t)).length, 2);
  },
  'grips: drag to stretch, click-click, Space to rotate, scale, mirror, copy': async t => {
    await blank(t);
    await t.eval(() => { lvShapes(levelOf(page())).push({ id: 's1', t: 'line', a: [60, 100], b: [100, 100] }); sel = new Set(['s1']); render(); });
    t.eq(await t.eval(() => document.querySelectorAll('#content .grip').length), 3);
    await t.drag(100, 100, 120, 80);
    t.eq((await shapes(t))[0].b, [120, 80], 'drag the end grip');
    await t.click(120, 80); await t.click(100, 100);
    t.eq((await shapes(t))[0].b, [100, 100], 'click the grip, then click the new point');
    await t.click(60, 100); await t.key(' '); await t.key(' ');
    t.eq(await t.eval(() => gripOp.mode), 'rotate');
    await t.eval(() => fpTyped('90'));
    let s = (await shapes(t))[0]; t.ok(nearPt(s.a, [60, 100]) && nearPt(s.b, [60, 60]), 'rotated 90 degrees around the grip');
    await t.click(60, 100); await t.key(' '); await t.key(' '); await t.key(' '); await t.eval(() => fpTyped('0.5'));
    s = (await shapes(t))[0]; t.ok(nearPt(s.b, [60, 80]), 'scaled by half');
    await t.click(60, 100); for (let i = 0; i < 4; i++) await t.key(' ');
    t.eq(await t.eval(() => gripOp.mode), 'mirror');
    await t.click(80, 100);
    s = (await shapes(t))[0]; t.ok(nearPt(s.b, [60, 120]), 'mirrored across the horizontal line');
    await t.click(60, 100); await t.key(' '); await t.eval(() => fpTyped('C'));
    await t.click(160, 100); await t.click(200, 100); await t.key('Escape');
    t.eq((await shapes(t)).length, 3, 'two copies kept');
    await t.eval(() => undo()); t.eq((await shapes(t)).length, 1, 'one undo removes the copies');
  },
  'grip Escape cancels and devices get a grip': async t => {
    await blank(t);
    await t.eval(() => { lvShapes(levelOf(page())).push({ id: 's1', t: 'circle', c: [100, 100], r: 10 }); sel = new Set(['s1']); render(); });
    t.eq(await t.eval(() => document.querySelectorAll('#content .grip').length), 5);
    await t.click(110, 100); await t.eval(() => { const pg = page(); const r = svg.getBoundingClientRect(); const s = toSheet(pg, 130, 100); svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + (s[0] - view.x) * view.s, clientY: r.top + (s[1] - view.y) * view.s })); });
    await t.key('Escape');
    t.eq((await shapes(t))[0].r, 10, 'Escape puts it back');
    await t.eval(() => setMode('fpplace', 'rout')); await t.click(200, 100); await t.key('Escape');
    t.ok(await t.eval(() => document.querySelectorAll('#content .grip[data-grip^="p:"]').length === 2), 'device move and rotate grips');
    await t.click(200, 100); t.ok(await t.eval(() => !!gripOp), 'clicking the device grip makes it hot');
    await t.click(230, 120); t.eq(await t.eval(() => { const pl = levelOf(page()).places[0]; return [pl.x, pl.y]; }), [230, 120], 'then a click moves the device');
  },
  'object snaps find shape ends, centers and quadrants': async t => {
    await blank(t);
    await t.eval(() => { lvShapes(levelOf(page())).push({ id: 's1', t: 'circle', c: [100, 100], r: 10 }, { id: 's2', t: 'line', a: [150, 80], b: [190, 80] }); render(); });
    const r = await t.eval(() => { const pg = page(), lv = levelOf(pg); const f = p => (osnapFind(pg, lv, p) || {}).k; return [f([100.3, 100.2]), f([110.2, 100]), f([150.3, 80.2]), f([170.2, 80.3])]; });
    t.eq(r, ['cen', 'qua', 'end', 'mid']);
  },
  'make a room from a closed shape and edit shape properties': async t => {
    await blank(t);
    await t.eval(() => { lvShapes(levelOf(page())).push({ id: 's1', t: 'circle', c: [100, 100], r: 10 }, { id: 's2', t: 'pline', pts: [[150, 60], [200, 60], [200, 100], [150, 100]], closed: true }); sel = new Set(['s1']); render(); });
    const setProp = (k, v) => t.eval(([k, v]) => { const el = document.querySelector(`#props [data-k="${k}"]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v]);
    await setProp('shp.r', `1'`);
    t.eq((await shapes(t))[0].r, 6.35);
    await setProp('shp.dash', 'dash'); await setProp('shp.filled', true);
    let s = (await shapes(t))[0]; t.eq([s.dash, !!s.fill], ['dash', true]);
    await t.page.click('[data-act="shapeToRoom"]'); await t.page.fill('#dlgbody input[name="name"]', 'Gazebo'); await t.confirm();
    const r = await t.eval(() => { const lv = levelOf(page()); return [lv.rooms.map(r => [r.name, r.shape]), lv.shapes.map(s => s.id)]; });
    t.eq(r, [[['Gazebo', 'circle']], ['s2']]);
    await t.eval(() => { sel = new Set(['s2']); render(); }); await t.page.click('[data-act="shapeToRoom"]'); await t.page.fill('#dlgbody input[name="name"]', 'Shed'); await t.confirm();
    t.eq(await t.eval(() => levelOf(page()).rooms.find(r => r.name === 'Shed').pts), [[150, 60], [200, 60], [200, 100], [150, 100]]);
  },
  'draw commands by name and alias, typed options through the command line': async t => {
    await blank(t);
    const r = await t.eval(() => { const out = []; for (const c of ['L', 'PL', 'A', 'C', 'EL', 'POL', 'REC', 'SPL', 'T']) { cmdExec(c); out.push(mode); } setMode('select'); return out; });
    t.eq(r, ['d:line', 'd:pline', 'd:arc', 'd:circle', 'd:ellipse', 'd:polygon', 'd:rect', 'd:spline', 'd:text']);
    await t.eval(() => setMode('d:circle')); await t.click(100, 100);
    await t.page.keyboard.type(`18"`); await t.key('Enter');
    t.eq((await shapes(t))[0].r, 9.53, 'typed radius from the keyboard');
    t.ok(await t.eval(() => /CIRCLE/.test(fpPromptText())));
  },
  'shapes print and survive save and load': async t => {
    await blank(t);
    await t.eval(() => { lvShapes(levelOf(page())).push({ id: 's1', t: 'pline', pts: [[60, 60], [100, 60], [100, 90]], b: [0, 0.5], wd: [[1, 1], [0, 0]] }, { id: 's2', t: 'text', p: [60, 120], text: 'Porch', h: 2.5, rot: 0 }); render(); });
    const r = await t.eval(() => { const j = JSON.parse(JSON.stringify(P)); loadProject(j, ''); goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); const svgp = floorSVG(page(), { print: true }); return [levelOf(page()).shapes.length, svgp.includes('Porch'), !svgp.includes('class="grip')]; });
    t.eq(r, [2, true, true]);
  },
};
