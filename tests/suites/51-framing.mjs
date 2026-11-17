// Framing pages: buildings and single walls with their framing, openings, floors, roofs, reports and floor plan links.
const IN = 25.4;
export const tests = {
  'framing: new building gets framing pages, a Framing section and lumber reports': async t => {
    await t.open('#ind');
    await t.eval(() => newBuildingDlg('building'));
    await t.page.fill('input[name="name"]', 'Garden shed'); await t.page.fill('input[name="w"]', "10'"); await t.page.fill('input[name="d"]', "8'");
    await t.confirm();
    t.eq(await t.eval(() => [page().kind, page().view, pageName(page())]), ['frame', 'plan', 'Garden shed/1']);
    t.eq(await t.eval(() => P.pages.filter(isFrame).map(p => p.view)), ['plan', 'front', 'right', 'back', 'left', 'floor', 'roof']);
    t.ok(await t.eval(() => $('#tab-pages').textContent.includes('Framing') && $('#tab-pages').textContent.includes('Garden shed')), 'Framing section in the page tree');
    t.ok(await t.eval(() => allPages().indexOf(page()) > allPages().findIndex(p => isFloor(p))), 'after the floor plans');
    t.eq(await t.eval(() => ['lumber', 'cutlist', 'cutplan'].map(k => REPORTS.some(r => r.report === k && r.bld === P.buildings[0].id))), [true, true, true]);
    t.ok(await t.eval(() => $('#toolbar').textContent.includes('Framing') && ribbonTab === 'framing'), 'Framing ribbon tab selected');
    // the front wall: a 38" rough opening centered in 10', double 2x6 header, gable studs above
    await t.eval(() => goPage(P.pages.find(p => isFrame(p) && p.view === 'front').id));
    const fw = await t.eval(() => { const M = frameModel(P.buildings[0]); const w = M.walls.find(x => x.key === 'front'); return { roL: Math.round(w.ops[0].roL / 25.4 * 100) / 100, kinds: w.members.map(m => m.kind + '@' + Math.round(m.x / 25.4 * 100) / 100), fill: w.fill.length, cap: w.cap.pieces[0].len / 25.4, hdr: w.ops[0].hd.name }; });
    t.eq(fw.roL, 41); t.eq(fw.hdr, 'Double 2x6'); t.eq(fw.cap, 113);
    t.ok(fw.kinds.includes('king@38') && fw.kinds.includes('jack@39.5') && fw.kinds.includes('cripple@47.25'), fw.kinds.join(' '));
    t.ok(fw.fill >= 5, 'gable studs above the plates');
    t.ok(await t.eval(() => $('#content').textContent.includes('RO 38"') && $('#content').textContent.includes('viewed from outside')), 'elevation drawn with dimensions');
    // side walls fit between the front and back walls; the roof is a 6/12 gable with 2x6 rafters
    const r = await t.eval(() => { const M = frameModel(P.buildings[0]); return { right: Math.round(M.walls.find(x => x.key === 'right').len / 25.4 * 100) / 100, raf: Math.round(M.roof.rafterLen / 25.4 * 100) / 100, n: M.roof.n, boards: M.boards.length, sheets: M.sheets.map(s => s.sec + ':' + s.count) }; });
    t.eq(r.right, 89); t.eq(r.raf, 79.66); t.eq(r.n, 5); t.ok(r.boards > 50 && r.boards < 80, 'boards ' + r.boards);
    t.eq(r.sheets[0], 'Floor:4');
    // lumber list page and its rows
    await t.eval(() => frameGoLumber());
    t.eq(await t.eval(() => [page().report, page().title]), ['lumber', 'Lumber list Garden shed']);
    t.ok(await t.eval(() => $('#content').textContent.includes('Boards to buy') && $('#content').textContent.includes('precut stud 92 5/8"')), 'lumber list content');
  },
  'framing: openings are added, dragged along the wall, edited in Properties and undone': async t => {
    await t.open('#ind');
    await t.eval(() => { const b = newBuilding('building'); P.buildings.push(b); syncFramePages(b); sortPages(); goPage(P.pages.find(p => p.bld === b.id && p.view === 'right').id); zoomFit(); });
    await t.eval(() => frameAddOpening('window'));
    const id = await t.eval(() => [...sel][0]);
    t.eq(await t.eval(() => { const f = frameOpFind([...sel][0]); return [f.k, f.o.type, f.o.ctr]; }), ['right', 'window', true]);
    t.ok(await t.eval(() => $('#props').textContent.includes('Window 1') && $('#props').textContent.includes('Sill height')), 'opening properties');
    // drag it 10" to the right (sheet distance = real / scale)
    const before = await t.eval(() => { const M = frameModel(P.buildings[0]); return M.walls.find(w => w.key === 'right').ops[0].roL; });
    const pos = await t.eval(id => { const xf = FRAME_XF.get(page().id); const M = frameModel(P.buildings[0]); const o = M.walls.find(w => w.key === 'right').ops[0]; return [xf.X(o.roL + o.w / 2), xf.Y((o.sill + o.top) / 2), xf.k]; }, id);
    await t.drag(pos[0], pos[1], pos[0] + 10 * IN / pos[2], pos[1]);
    const after = await t.eval(() => P.buildings[0].walls.right.ops[0]);
    t.eq(after.ctr, false); t.ok(Math.abs(after.x - before - 10 * IN) < 13, 'moved about 10": ' + (after.x - before) / IN);
    // type a new width in Properties
    await t.page.fill('[data-k="fo.w"]', '30'); await t.page.press('[data-k="fo.w"]', 'Tab');
    t.eq(await t.eval(() => P.buildings[0].walls.right.ops[0].w / 25.4), 30);
    await t.eval(() => document.activeElement.blur());
    await t.key('Control+z'); t.eq(await t.eval(() => Math.round(P.buildings[0].walls.right.ops[0].w / 25.4 * 10) / 10), 36.5);
    await t.key('Control+z'); t.eq(await t.eval(() => P.buildings[0].walls.right.ops[0].ctr), true);
    // delete with the Delete key
    await t.eval(() => { sel = new Set([P.buildings[0].walls.right.ops[0].id]); render(); }); await t.key('Delete');
    t.eq(await t.eval(() => P.buildings[0].walls.right.ops.length), 0);
    // an opening too close to the end is reported in plain words
    await t.eval(() => commit(() => { const o = newFrameOpening('door', 2000); o.ctr = false; o.x = 10; P.buildings[0].walls.right.ops.push(o); }));
    t.ok(await t.eval(() => frameModel(P.buildings[0]).errs[0].includes('from the left end')), 'error message');
    t.ok(await t.eval(() => $('#content').textContent.includes('cannot be drawn yet')), 'error shown on the page');
  },
  'framing: a single framed wall matches the hand layout and buys the fewest boards': async t => {
    await t.open('#ind');
    await t.eval(() => newBuildingDlg('wall'));
    await t.page.fill('input[name="name"]', 'Partition'); await t.page.fill('input[name="len"]', '113 1/2');
    await t.confirm();
    t.eq(await t.eval(() => P.pages.filter(isFrame).map(p => p.view)), ['wall']);
    await t.eval(() => commit(() => { const o = P.buildings[0].walls.single.ops[0]; o.w = 32 * 25.4; o.hdr = 'flat'; }));
    const m = await t.eval(() => { const M = frameModel(P.buildings[0]); const w = M.walls[0]; return { marks: w.members.map(q => q.kind + '@' + Math.round(q.x / 25.4 * 100) / 100), crip: w.members.find(q => q.kind === 'cripple').y1 - w.members.find(q => q.kind === 'cripple').y0, boards: M.boards.length, jack: Math.round((w.members.find(q => q.kind === 'jack').y1 - w.members.find(q => q.kind === 'jack').y0) / 25.4 * 100) / 100 }; });
    t.eq(m.marks.filter(x => !x.startsWith('cripple')), ['end@0', 'common@15.25', 'common@31.25', 'king@37.75', 'jack@39.25', 'jack@72.75', 'king@74.25', 'common@79.25', 'common@95.25', 'end@112']);
    t.eq(await t.eval(c => fmtCut(c), m.crip), '10 1/8"'); t.eq(m.jack, 81); t.eq(m.boards, 12);
    // floor and roof dialogs are not offered for a single wall
    await t.eval(() => frameSectionDlg('roof')); t.ok(await t.eval(() => !$('#dlg').open), 'no roof dialog');
  },
  'splicing: plates, rims and ridge join over supports, rafter ties lap or get a scab, settings, marks, and a new building is not blocked': async t => {
    await t.open('#ind');
    // a 20' x 12' building with 8' to 16' boards: the 20' rafter ties and plates are longer than any board
    await t.eval(() => newBuildingDlg('building'));
    await t.page.fill('input[name="w"]', "20'"); await t.page.fill('input[name="d"]', "12'"); await t.confirm();
    t.eq(await t.eval(() => P.buildings.length), 1, 'created without a blocking message');
    const m = await t.eval(() => { const M = frameModel(P.buildings[0]); const T = M.T; const fw = M.walls.find(w => w.key === 'front');
      const studX = fw.members.filter(q => q.kind !== 'cripple' && q.kind !== 'lcripple').map(q => q.x + T / 2);
      return { errs: M.errs.length, tie: M.roof.tieSplice, ties: M.pieces.filter(p => p.name === 'Rafter tie').map(p => Math.round(p.len / 25.4 * 100) / 100), note: M.pieces.find(p => p.name === 'Rafter tie').note,
        top: fw.topP.splices, overStud: fw.topP.splices.every(x => studX.some(c => Math.abs(c - x) < 0.5)), capGap: fw.cap.splices.every(c => fw.topP.splices.every(x => Math.abs(c - x) >= 609)),
        rimNote: M.pieces.filter(p => p.name === 'Rim joist').map(p => p.note), plateNote: M.pieces.find(p => p.name === 'Top plate').note }; });
    t.eq(m.errs, 0); t.eq(m.tie.how, 'lap'); t.eq(m.ties.slice(0, 2), [132, 132], '10\' halves plus half the 24" lap');
    t.ok(/^part 1 of 2, lapped 24" at the middle/.test(m.note), m.note);
    t.ok(m.top.length === 1 && m.overStud && m.capGap, 'plate joint over a stud, cap joint 24" away');
    t.ok(m.plateNote.startsWith('part 1 of 2, joint over a stud'), m.plateNote); t.ok(m.rimNote.every(n => /joint over a joist/.test(n)), 'rim notes');
    t.ok(await t.eval(() => { goPage(P.pages.find(p => isFrame(p) && p.view === 'front').id); return $('#content').querySelectorAll('.frsplice').length >= 2; }), 'splice marks on the elevation');
    t.ok(await t.eval(() => { goPage(P.pages.find(p => isFrame(p) && p.view === 'roof').id); return $('#content').textContent.includes('2 pieces lapped 24"'); }), 'roof page notes the tie splice');
    // scab instead of a lap, and a longer shortest piece
    await t.eval(() => frameSectionDlg('lumber')); await t.page.selectOption('select[name="splice.tie"]', 'scab'); await t.page.fill('input[name="splice.len"]', '36'); await t.confirm();
    const sc = await t.eval(() => { const M = frameModel(P.buildings[0]); return { how: M.roof.tieSplice.how, ties: M.pieces.filter(p => p.name === 'Rafter tie').length, scabs: M.pieces.filter(p => p.name === 'Tie scab').map(p => Math.round(p.len / 25.4)), n: M.roof.ties }; });
    t.eq(sc.how, 'scab'); t.eq(sc.ties, 2 * sc.n); t.eq(sc.scabs, Array(sc.n).fill(36));
    // do not splice: the old message, shown on the page and in the check, not blocking anything
    await t.eval(() => commit(() => { P.buildings[0].splice.tie = 'none'; }));
    t.ok(await t.eval(() => frameModel(P.buildings[0]).errs[0].includes('rafter tie needs')), 'unspliced tie reported');
    // with 20' boards turned on, nothing needs a splice
    await t.eval(() => commit(() => { P.buildings[0].stock.lens = [0, 1, 2, 3, 4, 5, 6]; P.buildings[0].splice.tie = 'lap'; }));
    t.eq(await t.eval(() => [frameModel(P.buildings[0]).roof.tieSplice, frameModel(P.buildings[0]).pieces.filter(p => /^part/.test(p.note)).length]), [null, 0]);
  },
  'framing: shed roof, metric lumber catalog and the section dialogs': async t => {
    await t.open('#ind');
    await t.eval(() => { const b = newBuilding('building'); P.buildings.push(b); syncFramePages(b); sortPages(); goPage(P.pages.find(p => p.bld === b.id).id); });
    await t.eval(() => frameSectionDlg('roof'));
    await t.page.selectOption('select[name="roof.type"]', 'shed'); await t.page.fill('input[name="roof.pitch"]', '2');
    await t.confirm();
    // the shed roof dialog shows the low side next time
    const sh = await t.eval(() => { const M = frameModel(P.buildings[0]); return { type: M.roof.type, high: M.roof.high, front: M.walls.find(w => w.key === 'front').S / 25.4, back: M.walls.find(w => w.key === 'back').S / 25.4, rake: M.walls.find(w => w.key === 'left').fill.length }; });
    t.eq([sh.type, sh.high], ['shed', 'front']); t.ok(sh.front > sh.back + 15, 'high wall taller: ' + sh.front); t.ok(sh.rake > 3, 'rake wall studs');
    // switch the project to metric lumber
    await t.eval(() => projectProps()); await t.page.selectOption('select[name="units"]', 'metric'); await t.page.selectOption('select[name="lumber"]', 'metric'); await t.confirm();
    const mt = await t.eval(() => { const b = P.buildings[0], M = frameModel(b); return { stud: sizeName(b.stud), sp: b.sp, cut: fmtCut(1234.4), sizes: [...new Set(M.pieces.map(p => p.size))].sort() }; });
    t.eq(mt.stud, '45x95'); t.eq(mt.sp, 400); t.eq(mt.cut, '1234 mm'); t.ok(mt.sizes.includes('45x145'), mt.sizes.join(','));
    // the lumber dialog turns board lengths off and on
    await t.eval(() => frameSectionDlg('lumber')); await t.page.uncheck('input[name="len:4"]'); await t.page.uncheck('input[name="len:3"]'); await t.confirm();
    t.eq(await t.eval(() => P.buildings[0].stock.lens), [0, 1, 2]);
    t.ok(await t.eval(() => frameModel(P.buildings[0]).boards.every(b => b.stock.len <= 3600)), 'only lengths turned on');
  },
  'framing: building from a floor plan room, floor plan from a building, 3D views': async t => {
    await t.open('#ind');
    // a level with a 12' x 10' room and a door in the bottom wall
    await t.eval(() => {
      commit(() => {
        const lv = { id: uid(), name: 'Main', rooms: [], places: [], image: null, scale: 48, shapes: [] }; P.levels.push(lv);
        const s = 48, ox = 60, oy = 200, w = 144 * 25.4 / s, d = 120 * 25.4 / s;
        const pts = [[ox, oy - d], [ox + w, oy - d], [ox + w, oy], [ox, oy]];
        lv.rooms.push({ id: 'room1', name: 'Workshop', pts });
        const wall = { id: 'w1', t: 'wall', a: [ox, oy + 1], b: [ox + w, oy + 1], th: 2, just: 'c', h: 96 * 25.4, kind: 'x' }; lv.shapes.push(wall);
        lv.shapes.push({ id: 'd1', t: 'opening', wall: 'w1', c: [ox + w / 2, oy + 1], w: 36 * 25.4 / s, kind: 'door', style: 'single', side: 1, hinge: 'a', h: 80 * 25.4, tag: 'D1' });
        const np = newFloorPage(lv.id, 1, 'Main'); P.pages.push(np); sortPages(); curId = np.id; sel = new Set(['room1']);
      });
    });
    await t.eval(() => frameFromRoom());
    t.eq(await t.eval(() => $('input[name="name"]').value), 'Workshop');
    await t.confirm();
    const b = await t.eval(() => { const b = P.buildings[0]; return { w: Math.round(b.w / 25.4 * 10) / 10, d: Math.round(b.d / 25.4 * 10) / 10, ops: b.walls.front.ops.map(o => [o.type, Math.round(o.w / 25.4), Math.round((o.x + o.w / 2) / 25.4 * 10) / 10]) }; });
    t.eq(b.w, 151); t.eq(b.d, 127); t.eq(b.ops, [['door', 38, 75.5]]);
    // floor plan from the building: 4 walls, the door, a room
    await t.eval(() => frameToFloor());
    const lv = await t.eval(() => { const lv = levelOf(page()); return { name: lv.name, walls: lvWalls(lv).length, ops: lvShapes(lv).filter(s => s.t === 'opening').map(o => o.kind), rooms: lv.rooms.length, real: Math.round(roomPoly(lv.rooms[0])[1][0] - roomPoly(lv.rooms[0])[0][0]) }; });
    t.eq([lv.name, lv.walls, lv.ops, lv.rooms], ['Workshop', 4, ['door'], 1]);
    // 3D view of the level and of the building
    await t.eval(() => view3D()); t.ok(await t.eval(() => $('#dlg').open && !!$('#v3canvas') && V3.scene.boxes.length >= 5), '3D view of the level');
    await t.eval(() => $('#dlg').close());
    await t.eval(() => { goPage(P.pages.find(p => isFrame(p) && p.view === 'plan').id); view3D(); });
    t.ok(await t.eval(() => $('#dlg').open && V3.M && V3.mode === 'shell' && !$('#v3cut')), '3D view of the building, drawn like the report');
    await t.eval(() => $('#dlg').close());
  },
  'building views report: framing, shell and exploded sheets in four views, labels, dimensions, settings and the 3D window modes': async t => {
    await t.open('#ind');
    await t.eval(() => { const b = newBuilding('building'); b.walls.right.ops.push(newFrameOpening('window', 2000)); const w = newBuilding('wall', { name: 'Partition' }); P.buildings.push(b, w); [b, w].forEach(syncFramePages); sortPages(); render(); });
    const reps = await t.eval(() => REPORTS.filter(r => r.report === 'bviews').map(r => [r.bld === P.buildings[0].id ? 'shed' : 'wall', r.view3, r.sheet, r.sheets]));
    t.eq(reps, [['shed', 'framing', 1, 3], ['shed', 'shell', 2, 3], ['shed', 'exploded', 3, 3], ['wall', 'framing', 1, 2], ['wall', 'shell', 2, 2]]);
    t.ok(await t.eval(() => $('#tab-pages').textContent.includes('Building views')), 'in the page tree under Reports');
    // the framing sheet: four views of member polygons, wall names, width, depth and peak on the first view, a legend
    await t.eval(() => goPage(REPORTS.find(r => r.report === 'bviews').id));
    const f = await t.eval(() => { const txt = $('#content').textContent; return { polys: $('#content').querySelectorAll('polygon').length, front: (txt.match(/FRONT/g) || []).length, width: (txt.match(/Width 10'/g) || []).length, peak: /Peak 11'-9 1\/4"/.test(txt), legend: txt.includes('King studs') && txt.includes('Rafters') }; });
    t.ok(f.polys > 800, 'member faces drawn: ' + f.polys); t.eq(f.front, 2, 'front wall named in the two views that show it'); t.eq(f.width, 1, 'dimensions on the first view only'); t.ok(f.peak && f.legend, 'peak height and legend');
    // member colors match the elevations: king studs, jack studs and headers are there
    t.ok(await t.eval(() => ['#d9b37a', '#c4914f', '#9b6a33'].every(c => frameSolids(frameModel(P.buildings[0]), 'framing').solids.some(s => s.color === c))), 'king, jack and header colors');
    // the shell sheet has glass and a door panel; the exploded sheet moves the walls out and lifts the roof
    t.ok(await t.eval(() => { const sc = frameSolids(frameModel(P.buildings[0]), 'shell'); const after = sc.solids.flatMap(s => s.after || []); return after.some(s => s.color === MCOL.glass && s.alpha < 1) && after.some(s => s.color === MCOL.door) && sc.solids.some(s => s.last) && sc.solids.some(s => s.floor); }), 'shell surfaces');
    t.ok(await t.eval(() => { const M = frameModel(P.buildings[0]); const a = frameSolids(M, 'framing'), e = frameSolids(M, 'exploded'); return e.ex > 0 && e.lift > 0 && e.bounds[0] < a.bounds[0] - 500 && e.bounds[5] > a.bounds[5] + 500; }), 'exploded apart');
    // a shell wall is one piece: no faces where pieces meet, only the outside, the opening sides, head and sill
    const sw = await t.eval(() => {
      const M = frameModel(P.buildings[1]), fw = M.walls[0], op = fw.ops[0], sc = frameSolids(M, 'shell');
      const walls = sc.solids.filter(s => s.color === MCOL.wall);
      const at = (x, z) => Math.abs(x - op.roL) < 0.5 || Math.abs(x - op.roR) < 0.5;
      const ends = walls[0].faces.filter(f => f.every(p => Math.abs(p[0] - f[0][0]) < 0.5) && at(f[0][0])).map(f => Math.max(...f.map(p => p[2])));
      const head = walls[0].faces.filter(f => f.every(p => Math.abs(p[2] - op.top) < 0.5)).length;
      return { n: walls.length, ends, top: op.top, head, door: walls[0].after.some(s => s.color === MCOL.door) };
    });
    t.eq(sw.n, 1, 'one solid for the wall'); t.eq(sw.ends.length, 2, 'two door sides'); t.ok(sw.ends.every(z => z <= sw.top + 0.5), 'door sides stop at the head: ' + sw.ends + ' / ' + sw.top);
    t.eq(sw.head, 1, 'one head over the door'); t.ok(sw.door, 'door panel drawn right after its wall');
    t.ok(await t.eval(() => frameSolids(frameModel(P.buildings[0]), 'shell').solids.filter(s => s.color === MCOL.wall && s.faces.length > 6).length === 4), 'four walls, one solid each');
    // printing uses the same drawing
    t.ok(await t.eval(() => pageSVG(REPORTS.find(r => r.report === 'bviews' && r.view3 === 'exploded'), { print: true }).includes('<polygon')), 'prints');
    // Project properties turn the report off
    await t.eval(() => projectProps());
    t.ok(await t.eval(() => $('#dlgbody').textContent.includes('Building views')), 'listed in the report settings');
    await t.page.uncheck('[data-repon="bviews"]'); await t.confirm();
    t.eq(await t.eval(() => REPORTS.filter(r => r.report === 'bviews').length), 0);
    await t.eval(() => projectProps()); await t.page.check('[data-repon="bviews"]'); await t.confirm();
    t.eq(await t.eval(() => REPORTS.filter(r => r.report === 'bviews').length), 5);
    // the 3D window switches between shell, framing and exploded
    await t.eval(() => { goPage(P.pages.find(p => isFrame(p) && p.bld === P.buildings[0].id).id); view3D(); });
    t.eq(await t.eval(() => [...document.querySelectorAll('[data-v3mode]')].map(b => b.textContent)), ['Shell', 'Framing', 'Exploded']);
    await t.page.click('[data-v3mode="exploded"]'); t.eq(await t.eval(() => V3.mode), 'exploded');
    await t.page.click('[data-v3mode="framing"]'); t.eq(await t.eval(() => V3.mode), 'framing');
    await t.eval(() => $('#dlg').close());
    // floor plan 3D views have no mode switch
    await t.eval(() => { const lv = { id: uid(), name: 'L', rooms: [{ id: 'r', name: 'R', pts: [[50, 50], [100, 50], [100, 100], [50, 100]] }], places: [], image: null, scale: 48, shapes: [] }; P.levels.push(lv); const np = newFloorPage(lv.id, 1, 'L'); P.pages.push(np); sortPages(); goPage(np.id); view3D(); });
    t.eq(await t.eval(() => document.querySelectorAll('[data-v3mode]').length), 0);
    await t.eval(() => $('#dlg').close());
  },
  'framing: duplicate and delete a building, Excel export, PDF includes framing pages': async t => {
    await t.open('#ind');
    await t.eval(() => { const b = newBuilding('building'); P.buildings.push(b); syncFramePages(b); sortPages(); goPage(P.pages.find(p => p.bld === b.id && p.view === 'front').id); });
    await t.eval(() => dupPage());
    t.eq(await t.eval(() => [P.buildings.length, P.buildings[1].name, page().view, P.pages.filter(isFrame).length]), [2, 'Shed copy', 'front', 14]);
    t.ok(await t.eval(() => P.buildings[1].walls.front.ops[0].id !== P.buildings[0].walls.front.ops[0].id), 'new opening ids');
    await t.eval(() => delPage());
    t.eq(await t.eval(() => [P.buildings.length, P.pages.filter(isFrame).length]), [1, 7]);
    const saved = await t.eval(async () => { let got = null; const keep = host.saveBinary; host.saveBinary = async (b64, name) => { got = name; return name; }; await frameExportXlsx(); host.saveBinary = keep; return got; });
    t.ok(/framing materials\.xlsx$/.test(saved), saved);
    const pdf = await t.eval(async () => { let got = null; const keep = host.saveBinary; host.saveBinary = async (b64, name) => { got = b64.length; return name; }; await exportPDF(P.pages.filter(isFrame).map(p => p.id).concat(REPORTS.filter(r => r.report === 'lumber').map(r => r.id))); host.saveBinary = keep; return got; });
    t.ok(pdf > 1000, 'PDF made');
  },
};
