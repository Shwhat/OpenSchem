// Floor plan edit tools: move, copy, rotate, scale, mirror, offset, trim, extend, fillet, chamfer, break, join, explode, arrays, order.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
async function blank(t, shapes = []) {
  await t.open('#home'); await goFloor(t);
  await t.eval(sh => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = sh; PREFS.ortho = false; PREFS.polar = false; PREFS.osnapOn = true; sel = new Set(); render(); }, shapes);
}
const shapes = t => t.eval(() => clone(levelOf(page()).shapes));
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const nearPt = (p, q, e = 0.05) => near(p[0], q[0], e) && near(p[1], q[1], e);
const L = (id, a, b) => ({ id, t: 'line', a, b });
const select = (t, ids) => t.eval(ids => { sel = new Set(ids); render(); }, ids);
const typed = (t, ...xs) => t.eval(xs => { for (const x of xs) fpTyped(x); }, xs);

export const tests = {
  'move with a selection, and with objects picked first': async t => {
    await blank(t, [L('a', [60, 60], [100, 60])]);
    await select(t, ['a']); await t.eval(() => setMode('d:move'));
    await t.click(140, 140); await t.click(160, 160);
    t.eq((await shapes(t))[0].a, [80, 80]); t.eq(await t.eval(() => mode), 'select');
    await select(t, []); await t.eval(() => setMode('d:move'));
    t.ok(await t.eval(() => /Select objects/.test(fpPromptText())));
    await t.click(100, 80); await t.key('Enter');
    await t.click(140, 140); await typed(t, `@10',0`);
    t.ok(nearPt((await shapes(t))[0].a, [80 + 3048 / 48, 80]), 'typed displacement');
  },
  'copy places several copies; copied devices get new tags and copied rooms new names': async t => {
    await blank(t, [L('a', [60, 60], [100, 60])]);
    await t.eval(() => { const lv = levelOf(page()); lv.rooms.push({ id: 'r1', name: 'Den', pts: [[50, 120], [90, 120], [90, 160], [50, 160]] }); const it = makeItem('rout', 0, 0, 0, { fn: '', loc: '' }); P.pool.push(it); lv.places.push({ id: 'p1', item: it.id, x: 70, y: 140, rot: 0 }); autoRoom(lv, lv.places[0]); sel = new Set(['a', 'r1', 'p1']); render(); });
    await t.eval(() => setMode('d:copy')); await t.click(140, 200); await t.click(200, 200); await t.click(260, 200); await t.key('Enter');
    const r = await t.eval(() => { const lv = levelOf(page()); return [lv.shapes.length, lv.rooms.map(r => r.name), lv.places.map(p => itemById(p.item).tag), lv.places.map(p => itemById(p.item).loc)]; });
    t.eq(r[0], 3); t.eq(r[1], ['Den', 'Den 2', 'Den 3']);
    t.eq(new Set(r[2]).size, 3, 'each copy has its own tag'); t.eq(r[3], ['Den', 'Den 2', 'Den 3'], 'copied devices land in the copied rooms');
  },
  'rotate, scale (factor and reference) and mirror': async t => {
    await blank(t, [L('a', [60, 100], [100, 100])]);
    await select(t, ['a']); await t.eval(() => setMode('d:rotate')); await t.click(60, 100); await typed(t, '90');
    t.ok(nearPt((await shapes(t))[0].b, [60, 60]));
    await select(t, ['a']); await t.eval(() => setMode('d:scale')); await t.click(60, 100); await typed(t, '0.5');
    t.ok(nearPt((await shapes(t))[0].b, [60, 80]));
    await select(t, ['a']); await t.eval(() => setMode('d:scale')); await t.click(60, 100); await typed(t, 'R', `5'`, `10'`);
    t.ok(nearPt((await shapes(t))[0].b, [60, 60]), 'reference: 5 ft becomes 10 ft');
    await select(t, ['a']); await t.eval(() => setMode('d:mirror')); await t.click(40, 110); await t.click(80, 110);
    let s = await shapes(t); t.eq(s.length, 2, 'mirror keeps the source'); t.ok(nearPt(s[1].b, [60, 160]));
    await select(t, ['a']); await t.eval(() => setMode('d:mirror')); await t.click(100, 40); await typed(t, 'E'); await t.click(100, 80);
    s = await shapes(t); t.eq(s.length, 2); t.ok(nearPt(s[0].a, [140, 100]), 'erase source moves the original');
  },
  'offset lines, circles and closed polylines to the picked side': async t => {
    await blank(t, [L('a', [60, 60], [120, 60]), { id: 'c', t: 'circle', c: [200, 100], r: 20 }, { id: 'p', t: 'pline', pts: [[60, 150], [120, 150], [120, 200], [60, 200]], closed: true }]);
    await t.eval(() => setMode('d:offset')); await typed(t, `1'`);
    await t.click(90, 60); await t.click(90, 40);
    await t.click(220, 100); await t.click(200, 100);
    await t.click(120, 175); await t.click(140, 175);
    await t.key('Enter');
    const s = await shapes(t); const k = 304.8 / 48;
    t.eq(s.length, 6);
    t.ok(nearPt(s[3].a, [60, 60 - k]) && nearPt(s[3].b, [120, 60 - k]), 'line offset up');
    t.ok(near(s[4].r, 20 - k), 'circle offset inward');
    const b = await t.eval(() => bboxPts(levelOf(page()).shapes[5].pts));
    t.ok(near(b[0], 60 - k) && near(b[2], 120 + k) && near(b[1], 150 - k) && near(b[3], 200 + k), 'rectangle offset outward with square corners');
  },
  'trim lines and circles at crossing edges, extend to a boundary': async t => {
    await blank(t, [L('h', [60, 100], [140, 100]), L('v', [100, 60], [100, 140]), { id: 'c', t: 'circle', c: [220, 100], r: 20 }, L('cut', [210, 60], [210, 140]), L('e', [60, 200], [100, 200]), L('wall', [160, 180], [160, 220])]);
    await t.eval(() => setMode('d:trim'));
    await t.click(130, 100);
    await t.click(240, 100);
    await t.key('Enter');
    const s = await shapes(t);
    const h = s.find(x => x.id !== 'v' && x.t === 'line' && x.a[1] === 100);
    t.eq([h.a, h.b], [[60, 100], [100, 100]], 'right part of the line removed');
    const arc = s.find(x => x.t === 'arc'); t.ok(arc && nearPt(arc.c, [220, 100]) && near(arc.r, 20), 'circle trimmed to an arc');
    t.ok(await t.eval(a => Math.abs(arcSweep(a) - 120) < 0.5, arc), 'the part right of the cut line is gone');
    await t.eval(() => setMode('d:extend')); await t.click(95, 200); await t.key('Enter');
    t.eq((await shapes(t)).find(x => x.id === 'e').b, [160, 200]);
  },
  'fillet with a radius, square corners, polyline corners; chamfer': async t => {
    await blank(t, [L('a', [60, 100], [100, 100]), L('b', [120, 60], [120, 90]), L('c', [160, 100], [200, 100]), L('d', [220, 60], [220, 90]), { id: 'p', t: 'pline', pts: [[60, 160], [120, 160], [120, 220]] }]);
    await t.eval(() => setMode('d:fillet')); await typed(t, 'R', `1'`);
    await t.click(80, 100); await t.click(120, 75);
    const k = 304.8 / 48; let s = await shapes(t);
    t.ok(nearPt(s[0].b, [120 - k, 100]) && nearPt(s[1].b, [120, 100 - k]), 'lines trimmed to the tangent points');
    const arc = s.find(x => x.t === 'arc'); t.ok(arc && near(arc.r, k) && nearPt(arc.c, [120 - k, 100 - k]), 'fillet arc');
    await t.click(90, 160); await t.click(120, 190);
    s = await shapes(t); const p = s.find(x => x.id === 'p'); t.eq(p.pts.length, 4); t.ok(p.b && near(Math.abs(p.b[1]), Math.tan(Math.PI / 8), 0.001), 'polyline corner gets an arc');
    await t.key('Escape'); await t.key('Escape');
    await t.eval(() => setMode('d:chamfer')); await typed(t, 'D', `6"`, `6"`);
    await t.click(180, 100); await t.click(220, 75);
    s = await shapes(t); const h = 152.4 / 48;
    t.ok(nearPt(s.find(x => x.id === 'c').b, [220 - h, 100]) && nearPt(s.find(x => x.id === 'd').b, [220, 100 - h]));
    t.ok(s.some(x => x.t === 'line' && nearPt(x.a, [220 - h, 100]) && nearPt(x.b, [220, 100 - h])), 'chamfer line');
  },
  'break, break at a point, join and explode': async t => {
    await blank(t, [L('a', [60, 100], [140, 100]), { id: 'c', t: 'circle', c: [220, 100], r: 20 }, L('j1', [60, 160], [100, 160]), L('j2', [100, 160], [100, 200]), { id: 'q', t: 'arc', c: [100, 220], r: 20, a0: 0, a1: 90 }]);
    await t.eval(() => setMode('d:break')); await t.click(80, 100); await t.click(110, 100);
    let s = await shapes(t); t.eq(s.filter(x => x.t === 'line' && x.a[1] === 100).map(x => [x.a[0], x.b[0]]), [[60, 80], [110, 140]], 'gap between the two points');
    await t.click(220, 80); await t.click(240, 100); await t.key('Escape'); await t.key('Escape');
    t.ok((await shapes(t)).some(x => x.t === 'arc' && nearPt(x.c, [220, 100])), 'broken circle is an arc');
    await t.eval(() => setMode('d:breakat')); await t.click(120, 100); await t.click(125, 100); await t.key('Escape'); await t.key('Escape');
    t.eq((await shapes(t)).filter(x => x.t === 'line' && x.a[1] === 100).length, 3);
    await t.eval(() => { sel = new Set(['j1', 'j2']); render(); setMode('d:join'); });
    await t.page.waitForTimeout(30);
    s = await shapes(t); const pl = s.find(x => x.t === 'pline'); t.ok(pl && pl.pts.length === 3, 'two lines joined into a polyline');
    await t.eval(() => { const lv = levelOf(page()); sel = new Set([lv.shapes.find(x => x.t === 'pline').id]); render(); setMode('d:explode'); });
    await t.page.waitForTimeout(30);
    t.eq((await shapes(t)).filter(x => x.t === 'pline').length, 0);
  },
  'rectangular, polar and path arrays': async t => {
    await blank(t, [{ id: 'c', t: 'circle', c: [60, 60], r: 4 }, L('path', [60, 200], [180, 200]), { id: 'd', t: 'circle', c: [60, 200], r: 3 }]);
    await select(t, ['c']); await t.eval(() => setMode('d:arrayrect'));
    await t.page.fill('#dlgbody input[name="rows"]', '2'); await t.page.fill('#dlgbody input[name="cols"]', '3'); await t.page.fill('#dlgbody input[name="dx"]', `2'`); await t.page.fill('#dlgbody input[name="dy"]', `2'`); await t.confirm();
    let s = await shapes(t); t.eq(s.filter(x => x.t === 'circle' && x.r === 4).length, 6);
    t.ok(s.some(x => x.r === 4 && nearPt(x.c, [60 + 2 * 12.7, 60 - 12.7])), 'top right copy');
    await select(t, ['c']); await t.eval(() => setMode('d:arraypolar')); await t.click(100, 60);
    await t.page.fill('#dlgbody input[name="n"]', '4'); await t.confirm();
    s = await shapes(t); t.ok(s.some(x => x.r === 4 && nearPt(x.c, [140, 60])) && s.some(x => x.r === 4 && nearPt(x.c, [100, 20])), 'copies around the center');
    await select(t, ['d']); await t.eval(() => setMode('d:arraypath')); await t.click(120, 200);
    await t.page.fill('#dlgbody input[name="n"]', '4'); await t.confirm();
    s = await shapes(t); t.eq(s.filter(x => x.r === 3).map(x => x.c[0]).sort((a, b) => a - b), [60, 100, 140, 180]);
  },
  'draw order and command aliases': async t => {
    await blank(t, [L('a', [60, 60], [100, 60]), L('b', [60, 80], [100, 80])]);
    await select(t, ['a']); await t.eval(() => drawOrder('front'));
    t.eq((await shapes(t)).map(x => x.id), ['b', 'a']);
    await t.eval(() => drawOrder('back')); t.eq((await shapes(t)).map(x => x.id), ['a', 'b']);
    const r = await t.eval(() => { const out = []; for (const c of ['M', 'CO', 'RO', 'SC', 'MI', 'O', 'TR', 'EX', 'F', 'CHA', 'BR', 'BRP', 'AR', 'ARP', 'ARPA']) { sel = new Set(); cmdExec(c); out.push(mode); setMode('select'); } return out; });
    t.eq(r, ['d:move', 'd:copy', 'd:rotate', 'd:scale', 'd:mirror', 'd:offset', 'd:trim', 'd:extend', 'd:fillet', 'd:chamfer', 'd:break', 'd:breakat', 'd:arrayrect', 'd:arraypolar', 'd:arraypath']);
    await t.eval(() => cmdExec(`SCALE 1/2"=1'`)); t.eq(await t.eval(() => levelOf(page()).scale), 24, 'SCALE with a scale still sets the drawing scale');
  },
};
