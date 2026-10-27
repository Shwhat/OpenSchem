// Schematic editing: placing, tagging, wiring, moving, copying, variants, undo.
const items = t => t.eval(() => page().items.map(i => [i.sym, i.tag, i.x, i.y, (i.cl || []).join('/')]));
const wires = t => t.eval(() => page().wires.map(w => w.pts));

export const tests = {
  'placing devices assigns tags and contact numbers': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.click(140, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'no'); }); await t.click(100, 60); await t.click(120, 60); await t.key('Escape');
    await t.eval(() => { setMode('place', 'term'); }); await t.click(180, 60); await t.click(188, 60); await t.key('Escape');
    t.eq(await items(t), [
      ['coil', 'K1', 100, 100, 'A1/A2'], ['coil', 'K2', 140, 100, 'A1/A2'],
      ['no', 'K2', 100, 60, '13/14'], ['no', 'K2', 120, 60, '23/24'],
      ['term', 'X1', 180, 60, '/'], ['term', 'X1', 188, 60, '/']]);
    t.eq(await t.eval(() => page().items.filter(i => i.sym === 'term').map(i => i.tn)), ['1', '2']);
  },
  'wires connect, number per potential, and rubber-band when moving': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'no'); }); await t.click(100, 60); await t.key('Escape');
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.key('w'); await t.click(100, 68); await t.click(100, 92); await t.key('Escape');
    t.eq(await wires(t), [[[100, 68], [100, 92]]]);
    t.eq(await t.eval(() => [...WN.values()]), ['1']);
    await t.key('Escape'); await t.drag(100, 100, 108, 104);
    t.eq(await t.eval(() => [page().items[1].x, page().items[1].y]), [108, 104]);
    t.eq(await wires(t), [[[100, 68], [100, 84], [108, 84], [108, 96]]]);
  },
  'wire ends lock onto nearby connection points': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.key('w'); await t.click(100.9, 107.3); await t.click(100, 140); await t.key('Escape');
    t.eq(await wires(t), [[[100, 108], [100, 140]]]);
  },
  'retagging the main function renames the whole device': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'no'); }); await t.click(140, 100); await t.key('Escape');
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.page.fill('[data-k="it.tag"]', 'K9'); await t.page.press('[data-k="it.tag"]', 'Tab');
    t.eq(await t.eval(() => page().items.map(i => i.tag)), ['K9', 'K9']);
  },
  'copy and paste gives new tags; undo and redo work': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.click(100, 100); await t.key('Control+c'); await t.key('Control+v');
    t.eq(await t.eval(() => page().items.map(i => i.tag)), ['K1', 'K2']);
    await t.key('Control+z'); t.eq(await t.eval(() => page().items.length), 1);
    await t.key('Control+y'); t.eq(await t.eval(() => page().items.length), 2);
  },
  'variants A to H: Tab while placing, dropdown and M on placed symbols': async t => {
    await t.open();
    await t.eval(() => setMode('place', 'no'));
    const [a, b] = await t.scr(100, 100); await t.page.mouse.move(a, b);
    await t.key('Tab'); await t.key('Tab'); await t.key('m');
    await t.click(100, 100); await t.key('Escape');
    t.eq(await t.eval(() => variantOf(page().items[0])), 'G');
    t.eq(await t.eval(() => connPts(page().items[0]).map(c => [c.x, c.y])), [[100, 108], [100, 92]]);
    await t.key('w'); await t.click(100, 108); await t.click(100, 140); await t.key('Escape');
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.page.selectOption('[data-k="it.variant"]', 'B');
    t.eq(await t.eval(() => connPts(page().items[0]).map(c => [c.x, c.y])), [[108, 100], [92, 100]]);
    t.eq(await wires(t), [[[108, 100], [108, 120], [100, 120], [100, 140]]], 'wire follows variant change');
    await t.key('m'); t.eq(await t.eval(() => variantOf(page().items[0])), 'F');
  },
  'snap toggle and grid size': async t => {
    await t.open();
    await t.key('g'); t.eq(await t.eval(() => [PREFS.snap, snap(13.3)]), [false, 13.25]);
    await t.key('g'); t.eq(await t.eval(() => snap(13.3)), 12);
    t.eq(await t.eval(() => { PREFS.gridSch = 8; const v = snap(13); PREFS.gridSch = 4; return v; }), 16);
  },
  'renumber devices in page order': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(200, 100); await t.click(100, 100); await t.key('Escape');
    t.eq(await t.eval(() => page().items.map(i => i.tag)), ['K1', 'K2']);
    await t.eval(() => renumberDlg()); await t.confirm();
    t.eq(await t.eval(() => page().items.map(i => [i.x, i.tag])), [[200, 'K2'], [100, 'K1']]);
  },
  'new page dialog: Enter creates the page': async t => {
    await t.open();
    await t.eval(() => addPage()); await t.page.fill('input[name="desc"]', 'Second'); await t.enter();
    await t.page.waitForTimeout(50);
    t.eq(await t.eval(() => P.pages.map(p => p.num + ' ' + p.desc)), ['1 Cover / main power', '2 Second']);
  },
  'project check reports unconnected points': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => checkProject());
    t.ok((await t.page.textContent('#dlgbody')).includes('point A1 not connected'));
  },
};
