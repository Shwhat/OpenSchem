// Decks: sizes from the DCA 6 tables, footings and posts, framing, decking layouts, stairs, guards, links and reports.
const IN = 25.4;
export const tests = {
  'decks: a new deck gets its pages, the Deck tab and a hardware list; sizes follow the DCA 6 tables': async t => {
    await t.open('#ind');
    await t.eval(() => newDeckDlg());
    await t.page.fill('input[name="name"]', 'Back deck'); await t.page.fill('input[name="w"]', "16'"); await t.page.fill('input[name="d"]', "12'"); await t.page.fill('input[name="h"]', '36"');
    await t.confirm();
    t.eq(await t.eval(() => [page().view, ribbonTab]), ['dframe', 'deck']);
    t.eq(await t.eval(() => P.pages.filter(p => p.bld === P.buildings[0].id).map(p => p.view)), ['dfoot', 'dframe', 'ddeck', 'delev', 'dstair']);
    t.eq(await t.eval(() => ['lumber', 'cutlist', 'cutplan', 'bviews', 'hardware'].map(k => REPORTS.some(r => r.report === k && r.bld === P.buildings[0].id))), [true, true, true, true, true]);
    // 5/4 decking: joists at 16"; southern pine 2x8 spans 11'-10" (Table 2); the cantilever is the lesser of 2'-0" and a quarter of the span
    const m = await t.eval(() => { const M = frameModel(P.buildings[0]), m = M.plats[0]; return { js: sizeName(m.js), sp: Math.round(M.sp / 25.4), max: Math.round(m.J.Lmax / 25.4), span: Math.round(m.J.bay / 25.4 * 2) / 2, c: Math.round(m.J.c / 25.4 * 2) / 2, beam: m.best.ply + '-' + sizeName(m.best.size), posts: m.best.n, LB: m.best.LB / 25.4, LBmax: Math.round(m.best.LBmax / 25.4), foot: Math.round(m.foot.round / 25.4), warns: M.warns }; });
    t.eq([m.js, m.sp, m.max, m.span, m.c], ['2x8', 16, 142, 119, 23.5]);
    t.eq([m.beam, m.posts, m.LBmax, m.foot], ['2-2x10', 3, 85, 24]); t.ok(m.LB <= m.LBmax, 'posts within the beam span'); t.eq(m.warns, []);
    t.ok(await t.eval(() => $('#content').textContent.includes('DCA 6 Table 2 allows 142"')), 'framing plan quotes the table');
    // a Douglas fir deck gets shorter spans: 2x8 at 16" spans 11'-1"
    t.eq(await t.eval(() => Math.round(jspan('dfl', 2, 16 * 25.4) / 25.4)), 133);
    // an override over the table is kept with a warning
    await t.page.selectOption('#props select[data-k="fb.joist"]', '1');
    t.ok(await t.eval(() => frameModel(P.buildings[0]).warns.some(w => /DCA 6 Table 2/.test(w)) && $('#props').textContent.includes('Over the tables')), 'warning for 2x6 joists');
    await t.eval(() => checkProject()); t.ok((await t.page.textContent('#dlgbody')).includes('Table 2'), 'project check lists the warning'); await t.page.click('#dlgbtns .primary');
    await t.eval(() => deckGoHardware());
    t.ok(await t.eval(() => page().report === 'hardware' && ['Concrete footing', 'Post base', 'Post cap', 'Ledger lag screws', 'Joist hanger', 'Deck screws', 'Concrete mix'].every(s => $('#content').textContent.includes(s))), 'hardware list');
  },
  'decks: stairs, guards with 4 inch openings, steps between levels and an L-shape': async t => {
    await t.open('#ind');
    const r = await t.eval(() => {
      const b = newDeck({ name: 'D', w: 192 * 25.4, d: 144 * 25.4, h: 36 * 25.4 }); b.stairs.push(newDeckStair(b, { at: 120 * 25.4, w: 48 * 25.4 }));
      b.plats.push({ id: uid(), x: 0, y: 144 * 25.4, w: 96 * 25.4, d: 96 * 25.4, h: 12 * 25.4 });   // a lower level in front
      P.buildings.push(b); syncFramePages(b); const M = frameModel(b);
      const st = M.stairs.map(s => [s.name, s.n, Math.round(s.riser / 25.4 * 100) / 100, s.n - 1, s.nStr, s.to === undefined ? '' : s.s.to]);
      return { errs: M.errs, st, gaps: M.rails.map(x => x.balGap / 25.4), front: M.rails.filter(x => x.Pm.pi === 0 && x.side === 'front').map(x => [Math.round(x.lo / 25.4), Math.round(x.hi / 25.4)]) };
    });
    t.eq(r.errs, []);
    t.eq(r.st[0].slice(0, 5), ['Stairs', 5, 7.2, 4, 4]);
    t.eq(r.st[1].slice(0, 2), ['Steps', 4]);
    t.ok(r.gaps.length && r.gaps.every(g => g < 4 && g > 2), 'baluster gaps ' + r.gaps.join(' '));
    // the upper front edge has a guard except over the lower level step-down (24") and the stairs
    t.ok(r.front.every(([a, c]) => a >= 96 || c <= 96), 'no guard where the steps go down: ' + JSON.stringify(r.front));
    // L-shape: a section at the same height has no guard along the joint
    const L = await t.eval(() => { const b = newDeck({ name: 'L', w: 192 * 25.4, d: 120 * 25.4, h: 40 * 25.4 }); b.plats.push({ id: uid(), x: 96 * 25.4, y: 120 * 25.4, w: 96 * 25.4, d: 96 * 25.4, h: 40 * 25.4 }); const M = frameModel(b);
      return [M.errs.length, M.stairs.length, M.rails.some(x => x.Pm.pi === 0 && x.side === 'front' && x.hi > 97 * 25.4)]; });
    t.eq(L, [0, 0, false]);
  },
  'decks: decking layouts, staggered butt joints over joists and composite spacing': async t => {
    await t.open('#ind');
    const r = await t.eval(() => {
      const mk = (set) => { const b = newDeck({ name: 'K', w: 30 * 12 * 25.4, d: 12 * 12 * 25.4, h: 36 * 25.4 }); Object.assign(b.dk, set); return frameModel(b); };
      const sq = mk({ mat: '54', lay: 'square' }), P0 = sq.plats[0], jc = P0.xs.map(x => x + sq.T / 2);
      const joints = P0.boards.filter(q => q.name === 'Decking').map(q => [q.pts[0][0], q.pts[1][0]]).flat().filter(x => x > 1 && x < P0.p.w - 1);
      const onJoists = joints.every(x => jc.some(c => Math.abs(c - x) < 1));
      const longOk = sq.pieces.filter(p => p.name === 'Decking').every(p => p.len <= sq.maxLen + 1);
      const diag = mk({ mat: 'comp', lay: 'diag' }), frame = mk({ mat: '2x6', lay: 'frame' }), brk = mk({ mat: '54', lay: 'breaker' });
      return { onJoists, longOk, spliced: sq.pieces.some(p => p.name === 'Decking' && /part 1 of/.test(p.note)), diagSp: Math.round(diag.sp / 25.4), clips: diag.hw.some(h => h.item === 'Hidden fastener clip'),
        border: frame.pieces.filter(p => p.name === 'Border board').length, bblock: frame.pieces.some(p => p.name === 'Border blocking'), breaker: brk.pieces.some(p => p.name === 'Breaker board'), doubled: brk.plats[0].xs.length - sq.plats[0].xs.length };
    });
    t.ok(r.onJoists, 'butt joints land on joists'); t.ok(r.longOk && r.spliced, 'long rows spliced');
    t.eq([r.diagSp, r.clips], [12, true]); t.ok(r.border >= 4 && r.bblock, 'picture frame border with blocking'); t.ok(r.breaker && r.doubled >= 1, 'breaker board over doubled joists');
  },
  'decks: made from a floor plan room or wall and a building wall, and they follow it': async t => {
    await t.open('#demo');
    await t.eval(() => { const lv = P.levels[0], r = lv.rooms.find(x => x.name === 'Living'); goPage(P.pages.find(p => isFloor(p) && p.level === lv.id).id); sel = new Set([r.id]); deckFromFloor(); });
    await t.page.fill('input[name="h"]', '20"'); await t.confirm();
    const w0 = await t.eval(() => { const b = bldOf(page()); return [b.link.kind, Math.round(frameModel(b).plats[0].p.w)]; });
    t.eq(w0[0], 'room');
    await t.eval(() => { const r = P.levels[0].rooms.find(x => x.name === 'Living'); commit(() => { r.pts = r.pts.map(p => [p[0] > 300 ? p[0] + 10 : p[0], p[1]]); }); });
    t.eq(await t.eval(() => Math.round(frameModel(bldOf(page())).plats[0].p.w)), w0[1] + 480, 'follows the room (10 sheet mm at 1:48)');
    await t.eval(() => { const b = P.buildings.find(x => x.name === 'Garden shed'); goPage(P.pages.find(p => p.bld === b.id && p.view === 'right').id); deckFromFrame(); });
    await t.confirm();
    t.ok(await t.eval(() => { const b = bldOf(page()); return isDeck(b) && b.link.kind === 'bwall' && b.kind === 'ledger' && !frameModel(b).errs.length; }), 'deck on the shed wall');
    await t.eval(() => view3D()); await t.page.click('[data-v3mode="exploded"]'); await t.page.click('#dlgbtns .primary');
    await t.eval(() => frameExportXlsx());
  },
};
