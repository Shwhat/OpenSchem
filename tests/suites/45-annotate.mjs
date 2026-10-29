// Dimensions, leaders, hatches and blocks.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
async function blank(t, shapes = []) {
  await t.open('#home'); await goFloor(t);
  await t.eval(sh => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = sh; PREFS.ortho = false; PREFS.polar = false; PREFS.osnapOn = true; PREFS.hatch = null; sel = new Set(); render(); }, shapes);
}
const shapes = t => t.eval(() => clone(levelOf(page()).shapes));
const texts = t => t.eval(() => [...document.querySelectorAll('#content .shp text')].map(e => e.textContent));
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const L = (id, a, b) => ({ id, t: 'line', a, b });

export const tests = {
  'linear and aligned dimensions follow the geometry they measure': async t => {
    await blank(t, [L('a', [60, 100], [123.5, 100]), L('b', [200, 60], [240, 100])]);
    await t.eval(() => setMode('d:dimlin')); await t.click(60, 100); await t.click(123.5, 100); await t.click(90, 80);
    await t.eval(() => setMode('d:dimali')); await t.click(200, 60); await t.click(240, 100); await t.click(240, 70);
    await t.key('Escape'); await t.key('Escape');
    let s = await shapes(t); const d = s.find(x => x.kind === 'lin');
    t.eq([d.dir, d.r1.id, d.r2.id], ['h', 'a', 'a']);
    let tx = await texts(t); t.ok(tx.includes(`10'-0"`), tx.join('|'));
    t.ok(tx.some(x => /^8'-10 7\/8"$/.test(x)), 'aligned length along the slanted line: ' + tx.join('|'));
    await t.eval(() => { const l = levelOf(page()).shapes.find(x => x.id === 'a'); l.b = [155.25, 100]; render(); });
    tx = await texts(t); t.ok(tx.includes(`15'-0"`), 'the dimension updated when the line got longer: ' + tx.join('|'));
  },
  'angular, radius and diameter dimensions': async t => {
    await blank(t, [L('h', [60, 100], [120, 100]), L('v', [60, 100], [60, 40]), { id: 'c', t: 'circle', c: [200, 100], r: 6.35 }]);
    await t.eval(() => setMode('d:dimang')); await t.click(100, 100); await t.click(60, 60); await t.click(80, 80);
    await t.eval(() => setMode('d:dimrad')); await t.click(206.35, 100); await t.click(220, 90);
    await t.eval(() => setMode('d:dimdia')); await t.click(200, 106.35); await t.click(215, 120);
    const tx = await texts(t);
    t.ok(tx.includes('90°'), tx.join('|')); t.ok(tx.includes(`R 1'-0"`), 'radius'); t.ok(tx.includes(`Ø 2'-0"`), 'diameter');
    await t.eval(() => { levelOf(page()).shapes.find(x => x.id === 'c').r = 12.7; render(); });
    t.ok((await texts(t)).includes(`R 2'-0"`), 'radius follows the circle');
  },
  'dimension styles: text size, units, ticks or arrowheads': async t => {
    await blank(t, [{ id: 'd', t: 'dim', kind: 'lin', p1: [60, 100], p2: [123.5, 100], loc: [90, 80], dir: 'h' }]);
    t.eq(await t.eval(() => document.querySelectorAll('#content .shp polygon:not(.hit)').length), 0, 'ticks by default');
    await t.eval(() => toggleDimArrows()); t.eq(await t.eval(() => document.querySelectorAll('#content .shp polygon:not(.hit)').length), 2, 'two arrowheads');
    await t.eval(() => dimStyleDlg());
    await t.page.selectOption('#dlgbody select[name="units"]', 'metric'); await t.page.fill('#dlgbody input[name="newName"]', 'Metric'); await t.confirm();
    t.eq(await t.eval(() => [P.dimStyle, P.dimStyles.length]), ['Metric', 2]);
    await t.eval(() => { levelOf(page()).shapes[0].style = 'Metric'; render(); });
    t.ok((await texts(t)).includes('3.048 m'), (await texts(t)).join('|'));
  },
  'leaders with text': async t => {
    await blank(t);
    await t.eval(() => setMode('d:leader')); await t.click(60, 100); await t.click(80, 80); await t.key('Enter');
    await t.page.fill('#dlgbody input[name="text"]', 'GFCI|protected'); await t.confirm();
    const s = (await shapes(t))[0]; t.eq([s.t, s.pts.length, s.text], ['leader', 2, 'GFCI\nprotected']);
    t.ok((await texts(t)).join() === 'GFCI,protected');
  },
  'hatch by clicking inside an area, with islands; patterns and select object': async t => {
    await blank(t, [{ id: 'sq', t: 'pline', pts: [[60, 60], [140, 60], [140, 140], [60, 140]], closed: true }, { id: 'c', t: 'circle', c: [100, 100], r: 10 }, { id: 'c2', t: 'circle', c: [220, 100], r: 15 }]);
    await t.eval(() => setMode('d:hatch')); await t.click(70, 70);
    let h = (await shapes(t)).find(x => x.t === 'hatch');
    t.ok(h && h.loops.length === 2 && h.loops[0].length === 4, 'outer square and the circle as an island');
    t.ok(await t.eval(() => !!document.querySelector('#content pattern[id^="hp-"]')), 'pattern drawn');
    await t.eval(() => { PREFS.hatch = { pattern: 'solid', scale: 1, angle: 0, color: '#aa0000' }; fpTyped('S'); }); await t.click(235, 100);
    h = (await shapes(t)).filter(x => x.t === 'hatch')[1]; t.eq([h.pattern, h.color, h.loops.length], ['solid', '#aa0000', 1]);
    t.eq(await t.eval(() => HATCH_PATTERNS.map(p => p[0])), ['solid', 'diagonal', 'cross', 'dots', 'brick', 'concrete', 'wood', 'insulation']);
  },
  'starter block library and inserting a block with attributes linked to loads and the BOM': async t => {
    await blank(t);
    const lib = await t.eval(() => [BLOCKLIB.length, [...new Set(BLOCKLIB.map(b => b.cat))].sort()]);
    t.ok(lib[0] >= 25); t.eq(lib[1], ['appliances', 'fixtures', 'furniture', 'mechanical']);
    const before = await t.eval(() => circuitInfo([...allItems()].find(i => i.tag === 'BRK2')).load);
    await t.eval(() => startInsert('Range 30"')); await t.click(100, 100);
    await t.page.fill('#dlgbody input[name="CIRCUIT"]', 'CKT2'); await t.page.fill('#dlgbody input[name="PART"]', 'RNG-30'); await t.confirm();
    const r = await t.eval(() => { const s = levelOf(page()).shapes[0]; buildIndex(); return [s.t, s.name, s.vals.LOAD, !!P.blocks['Range 30"'], circuitInfo([...allItems()].find(i => i.tag === 'BRK2')).load, bomRows().some(b => b.part === 'RNG-30')]; });
    t.eq(r.slice(0, 4), ['insert', 'Range 30"', '8000', true]); t.eq(r[4], before + 8000, 'range load added to the circuit'); t.ok(r[5], 'part on the BOM');
    t.ok(await t.eval(() => document.querySelectorAll(`#content [data-id="${levelOf(page()).shapes[0].id}"] path`).length >= 6), 'burners drawn');
  },
  'create a block from shapes, rotate and mirror it, explode it': async t => {
    await blank(t, [L('a', [60, 60], [100, 60]), { id: 'c', t: 'circle', c: [80, 80], r: 10 }]);
    await t.eval(() => { sel = new Set(['a', 'c']); render(); setMode('d:block'); }); await t.click(80, 80);
    await t.page.fill('#dlgbody input[name="name"]', 'Lamp table'); await t.page.fill('#dlgbody input[name="attrs"]', 'PART=LT-1'); await t.confirm();
    let s = await shapes(t); t.eq(s.length, 1); t.eq([s[0].t, s[0].name, s[0].vals.PART], ['insert', 'Lamp table', 'LT-1']);
    t.ok(await t.eval(() => BLOCKLIB.some(b => b.name === 'Lamp table') && P.blocks['Lamp table'].shapes.length === 2));
    await t.eval(() => { sel = new Set([levelOf(page()).shapes[0].id]); render(); setMode('d:rotate'); }); await t.click(80, 80); await t.eval(() => fpTyped('90'));
    t.eq((await shapes(t))[0].rot, 90);
    await t.eval(() => { sel = new Set([levelOf(page()).shapes[0].id]); render(); setMode('d:explode'); }); await t.page.waitForTimeout(30);
    s = await shapes(t); t.eq(s.map(x => x.t).sort(), ['circle', 'line']);
    const ln = s.find(x => x.t === 'line'); t.ok(near(ln.a[0], 60, 0.05) && near(ln.a[1], 100, 0.05) && near(ln.b[1], 60, 0.05), 'exploded geometry is rotated: ' + JSON.stringify(ln));
  },
  'copied geometry takes its dimension along': async t => {
    await blank(t, [L('a', [60, 100], [123.5, 100]), { id: 'd', t: 'dim', kind: 'lin', p1: [60, 100], p2: [123.5, 100], loc: [90, 80], dir: 'h', r1: { id: 'a', g: 0 }, r2: { id: 'a', g: 1 } }]);
    await t.eval(() => { sel = new Set(['a', 'd']); render(); setMode('d:copy'); }); await t.click(60, 100); await t.click(60, 160); await t.key('Enter');
    const s = await shapes(t); const d2 = s.filter(x => x.t === 'dim')[1]; const l2 = s.filter(x => x.t === 'line')[1];
    t.eq(d2.r1.id, l2.id, 'copy refers to the copied line');
  },
  'selected dimension and line show only their own lines; the empty area inside a dimension does not select it': async t => {
    await blank(t, [{ id: 'd', t: 'dim', kind: 'lin', p1: [60, 100], p2: [140, 100], loc: [100, 70], dir: 'h' }, L('l', [60, 150], [140, 150])]);
    await t.eval(() => { sel = new Set(['d', 'l']); render(); });
    const strokes = await t.eval(() => [...document.querySelectorAll('#content .ssel .wirehit')].map(e => getComputedStyle(e).stroke));
    t.eq(strokes.length, 2, 'both selected objects keep a click band'); t.ok(strokes.every(s => s === 'transparent' || s === 'rgba(0, 0, 0, 0)'), 'click band stays invisible: ' + strokes.join('|'));
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .ssel path:not(.wirehit)')].some(e => getComputedStyle(e).stroke !== 'transparent' && getComputedStyle(e).stroke !== 'rgba(0, 0, 0, 0)')), 'own lines turn the selection color');
    await t.eval(() => { sel = new Set(); render(); });
    // the old band was a zigzag from the text location through p1, p2 and the dimension line ends: (100,70)-(60,100) crosses (80,85)
    await t.click(80, 86); t.eq(await t.eval(() => [...sel]), [], 'empty area inside the old X');
    await t.click(120, 86); t.eq(await t.eval(() => [...sel]), [], 'other half of the old X');
    await t.click(100, 70); t.eq(await t.eval(() => [...sel]), ['d'], 'the dimension line still selects it');
    await t.eval(() => { sel = new Set(); render(); }); await t.click(60, 85); t.eq(await t.eval(() => [...sel]), ['d'], 'an extension line selects it');
  },
};
