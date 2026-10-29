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
  'symbol editor works like a page: grips, snap, align, window select, move, undo, keys': async t => {
    await t.open();
    await t.eval(() => newSymbol());
    // editor point -> screen point
    const at = (x, y) => t.eval(([x, y]) => { const cv = $('#secv'); const pt = cv.createSVGPoint(); pt.x = x; pt.y = y; const q = pt.matrixTransform(cv.getScreenCTM()); return [q.x, q.y]; }, [x, y]);
    const drag = async (a, b, opt = {}) => { const p = await at(...a), q = await at(...b); if (opt.shift) await t.page.keyboard.down('Shift'); await t.page.mouse.move(...p); await t.page.mouse.down(); await t.page.mouse.move(q[0], q[1], { steps: 6 }); await t.page.mouse.up(); if (opt.shift) await t.page.keyboard.up('Shift'); };
    const shapes = () => t.eval(() => clone(SE.def.shapes));
    // the starting symbol: rect -4..4, lines 0,-8..-4 and 0,4..8
    // click the rectangle edge to select it, then drag its bottom right grip to (6, 5.5)
    const e = await at(4, 0); await t.page.mouse.click(...e);
    t.eq(await t.eval(() => SE.sel), ['s0']);
    await drag([4, 4], [6.1, 5.4]);
    t.eq((await shapes())[0], { t: 'rect', x: -4, y: -4, w: 10, h: 9.5 }, 'grip reshapes on the 0.5 mm grid');
    // exact values typed in the Selected box
    await t.page.fill('[data-se="g.w"]', '8'); await t.page.press('[data-se="g.w"]', 'Tab');
    t.eq((await shapes())[0].w, 8);
    // undo and redo with the keyboard (focus on the canvas)
    await t.page.focus('#secv'); await t.key('Control+z');
    t.eq((await shapes())[0].w, 10, 'undo');
    await t.key('Control+y'); t.eq((await shapes())[0].w, 8, 'redo');
    // snap off: grips land where you drop them; G toggles it back
    await t.key('g'); t.eq(await t.eval(() => SE.snap), false);
    const ln = await at(0, -6); await t.page.mouse.click(...ln);
    await drag([0, -8], [1.23, -8.37]);
    { const l = (await shapes())[1]; t.ok(Math.abs(l.x1 - 1.23) < 0.08 && Math.abs(l.y1 + 8.37) < 0.08 && (l.x1 * 2) % 1 !== 0, `free point ${l.x1},${l.y1}`); }
    // Shift+G aligns the selection to the grid (snap off does not matter for align)
    await t.key('Shift+G'); t.eq([(await shapes())[1].x1, (await shapes())[1].y1], [1, -8.5]);
    await t.key('g'); t.eq(await t.eval(() => SE.snap), true);
    // grid size 2 mm
    await t.page.selectOption('[data-se="v.grid"]', '2'); t.eq(await t.eval(() => SE.grid), 2);
    // window select (left to right, fully inside) picks the bottom line and its connection point
    await drag([-2, 3], [2, 10]);
    t.eq((await t.eval(() => SE.sel)).sort(), ['c1', 's2']);
    // moving a selection with a connection point moves in 4 mm steps
    await drag([0, 6], [3.1, 6.2]);
    t.eq([(await shapes())[2].x1, await t.eval(() => SE.def.conns[1])], [4, [4, 8, '2']]);
    // arrow keys nudge, Delete removes, Ctrl+D duplicates, R rotates about the selection, Escape clears
    await t.page.focus('#secv'); await t.key('ArrowLeft');
    t.eq(await t.eval(() => SE.def.conns[1]), [0, 8, '2']);
    await t.key('Control+d'); t.eq(await t.eval(() => [SE.def.shapes.length, SE.def.conns.length, SE.sel.length]), [4, 3, 2]);
    await t.key('Delete'); t.eq(await t.eval(() => [SE.def.shapes.length, SE.def.conns.length]), [3, 2]);
    await t.key('Control+a'); t.eq(await t.eval(() => SE.sel.length), 5);
    await t.key('r'); t.eq(await t.eval(() => SE.def.conns.map(c => [c[0], c[1]])), [[8, 0], [-8, 0]], 'rotated about the insertion point');
    await t.key('Escape'); t.eq(await t.eval(() => [SE.sel.length, $('#dlg').open]), [0, true], 'Escape clears the selection first');
    // crossing window (right to left) picks anything it touches
    await drag([-2, 7], [-3, 3]);
    t.ok((await t.eval(() => SE.sel)).includes('s0'), 'crossing touches the rectangle');
    // saving still works
    await t.confirm();
    t.ok(await t.eval(() => LIB.symbols.length === 1 && LIB.symbols[0].conns.length === 2));
  },
  'customize ribbon and keep it after restart': async t => {
    await t.open();
    await t.eval(() => customizeRibbon());
    await t.page.click('[data-czb="t:add"]'); await t.page.click('[data-czb="g:add"]');
    await t.page.fill('#czq', 'renumber'); await t.page.click('[data-czadd="renumberDlg"]');
    await t.confirm();
    await t.open();
    t.eq(await t.eval(() => [...document.querySelectorAll('.rtab')].map(x => x.textContent)), ['Home', 'Insert', 'Pneumatics', 'View', 'Project', 'X']);
  },
  'a new program version resets the saved ribbon so new buttons show up': async t => {
    await t.open();
    await t.eval(() => customizeRibbon());
    await t.page.click('[data-czb="t:add"]'); await t.page.click('[data-czb="g:add"]');
    await t.page.fill('#czq', 'renumber'); await t.page.click('[data-czadd="renumberDlg"]');
    await t.confirm();
    await t.open();
    t.ok((await t.eval(() => [...document.querySelectorAll('.rtab')].map(x => x.textContent))).includes('X'), 'same version keeps the saved ribbon');
    await t.eval(() => { PREFS.appVersion = '1.0.0'; savePrefs(); });
    await t.open();
    t.eq(await t.eval(() => [...document.querySelectorAll('.rtab')].map(x => x.textContent)), ['Home', 'Insert', 'Pneumatics', 'View', 'Project']);
    t.eq(await t.eval(() => [PREFS.ribbon, PREFS.appVersion === APP_VERSION]), [null, true]);
    t.ok(await t.eval(() => DEFAULT_RIBBON.find(x => x.id === 'fmodify').groups.some(g => g.items.includes('alignToGrid'))), 'Align to grid is on the Modify tab');
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
