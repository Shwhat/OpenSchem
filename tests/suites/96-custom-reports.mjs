// Report settings (on or off, page order, report order) and custom reports (row picking, filters, edits, live and locked).
const cr = t => t.eval(() => clone(customOf(page())));
const shownRows = t => t.eval(() => REPORTS.filter(r => r.custom === page().custom).flatMap(r => r.rows).filter(r => !r.full).map(r => r.cells.map(c => c.join(' '))));
const setProp = async (t, k, v) => { const sel = `#props [data-ck="${k}"]`; const tag = await t.eval(s => $(s).tagName + ':' + $(s).type, sel); if (tag.startsWith('SELECT')) await t.page.selectOption(sel, v); else if (tag.endsWith('checkbox')) { if (await t.eval(s => $(s).checked, sel) !== v) await t.page.click(sel); } else { await t.page.fill(sel, v); await t.page.press(sel, 'Tab'); } await t.page.waitForTimeout(30); };
const cellAt = (t, key, col) => t.eval(([k, c]) => { const el = [...document.querySelectorAll('#content [data-ccell]')].find(e => { const [, kk, cc] = e.dataset.ccell.split('|'); return kk === k && +cc === c; }); if (!el) return null; const b = el.getBoundingClientRect(); return [b.left + 2, b.top + b.height / 2]; }, [key, col]);

export const tests = {
  'reports can be turned off and pages reordered in Project properties': async t => {
    await t.open('#demo');
    const kinds = () => t.eval(() => allPages().map(p => p.report ? (p.custom ? 'custom' : p.report) : p.kind || 'sch').filter((k, i, a) => a[i - 1] !== k));
    t.eq((await kinds()).slice(0, 3), ['cover', 'toc', 'sch']);
    await t.eval(() => projectProps());
    // untick the bill of materials, move Reports to the top of the page order, put the BOM... (off) and connection list first among reports
    await t.page.click('[data-repon="bom"]');
    const up = async (list, key, n) => { for (let i = 0; i < n; i++) { const idx = await t.eval(([l, k]) => [...$(`[data-ordlist="${l}"]`).children].findIndex(e => e.dataset.ord === l + ':' + k), [list, key]); if (idx <= 0) break; await t.page.click(`[data-ordlist="${list}"] [data-ordmv="${list}:${idx}:-1"]`); } };
    await up('sec', 'rep', 10);
    await up('rep', 'conn', 10);
    await t.confirm();
    const k = await kinds();
    t.eq(k[0], 'conn', 'reports first, connection list first among them: ' + k.join(','));
    t.ok(!k.includes('bom') && !(await t.eval(() => REPORTS.some(r => r.report === 'bom' && !r.custom))), 'BOM gone from pages and reports (custom copies stay)');
    t.ok(!(await t.eval(() => [...document.querySelectorAll('#tab-pages .navitem')].some(e => /Bill of materials/.test(e.textContent)))), 'BOM gone from the tree');
    t.eq(await t.eval(() => $('#tab-pages .navnode.top').textContent.includes('Reports')), true, 'tree starts with Reports');
    // sheet numbers follow the order: the first report page is sheet 1
    t.ok(await t.eval(() => { const p = allPages()[0]; return pageSVG(p).includes(`1 of ${allPages().length}`); }), 'sheet 1 of N on the first page');
    // the table of contents lists pages in the same order
    t.eq(await t.eval(() => REPORTS.find(r => r.report === 'toc' && !r.custom).rows[0].cells[0][0]), await t.eval(() => pageName(allPages()[0])));
    // printing uses the order
    await t.eval(() => { window.print = () => {}; printAll(); }); await t.page.waitForTimeout(60);
    t.eq(await t.eval(() => $('#printarea').children.length), await t.eval(() => allPages().length));
    // turning a report back on brings it back
    await t.eval(() => projectProps()); await t.page.click('[data-repon="bom"]'); await t.confirm();
    t.ok(await t.eval(() => REPORTS.some(r => r.report === 'bom' && !r.custom)));
    // saved in the file
    const j = JSON.parse(await t.eval(() => projectJSON()));
    t.eq([j.order.sections[0], j.order.reports[0], j.repOff.bom], ['rep', 'conn', undefined]);
  },
  'older files: cover and contents switches carry over': async t => {
    await t.open();
    const r = await t.eval(() => { const o = JSON.parse(projectJSON()); o.ver = 3; o.cover = false; delete o.repOff; loadProject(o, 'x.osp'); return [P.repOff.cover, 'cover' in P, REPORTS.some(r => r.report === 'cover'), REPORTS.some(r => r.report === 'toc')]; });
    t.eq(r, [true, false, false, true]);
  },
  'custom bill of materials: filters, ticks, live updates, edits with change markers': async t => {
    await t.open('#demo');
    // create from the New page menu
    await t.page.click('[data-newpagemenu]'); await t.page.click('#dropdown [data-act="newCustomReport"]');
    await t.page.selectOption('#dlgbody select[name="base"]', 'bom'); await t.page.fill('#dlgbody input[name="title"]', 'Electrician list'); await t.confirm();
    t.eq(await t.eval(() => [page().custom ? 'custom' : '', page().title]), ['custom', 'Electrician list']);
    t.ok(await t.eval(() => [...document.querySelectorAll('#tab-pages .navnode')].some(e => /Custom reports/.test(e.textContent))), 'Custom reports branch');
    const all = await t.eval(() => REPORTS.filter(r => r.report === 'bom' && !r.custom).flatMap(r => r.rows).filter(r => r.cls !== 'grp').length);
    t.eq((await shownRows(t)).filter(r => r[4] !== 'Total').length, all, 'starts with every row');
    // a filter on the manufacturer column
    const mfr = await t.eval(() => bomRows().find(r => r.mfr).mfr);
    await t.page.click('#props [data-cb="fadd"]');
    await setProp(t, 'f.0.col', '3'); await setProp(t, 'f.0.value', mfr);
    let rows = await shownRows(t);
    t.ok(rows.length > 0 && rows.filter(r => r[4] !== 'Total').every(r => r[3] === mfr), 'only that manufacturer');
    // tick one more row by hand
    const other = await t.eval(m => bomRows().find(r => r.mfr !== m).key, mfr);
    await setProp(t, 'row.' + other, true);
    t.ok((await cr(t)).inc.includes(other));
    rows = await shownRows(t); t.ok(rows.some(r => r[3] !== mfr && r[4] !== 'Total'), 'ticked row added');
    // live: another device that gets a part number from that manufacturer joins automatically
    const n0 = (await shownRows(t)).length;
    await t.eval(m => { const pn = Object.keys(P.parts).find(k => P.parts[k].mfr === m) || bomRows().find(r => r.mfr === m).part; const it = [...allItems()].find(i => i.tag && SYM[i.sym] && SYM[i.sym].prefix && !i.part && SYM[i.sym].role === 'main' && i.sym !== 'term'); commit(() => { it.part = 'ZZ-NEW-1'; P.parts['ZZ-NEW-1'] = Object.assign({}, P.parts[pn] || {}, { mfr: m }); }); }, mfr);
    t.eq((await shownRows(t)).length, n0 + 1, 'new matching row appeared');
    // edit a cell: click it, type in Properties
    const key = (await t.eval(() => REPORTS.find(r => r.custom === page().custom).rows[0].key));
    const p = await cellAt(t, key, 4); await t.page.mouse.click(...p);
    t.eq(await t.eval(() => CUSSEL && [CUSSEL.key, CUSSEL.col]), [key, 4]);
    await setProp(t, 'cell', 'Edited description');
    t.eq((await cr(t)).edits[key]['4'].v, 'Edited description');
    t.ok(await t.eval(k => REPORTS.find(r => r.custom === page().custom).rows.find(r => r.key === k).cells[4].join(' ') === 'Edited description', key), 'shown on the page');
    // change the project value under it: marker appears, accept takes the new value
    await t.eval(k => { const pg = page(); const cr = customOf(pg); const e = cr.edits[k][4]; e.src = 'something older'; render(); }, key);
    t.ok(await t.eval(() => document.querySelectorAll('#content .cmark').length === 1), 'change marker');
    await t.page.mouse.click(...(await cellAt(t, key, 4)));
    t.ok(await t.eval(() => !!$('#props [data-cb="accept"]')), 'Use the new value offered');
    await t.page.click('#props [data-cb="accept"]');
    t.eq((await cr(t)).edits[key], undefined);
    t.eq(await t.eval(() => document.querySelectorAll('#content .cmark').length), 0);
    // hide and rename columns, notes, an added row
    await setProp(t, 'show.5', false); await setProp(t, 'head.4', 'What it is');
    t.ok(await t.eval(() => { const r = REPORTS.find(r => r.custom === page().custom); return r.cols.length === 8 && r.cols.some(c => c.h === 'What it is'); }), 'column hidden and renamed');
    await setProp(t, 'notes', 'Bring a ladder');
    t.ok(await t.eval(() => REPORTS.filter(r => r.custom === page().custom).pop().rows.some(r => r.full && r.cells[0].join(' ') === 'Bring a ladder')), 'notes printed');
    await t.page.click('#props [data-cb="addrow"]');
    await setProp(t, 'cell', 'Extra wire nuts');
    t.ok(await t.eval(() => REPORTS.filter(r => r.custom === page().custom).flatMap(r => r.rows).some(r => r.cells.some(c => c.join(' ') === 'Extra wire nuts'))), 'added row');
    // the PDF and print include it
    t.ok(await t.eval(() => allPages().some(p => p.custom)));
  },
  'locked custom reports stay frozen until refreshed': async t => {
    await t.open('#home');
    await t.eval(() => makeCustomReport('panel', 'Kitchen breakers', 'none'));
    t.eq((await shownRows(t)).length, 0, 'start with no rows');
    const keys = await t.eval(() => customSource('panel').rows.filter(r => !r.group).slice(0, 2).map(r => r.key));
    for (const k of keys) await setProp(t, 'row.' + k, true);
    t.eq((await shownRows(t)).filter(r => !/Total/.test(r[6])).length, 2, 'just the ticked breakers');
    // lock, then change the project: the report keeps the old value
    const desc0 = await t.eval(k => customSource('panel').rows.find(r => r.key === k).cells[6], keys[0]);
    await setProp(t, 'mode', 'locked');
    t.ok(await t.eval(() => !!customOf(page()).frozen));
    await t.eval(k => commit(() => { itemById(k).desc = 'Changed after lock'; }), keys[0]);
    const cell = () => t.eval(k => REPORTS.filter(r => r.custom === page().custom).flatMap(r => r.rows).find(r => r.key === k).cells[6].join(' '), keys[0]);
    t.eq(await cell(), desc0, 'frozen');
    // unlocking keeps the frozen values until Refresh
    await setProp(t, 'mode', 'live');
    t.eq(await cell(), desc0, 'still frozen after unlocking');
    await t.page.click('#props [data-cb="refresh"]');
    t.eq(await cell(), 'Changed after lock', 'refresh brings in the project');
    t.eq(await t.eval(() => customOf(page()).frozen), undefined);
  },
  'custom cover sheet and contents, make custom copy, delete': async t => {
    await t.open('#demo');
    await t.eval(() => goPage(REPORTS.find(r => r.report === 'cover').id));
    await t.page.click('#props [data-act="makeCustomCopy"]');
    t.eq(await t.eval(() => [page().custom ? 1 : 0, page().report]), [1, 'cover']);
    await t.page.mouse.click(...(await cellAt(t, 'f:title', 1)));
    await setProp(t, 'cell', 'Pump station handover');
    t.ok(await t.eval(() => pageSVG(page()).includes('Pump station handover')), 'edited title on the cover');
    t.ok(await t.eval(() => !pageSVG(REPORTS.find(r => r.report === 'cover' && !r.custom)).includes('Pump station handover')), 'generated cover unchanged');
    // a custom table of contents follows the page order
    await t.eval(() => makeCustomReport('toc', 'Short contents', 'all'));
    t.eq(await t.eval(() => REPORTS.find(r => r.custom === page().custom).rows.length > 3), true);
    // delete from the page tree menu
    const n = await t.eval(() => customs().length);
    await t.eval(() => { window.confirm = () => true; delPage(); });
    t.eq(await t.eval(() => customs().length), n - 1);
  },
};
