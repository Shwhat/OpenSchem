// Tile layouts: typed outlines, floor plan rooms and walls, framing walls, patterns, cuts, tools and reports.
const IN = 25.4;
export const tests = {
  'tiles: a typed layout gets a page, a Tiles tab, a tree section and two reports; a corner start counts full and cut tiles': async t => {
    await t.open('#ind');
    await t.eval(() => newTileDlg());
    await t.page.fill('input[name="name"]', 'Mud room'); await t.page.fill('input[name="w"]', "10'"); await t.page.fill('input[name="h"]', "8'");
    await t.page.fill('input[name="tw"]', '12"'); await t.page.fill('input[name="th"]', '12"');
    await t.confirm();
    t.eq(await t.eval(() => [page().kind, pageName(page()), ribbonTab]), ['tile', 'Mud room/1', 'tiles']);
    t.ok(await t.eval(() => $('#tab-pages').textContent.includes('Tile layouts')), 'Tile layouts section in the page tree');
    t.eq(await t.eval(() => ['tilecuts', 'tileorder'].map(k => REPORTS.some(r => r.report === k && r.tile === P.tiles[0].id))), [true, true]);
    await t.eval(() => { const T = P.tiles[0]; commit(() => Object.assign(T.tile, { start: 'corner', corner: 'll', joint: 25.4 / 8 })); });
    const r = await t.eval(() => { const L = tileLayout(P.tiles[0]); return { full: L.tiles.filter(x => x.full).length, cuts: L.cuts.length, w: [...new Set(L.cuts.map(c => Math.round(c.lw / 25.4 * 1000) / 1000))].sort(), area: Math.round(L.area / 645.16) }; });
    t.eq(r.full, 63); t.eq(r.cuts, 17); t.ok(r.w.includes(10.875), 'right column cut 10 7/8": ' + r.w.join(' '));
    t.ok(r.area < 80 * 144 && r.area > 78 * 144, 'area less the joints ' + r.area);
    t.ok(await t.eval(() => $('#content').querySelectorAll('.tlf').length === 63 && $('#content').querySelectorAll('.tlc').length >= 17 && $('#content').querySelectorAll('.tlchalk').length === 2), 'tiles and chalk lines drawn');
    t.ok(await t.eval(() => $('#props').textContent.includes('63 full tiles, 17 cut')), 'summary in Properties');
    await t.eval(() => tileGoOrder());
    t.eq(await t.eval(() => page().report), 'tileorder');
    t.ok(await t.eval(() => $('#content').textContent.includes('Tiles to order') && $('#content').textContent.includes('Thinset') && $('#content').textContent.includes('Grout')), 'order page');
  },
  'tiles: every pattern lays out without overlaps, and balanced cuts avoid slivers': async t => {
    await t.open('#ind');
    const res = await t.eval(() => [['grid', 0], ['grid', 45], ['bond', 0], ['herring', 45], ['basket', 0], ['hex', 0], ['versailles', 0]].map(([pat, rot]) => {
      const T = newTileLayout('P', 'floor', { kind: 'typed', pts: ccwRect(0, 0, 3000, 2000) }); Object.assign(T.tile, { w: pat === 'herring' || pat === 'basket' ? 200 : 150, h: pat === 'herring' || pat === 'basket' ? 100 : 150, joint: 3, pattern: pat, rot });
      const L = tileLayout(T); return [pat, !L.err, L.tiles.filter(x => x.full).length > 10, L.area <= 3000 * 2000 + 1, L.area > 3000 * 2000 * 0.9];
    }));
    for (const r of res) t.eq(r.slice(1), [true, true, true, true], r[0]);
    // 10'4" with 12" tiles: a joint on the middle leaves 2" cuts; balancing puts a tile in the middle for 8" cuts
    const sl = await t.eval(() => { const T = newTileLayout('B', 'floor', { kind: 'typed', pts: ccwRect(0, 0, 124 * 25.4, 48 * 25.4) }); Object.assign(T.tile, { w: 12 * 25.4, h: 12 * 25.4, joint: 0 });
      T.tile.balance = false; const a = tileLayout(T).slivers.length; TILECACHE.clear(); T.tile.balance = true; const L = tileLayout(T); return [a, L.slivers.length, L.onX]; });
    t.ok(sl[0] > 0, 'slivers without balancing'); t.eq(sl.slice(1), [0, 'tile']);
  },
  'tiles: straight cuts reuse offcuts, and the cut list groups equal cuts': async t => {
    await t.open('#ind');
    await t.eval(() => { const T = newTileLayout('Test area', 'floor', { kind: 'typed', pts: ccwRect(0, 0, 126 * 25.4, 96 * 25.4) }); Object.assign(T.tile, { w: 12 * 25.4, h: 12 * 25.4, joint: 25.4 / 8, start: 'corner', corner: 'll' }); addTileLayout(T); });
    const r = await t.eval(() => { const T = P.tiles[0], L = tileLayout(T), O = tileOrder(T, L); return { cuts: O.rows[0].cuts, cutTiles: O.rows[0].cutTiles, reuse: O.plan.rows.filter(x => x.from !== 'New tile').length }; });
    t.ok(r.reuse > 0 && r.cutTiles < r.cuts, JSON.stringify(r));
    await t.eval(() => goPage(REPORTS.find(x => x.report === 'tilecuts').id));
    t.ok(await t.eval(() => $('#content').textContent.includes('Offcut') && $('#content').textContent.includes('Straight cut')), 'cut list shows offcuts');
  },
  'tiles: floor plan rooms and walls stay linked, and a deleted source keeps the last outline': async t => {
    await t.open('#demo');
    const room = await t.eval(() => { const lv = P.levels[0], r = lv.rooms.find(x => x.name === 'Laundry'); goPage(P.pages.find(p => isFloor(p) && p.level === lv.id).id); sel = new Set([r.id]); tileFromFloor(); return [page().kind, tileOf(page()).src.kind, tileOf(page()).name]; });
    t.eq(room, ['tile', 'room', 'Laundry floor']);
    t.ok(await t.eval(() => tileLayout(tileOf(page())).geom.neg.some(n => n.label === 'Water heater')), 'water heater left out');
    // stretch the room: the layout follows
    const a0 = await t.eval(() => tileLayout(tileOf(page())).area);
    await t.eval(() => { const r = P.levels[0].rooms.find(x => x.name === 'Laundry'); commit(() => { r.pts = r.pts.map(p => [p[0], p[1] > 200 ? p[1] + 10 : p[1]]); }); });
    t.ok(await t.eval(() => tileLayout(tileOf(page())).area) > a0 + 1e5, 'area grew with the room');
    // delete the room: the layout keeps its last outline and says so
    await t.eval(() => { const lv = P.levels[0]; commit(() => { lv.rooms = lv.rooms.filter(x => x.name !== 'Laundry'); }); });
    t.ok(await t.eval(() => { const L = tileLayout(tileOf(page())); return !L.err && L.geom.lost && $('#content').textContent.includes('keeps its last outline'); }), 'lost source keeps working');
    await t.eval(() => checkProject());
    t.ok((await t.page.textContent('#dlgbody')).includes('keeps its last outline'), 'project check warns');
    await t.page.click('#dlgbtns .primary');
    // a wall side with a height range; its doors are left out
    const w = await t.eval(() => { const lv = P.levels[0], w = lv.shapes.find(s => isWall(s) && openingsOf(lv, s).some(o => o.kind === 'door')); goPage(P.pages.find(p => isFloor(p) && p.level === lv.id).id); sel = new Set([w.id]); tileFromFloor(); return true; });
    t.ok(w); await t.page.fill('input[name="z1"]', '48"'); await t.confirm();
    t.ok(await t.eval(() => { const T = tileOf(page()), L = tileLayout(T); return T.src.kind === 'wall' && Math.abs(T.z1 - 48 * 25.4) < 0.01 && L.geom.neg.some(n => n.label === 'Door') && bboxOf(L.geom.pos)[3] <= 48 * 25.4 + 0.01; }), 'wall layout with a door left out, up to 48"');
  },
  'tiles: a framing wall layout follows the wall, and the tools add, cut out and pick the start': async t => {
    await t.open('#ind');
    await t.eval(() => { const b = newBuilding('building'); P.buildings.push(b); syncFramePages(b); sortPages(); goPage(P.pages.find(p => p.bld === b.id && p.view === 'back').id); });
    await t.eval(() => tileFromFrame()); await t.confirm();
    const L0 = await t.eval(() => { const T = tileOf(page()); return [T.src.kind, T.src.face, Math.round(bboxOf(tileLayout(T).geom.pos)[2])]; });
    t.eq(L0.slice(0, 2), ['fwall', 'in']);
    await t.eval(() => commit(() => { P.buildings[0].w += 600; }));
    t.eq(await t.eval(() => Math.round(bboxOf(tileLayout(tileOf(page())).geom.pos)[2])), L0[2] + 600, 'follows a wider building');
    // pick the start point and draw an added and a cut-out area with the mouse
    const click = async (x, y) => { const p = await t.eval(([x, y]) => { const xf = FRAME_XF.get(page().id); return [xf.X(x), xf.Y(y)]; }, [x, y]); await t.click(p[0], p[1]); };
    await t.eval(() => tileTool('start')); await click(500, 600);
    t.eq(await t.eval(() => { const t0 = tileOf(page()).tile; return [t0.start, Math.round(t0.pt[0] / 10) * 10, Math.round(t0.pt[1] / 10) * 10]; }), ['point', 500, 600]);
    await t.eval(() => tileTool('cut')); await click(1000, 800); await click(1300, 1200);
    t.eq(await t.eval(() => tileOf(page()).cuts.length), 1);
    t.ok(await t.eval(() => tileLayout(tileOf(page())).geom.neg.some(n => n.label === 'Cut-out')), 'cut-out leaves a hole');
    await t.eval(() => tileTool('add')); await click(200, 2400); await click(800, 2800);
    const added = await t.eval(() => [tileOf(page()).adds.length, bboxOf(tileLayout(tileOf(page())).geom.pos)[3] > 2700]);
    t.eq(added, [1, true]);
    t.ok(await t.eval(() => $('#props').textContent.includes('Added area')), 'the new area is selected');
    await t.eval(() => delSel()); t.eq(await t.eval(() => tileOf(page()).adds.length), 0);
    await t.eval(() => undo()); t.eq(await t.eval(() => tileOf(page()).adds.length), 1);
    // a setting in Properties
    await t.eval(() => { sel.clear(); render(); });
    await t.page.selectOption('#props select[data-k="tl.tile.pattern"]', 'hex');
    t.eq(await t.eval(() => [tileOf(page()).tile.pattern, tileLayout(tileOf(page())).tiles.every(x => x.k === 'hex')]), ['hex', true]);
    await t.eval(() => tileExportXlsx());
  },
};
