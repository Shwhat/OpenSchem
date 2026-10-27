// Floor plans: placement, rooms, snapping, linking with the schematic, images.
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
const info = (t, id) => t.eval(id => { const it = itemById(id); const pl = placeOf(id); return [it.tag, it.fn, it.loc, !!(IX.pos.get(it.id) || {}).pg, pl && [pl.pl.x, pl.pl.y]]; }, id);

function png(file) {
  const w = 40, h = 30, raw = Buffer.alloc((w * 3 + 1) * h, 200);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

export const tests = {
  'floor-first device gets a room, then moves rooms when dragged': async t => {
    await t.open('#home'); await goFloor(t);
    await t.eval(() => setMode('fpplace', 'rout')); await t.click(300, 200); await t.key('Escape');
    const id = await t.eval(() => P.pool[P.pool.length - 1].id);
    t.eq(await info(t, id), ['OUT5', '', 'Living', false, [300, 200]]);
    await t.drag(300, 200, 240, 120);
    t.eq(await info(t, id), ['OUT5', '', 'Dining', false, [240, 120]]);
  },
  'place a floor-only device onto the schematic': async t => {
    await t.open('#home'); await goFloor(t);
    await t.eval(() => setMode('fpplace', 'rout')); await t.click(240, 120); await t.key('Escape');
    const id = await t.eval(() => P.pool[P.pool.length - 1].id);
    await t.click(240, 120); await t.page.click('[data-act="placeOnSchematic"]');
    await t.click(200, 100);
    t.eq(await info(t, id), ['OUT5', 'CKT1', 'Dining', true, [240, 120]]);
  },
  'schematic-first device placed on the floor plan': async t => {
    await t.open('#home'); await t.goPage('CKT 1/1');
    await t.eval(() => setMode('place', 'rlgt')); await t.click(240, 100); await t.key('Escape');
    const id = await t.eval(() => [...sel][0]);
    await t.eval(id => { sel = new Set([id]); render(); }, id);
    await t.page.click('[data-act="placeOnFloor"]'); await t.click(320, 190);
    t.eq(await info(t, id), ['LGT4', 'CKT1', 'Living', true, [320, 190]]);
  },
  'rooms snap to neighboring walls and corners': async t => {
    await t.open('#home'); await goFloor(t);
    await t.eval(() => setMode('room')); await t.drag(242, 232, 358, 270);
    await t.page.fill('#dlgbody input[name="name"]', 'Garage'); await t.enter();
    t.eq(await t.eval(() => P.levels[0].rooms.find(r => r.name === 'Garage').pts[0][1]), 230, 'top edge locks to Living wall');
    await t.eval(() => setMode('roompoly'));
    for (const [x, y] of [[282, 42], [380, 42], [380, 141], [282, 141], [282, 42]]) await t.click(x, y);
    await t.page.fill('#dlgbody input[name="name"]', 'Office'); await t.enter();
    t.eq(await t.eval(() => P.levels[0].rooms.find(r => r.name === 'Office').pts), [[280, 40], [380, 40], [380, 140], [280, 140]]);
  },
  'single-room page option only once rooms exist': async t => {
    await t.open();
    await t.eval(() => addFloorPage());
    t.eq(await t.eval(() => [...document.querySelectorAll('#dlgbody select[name=view] option')].map(o => o.value)), ['level', 'area']);
    await t.confirm();
    await t.eval(() => { levelOf(page()).rooms.push({ id: 'r1', name: 'Kitchen', pts: [[40, 40], [120, 40], [120, 120], [40, 120]] }); render(); addFloorPage(); });
    await t.page.selectOption('#dlgbody select[name="view"]', 'room'); await t.confirm();
    t.eq(await t.eval(() => [page().view, page().desc]), ['room', 'Kitchen']);
  },
  'custom area page': async t => {
    await t.open('#home');
    await t.eval(() => addFloorPage()); await t.page.selectOption('#dlgbody select[name="view"]', 'area'); await t.enter();
    await t.page.waitForTimeout(50);
    t.eq(await t.eval(() => mode), 'area');
    await t.drag(30, 30, 290, 150);
    t.eq(await t.eval(() => page().area), [30, 30, 290, 150]);
  },
  'image import stays out of undo history and survives reload': async t => {
    await t.open('#home'); await goFloor(t);
    const file = path.join(t.root, 'build', 'test-plan.png'); png(file);
    t.page.once('filechooser', fc => fc.setFiles(file));
    await t.page.click('[data-act="importImage"]'); await t.page.waitForTimeout(400);
    t.ok(await t.eval(() => !!P.levels[0].image), 'image placed');
    t.ok(await t.eval(() => !snapshot().includes('data:image')), 'undo snapshot excludes image data');
    const json = await t.eval(() => projectJSON());
    await t.eval(j => loadProject(JSON.parse(j), ''), json);
    t.ok(await t.eval(() => !!P.assets[P.levels[0].image.asset]), 'image restored');
  },
  'switch legs and circuit colors can be turned off': async t => {
    await t.open('#home'); await goFloor(t);
    t.ok(await t.eval(() => document.querySelectorAll('#content .leg').length) > 0);
    await t.eval(() => { S().switchLegs = false; render(); });
    t.eq(await t.eval(() => document.querySelectorAll('#content .leg').length), 0);
  },
};
