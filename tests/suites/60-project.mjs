// Project-level features: cables, revisions, to-dos, theme, printing, PDF, file format.
import fs from 'fs';
import path from 'path';

export const tests = {
  'cables: type from crossed wires, reports and BOM': async t => {
    await t.open('#home'); await t.goPage('CKT 2/1');
    await t.key('c'); await t.drag(64, 150, 128, 151);
    t.eq(await t.eval(() => { const c = page().cables[0]; return [c.tag, c.ctype, cableCrossings(page(), c).length]; }), ['W1', '12/1', 1]);
    await t.page.fill('[data-k="cab.len"]', '18 ft'); await t.page.press('[data-k="cab.len"]', 'Tab');
    t.ok(await t.eval(() => REPORTS.some(r => r.report === 'cables') && REPORTS.some(r => r.report === 'cabdiag')));
    t.ok(await t.eval(() => bomRows().some(r => r.desc === 'Cable, 12/1' && r.tags[0] === 'Cable 1 (18 ft)')));
  },
  'revisions mark changed pages': async t => {
    await t.open('#home'); await t.goPage('CKT 4/1');
    await t.eval(() => revisionsDlg()); await t.page.click('[data-rev="new"]');
    await t.page.fill('#dlgbody input[name="desc"]', 'Change'); await t.enter();
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.page.fill('[data-k="it.desc"]', 'Edited'); await t.page.press('[data-k="it.desc"]', 'Tab');
    t.eq(await t.eval(() => P.pages.filter(p => p.revs && p.revs.length).map(p => pageName(p) + ':' + p.revs.join(''))), ['CKT 4/1:A']);
    t.ok(await t.eval(() => REPORTS.some(r => r.report === 'rev')));
  },
  'to-dos: add, link, flag, complete, undo': async t => {
    await t.open('#home'); await t.goPage('CKT 2/1');
    await t.page.click('[data-tab="todo"]');
    await t.page.fill('#tdnew', 'Verify outlet in garage'); await t.page.press('#tdnew', 'Enter');
    await t.eval(() => { sel = new Set([page().items.find(i => i.tag === 'OUT1').id]); render(); });
    await t.page.click('#props [data-tdact="link"]');
    await t.page.fill('#dlgbody input[name="text"]', 'Test GFCI trip'); await t.enter();
    t.eq(await t.eval(() => P.todos.map(x => [x.text, todoLinkLabel(x)])), [['Verify outlet in garage', ''], ['Test GFCI trip', 'CKT 2 · Kitchen · Outlet 1']]);
    t.eq(await t.eval(() => document.querySelectorAll('#content .tdflag').length), 1);
    await t.page.click('[data-tdchk] >> nth=0');
    t.eq(await t.eval(() => P.todos.filter(x => x.done).length), 1);
    await t.key('Control+z'); t.eq(await t.eval(() => P.todos.filter(x => x.done).length), 0);
  },
  'dark theme and sheet, while printing stays white': async t => {
    await t.open('#home');
    await t.eval(() => { toggleTheme(); toggleSheet(); });
    t.eq(await t.eval(() => [document.documentElement.dataset.theme, document.documentElement.dataset.sheet]), ['dark', 'dark']);
    await t.eval(() => { window.print = () => {}; printAll(); });
    t.eq(await t.eval(() => [document.querySelectorAll('#printarea svg').length, document.querySelectorAll('#printarea .tdflag').length]), [await t.eval(() => allPages().length), 0]);
  },
  'PDF export: pages, bookmarks and links': async t => {
    await t.open('#home');
    const [dl] = await Promise.all([t.page.waitForEvent('download', { timeout: 60000 }), t.eval(() => exportPDF())]);
    const file = path.join(t.root, 'build', 'test-export.pdf'); await dl.saveAs(file);
    const pdf = fs.readFileSync(file, 'latin1');
    const pages = await t.eval(() => allPages().length);
    t.eq((pdf.match(/\/Type \/Page[\s/]/g) || []).length, pages, 'page count');
    t.ok((pdf.match(/\/Subtype \/Link/g) || []).length > 20, 'clickable links');
    t.ok(pdf.includes('/Outlines'), 'bookmarks');
  },
  'file format: version stamp, old files upgrade, newer files warn': async t => {
    await t.open('#home');
    const json = JSON.parse(await t.eval(() => projectJSON()));
    t.eq([json.ver, json.appVersion], await t.eval(() => [FORMAT_VERSION, APP_VERSION]));
    const old = { app: 'OpenSchem', ver: 1, name: 'Old', pages: [{ id: 'a', fn: '', loc: '', num: '1', items: [{ id: 'i', sym: 'coil', x: 100, y: 100, tag: 'K1', role: 'main', cl: ['A1', 'A2'] }] }] };
    await t.eval(o => loadProject(o, 'old.osp'), old);
    t.eq(await t.eval(() => [P.ver, P.pages[0].wires.length, P.pages[0].cables.length, Array.isArray(P.todos)]), [4, 0, 0, true]);
    let warned = '';
    t.page.removeAllListeners('dialog');
    t.page.on('dialog', d => { warned = d.message(); d.dismiss(); });
    await t.eval(o => loadProject(Object.assign(o, { ver: 99, appVersion: '9.0.0', name: 'Future' }), 'f.osp'), old);
    t.ok(warned.includes('newer version'), 'warns on newer file');
    t.eq(await t.eval(() => P.name), 'Old', 'declining keeps the current project');
  },
};
