// Page navigator tree, thumbnails, open page header, zoom window, layers.
const tree = t => t.eval(() => [...document.querySelectorAll('#tab-pages .navnode, #tab-pages .navitem')].map(e => (e.classList.contains('navnode') ? '+' : '') + e.textContent.replace(/[▾▸]/g, '').trim()));

export const tests = {
  'tree shows only the open page branch expanded': async t => {
    await t.open('#home');
    const rows = await tree(t);
    t.ok(rows.includes('+CKT 15'.replace('5', '1')) || rows.some(r => r.startsWith('+CKT 1')), 'circuit branch');
    t.ok(rows.some(r => r.startsWith('1')), 'open page leaf visible');
    t.ok(!rows.some(r => r.includes('Kitchen and dining outlets')), 'other circuits stay collapsed');
    await t.eval(() => goPage(P.pages.find(p => p.fn === 'CKT2').id));
    const r2 = await tree(t);
    t.ok(r2.some(r => r.includes('Kitchen and dining outlets')), 'new page branch opens');
    t.ok(!r2.some(r => r.includes('Kitchen and dining lights')), 'previous branch closes');
  },
  'branches toggle by click and the filter finds pages': async t => {
    await t.open('#home');
    await t.page.click('#tab-pages [data-navt="rep"]');
    t.ok(!(await tree(t)).some(r => r.includes('Bill of materials')), 'reports collapsed');
    await t.page.click('#tab-pages [data-navt="rep"]');
    t.ok((await tree(t)).some(r => r.includes('Bill of materials')), 'reports expanded');
    await t.page.fill('#navsearch', 'dryer');
    const rows = (await tree(t)).filter(r => !r.startsWith('+'));
    t.eq(rows.length, 1); t.ok(rows[0].includes('Dryer'));
    await t.page.click('#tab-pages .navitem');
    t.eq(await t.eval(() => page().fn), 'CKT4');
  },
  'tree has page icons and a right-click menu': async t => {
    await t.open('#home');
    t.eq(await t.eval(() => document.querySelectorAll('#tab-pages .navitem .nicon').length), await t.eval(() => document.querySelectorAll('#tab-pages .navitem').length));
    await t.page.click('#tab-pages .navitem.active', { button: 'right' });
    t.eq(await t.eval(() => [...document.querySelectorAll('#dropdown .dd')].map(d => d.textContent)), ['Open', 'Properties...', 'New page...', 'Duplicate', 'Delete']);
    const n = await t.eval(() => P.pages.length);
    await t.page.click('#dropdown [data-act="dupPage"]');
    t.eq(await t.eval(() => P.pages.length), n + 1);
  },
  'floor plan layers: switch legs and legend': async t => {
    await t.open('#home');
    await t.eval(() => goPage(P.pages.find(isFloor).id));
    const cnt = () => t.eval(() => [document.querySelectorAll('#content .leg').length, document.querySelectorAll('#content .legendbox').length]);
    const [l, g] = await cnt(); t.ok(l > 0 && g === 1);
    await t.eval(() => commit(() => { P.layers = { legs: { hide: true }, legend: { hide: true } }; }));
    t.eq(await cnt(), [0, 0]);
  },
  'open page header replaces page tabs': async t => {
    await t.open('#ind');
    t.eq(await t.eval(() => document.querySelectorAll('.ptab').length), 0);
    const h = () => t.eval(() => [$('.phname').textContent, $('.phpos').textContent]);
    const [n0, p0] = await h(); t.ok(/Sheet \d+ of \d+/.test(p0));
    await t.page.click('.phbtn[data-act="nextPage"]');
    const [n1] = await h(); t.ok(n1 !== n0, 'next page');
    await t.page.click('.phbtn[data-act="prevPage"]');
    t.eq((await h())[0], n0);
  },
  'thumbnails render every page and open it on click': async t => {
    await t.open('#home');
    await t.page.click('[data-navview="thumbs"]');
    await t.page.waitForFunction(() => [...document.querySelectorAll('#tab-pages [data-thumb]')].every(b => b.querySelector('svg')), null, { timeout: 5000 });
    t.eq(await t.eval(() => document.querySelectorAll('#tab-pages .thumb').length), await t.eval(() => allPages().length));
    t.eq(await t.eval(() => document.querySelectorAll('#tab-pages .thumb [data-id]').length), 0, 'thumbnails are not selectable');
    await t.page.click('#tab-pages .thumb >> nth=3');
    t.eq(await t.eval(() => allPages().indexOf(page())), 3);
    t.eq(await t.eval(() => PREFS.navView), 'thumbs');
    // edits show up in the thumbnail
    const before = await t.eval(() => $(`[data-thumb="${curId}"]`).innerHTML.length);
    await t.eval(() => { if (!isFloor(page()) && !page().report) commit(() => page().items.push({ id: 'zz', sym: 'text', x: 100, y: 100, text: 'THUMBTEST', size: 10 })); });
    await t.page.waitForFunction(b => $(`[data-thumb="${curId}"]`).innerHTML.length !== b, before, { timeout: 3000 });
  },
  'zoom window zooms to the dragged box and previous view returns': async t => {
    await t.open('#ind');
    const v0 = await t.eval(() => ({ ...view }));
    await t.key('z'); t.eq(await t.eval(() => mode), 'zoomwin');
    await t.drag(100, 60, 160, 100);
    const v1 = await t.eval(() => { const r = svg.getBoundingClientRect(); return { s: view.s, cx: view.x + r.width / view.s / 2, cy: view.y + r.height / view.s / 2, mode }; });
    t.ok(v1.s > v0.s * 3, 'zoomed in');
    t.ok(Math.abs(v1.cx - 130) < 1 && Math.abs(v1.cy - 80) < 1, 'centered on the box');
    t.eq(v1.mode, 'select');
    await t.key('Shift+Z');
    t.eq(await t.eval(() => view.s), v0.s);
  },
  'display layers hide and color on screen, and print separately': async t => {
    await t.open('#ind');
    const count = (sel, o) => t.eval(([s, o]) => { const d = document.createElement('div'); d.innerHTML = `<svg>${pageSVG(P.pages[1], o)}</svg>`; return d.querySelectorAll(s).length; }, [sel, o]);
    const wn = await count('.ly-wno', {});
    t.ok(wn > 0);
    await t.eval(() => commit(() => { P.layers = { wno: { hide: true }, xref: { noprint: true }, tag: { color: '#ff0000' } }; }));
    t.eq(await count('.ly-wno', {}), 0, 'wire numbers hidden on screen');
    t.eq(await count('.ly-wno', { print: true }), wn, 'still printed');
    t.ok(await count('.ly-xref', {}) > 0, 'cross-references on screen');
    t.eq(await count('.ly-xref', { print: true }), 0, 'cross-references left out of print');
    const fill = await t.eval(() => getComputedStyle(document.querySelector('#content .item:not(.sel) .ly-tag')).fill);
    t.eq(fill, 'rgb(255, 0, 0)');
    await t.key('Control+z');
    t.ok(await count('.ly-wno', {}) > 0, 'undo restores');
  },
  'user layers: active layer, hide, lock and delete': async t => {
    await t.open();
    await t.eval(() => commit(() => { P.ulayers = [{ id: 'La', name: 'Notes' }]; P.activeLayer = 'La'; }));
    await t.eval(() => setMode('place', 'coil')); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => commit(() => { P.activeLayer = ''; }));
    await t.eval(() => setMode('place', 'coil')); await t.click(160, 100); await t.key('Escape');
    t.eq(await t.eval(() => page().items.map(i => i.layer || '')), ['La', '']);
    await t.eval(() => commit(() => { P.ulayers[0].lock = true; }));
    await t.key('Escape'); await t.key('Control+a');
    t.eq(await t.eval(() => sel.size), 1, 'locked object not selected');
    await t.click(100, 100); t.eq(await t.eval(() => [...sel].map(id => findItem(id).it.x)), [], 'locked object not clickable');
    await t.eval(() => commit(() => { P.ulayers[0].lock = false; P.ulayers[0].hide = true; }));
    t.eq(await t.eval(() => document.querySelectorAll('#content [data-id]').length), 1, 'hidden layer not drawn');
    t.ok(await t.eval(() => IX.dev.size === 2), 'hidden objects still count as devices');
    await t.eval(() => layersDlg());
    await t.page.click('[data-lydel="La"]');
    await t.page.click('#dlgbtns .primary');
    t.eq(await t.eval(() => [P.ulayers.length, page().items.map(i => i.layer || '')]), [0, ['', '']]);
  },
  'layer is set from the properties panel for a multi-selection': async t => {
    await t.open();
    await t.eval(() => commit(() => { P.ulayers = [{ id: 'Lb', name: 'Field' }]; }));
    await t.eval(() => setMode('place', 'coil')); await t.click(100, 100); await t.click(140, 100); await t.key('Escape');
    await t.key('Control+a');
    await t.page.selectOption('[data-k="ly.set"]', 'Lb');
    t.eq(await t.eval(() => page().items.map(i => i.layer)), ['Lb', 'Lb']);
  },
};
