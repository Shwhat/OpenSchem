// Symbol editor, symbol library, ribbon customizing, macros, preferences.
export const tests = {
  'symbols tab search and collapsible categories': async t => {
    await t.open();
    await t.page.click('[data-tab="symbols"]');
    await t.page.fill('#symsearch', 'gfci'); await t.page.waitForTimeout(30);
    t.eq(await t.eval(() => [...document.querySelectorAll('#tab-symbols .symcard span')].map(s => s.textContent)), ['GFCI breaker', 'GFCI outlet']);
    await t.page.fill('#symsearch', ''); await t.page.click('[data-symcat="Protection"]');
    t.eq(await t.eval(() => PREFS.symOpen.Protection), false);
  },
  'copy a built-in symbol, edit it, save, place it, and carry it in the project': async t => {
    await t.open();
    await t.eval(() => copySymbol('no'));
    t.eq(await t.eval(() => SE.def.shapes.map(s => s.t)), ['line', 'line', 'line']);
    await t.page.click('[data-setool="conn"]');
    const p = await t.eval(() => { const r = $('#secv').getBoundingClientRect(); const pt = $('#secv').createSVGPoint(); pt.x = 8; pt.y = 0; const m = $('#secv').getScreenCTM(); const q = pt.matrixTransform(m); return [q.x, q.y]; });
    await t.page.mouse.click(p[0], p[1]);
    t.eq(await t.eval(() => SE.def.conns.map(c => [c[0], c[1]])), [[0, -8], [0, 8], [8, 0]]);
    await t.page.fill('[data-se="d.name"]', 'My contact'); await t.page.press('[data-se="d.name"]', 'Tab');
    await t.confirm();
    const key = await t.eval(() => LIB.symbols[0].key);
    await t.eval(k => setMode('place', k), key); await t.click(160, 100); await t.key('Escape');
    const json = await t.eval(() => projectJSON());
    t.eq(Object.keys(JSON.parse(json).userSyms), [key]);
    // a fresh program without the library still opens the project
    await t.eval(() => localStorage.clear()); await t.open();
    t.eq(await t.eval(() => LIB.symbols.length), 0);
    await t.eval(j => loadProject(JSON.parse(j), ''), json);
    t.ok(await t.eval(k => !!SYM[k], key), 'symbol registered from project');
  },
  'customize ribbon and keep it after restart': async t => {
    await t.open();
    await t.eval(() => customizeRibbon());
    await t.page.click('[data-czb="t:add"]'); await t.page.click('[data-czb="g:add"]');
    await t.page.fill('#czq', 'renumber'); await t.page.click('[data-czadd="renumberDlg"]');
    await t.confirm();
    await t.open();
    t.eq(await t.eval(() => [...document.querySelectorAll('.rtab')].map(x => x.textContent)), ['Home', 'Insert', 'View', 'Project', 'X']);
  },
  'macros: save a selection and insert it with new tags': async t => {
    await t.open('#home'); await t.goPage('CKT 1/1');
    await t.eval(() => { const pg = page(); sel = new Set([...pg.items.filter(i => ['SWT1', 'LGT1'].includes(i.tag)).map(i => i.id), ...pg.wires.filter(w => w.pts.every(q => q[0] === 80 && q[1] >= 104 && q[1] <= 128)).map(w => w.id)]); render(); saveMacro(); });
    await t.page.fill('#dlgbody input[name="name"]', 'Switched light'); await t.enter();
    t.eq(await t.eval(() => LIB.macros.map(m => [m.name, m.items.length, m.wires.length])), [['Switched light', 2, 1]]);
    await t.goPage('CKT 4/1');
    await t.eval(() => insertMacroDlg()); await t.page.click('[data-mac^="ins:"]');
    await t.click(200, 80); await t.key('Escape');
    t.eq(await t.eval(() => page().items.filter(i => ['rswt', 'rlgt'].includes(i.sym)).map(i => [i.tag, i.fn])), [['SWT6', 'CKT4'], ['LGT4', 'CKT4']]);
  },
};
