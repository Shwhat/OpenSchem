// Parts database, BOM cost, load calculation, voltage drop, breaker labels.
export const tests = {
  'parts: CSV import, picker fills device, BOM price and total, project keeps a copy': async t => {
    await t.open('#ind');
    await t.eval(() => { PARTS = []; importPartsCSV('Part number;Manufacturer;Description;Price;Category\nDF101;Acme;Fuse 10A;4.50;Protection\nX9;Acme;Relay;12;Relays\n'); saveParts(); render(); });
    t.eq(await t.eval(() => PARTS.map(p => [p.pn, p.mfr, p.price])), [['DF101', 'Acme', '4.50'], ['X9', 'Acme', '12']]);
    const bom = await t.eval(() => bomRows().filter(r => r.part === 'DF101').map(r => [r.qty, r.mfr, r.price, r.total]));
    t.eq(bom, [[2, 'Acme', 4.5, 9]]);
    const last = await t.eval(() => { const r = REPORTS.filter(r => r.report === 'bom').pop(); return r.rows[r.rows.length - 1].cells.map(c => c.join(' ')); });
    t.ok(last[4].startsWith('Total') && last[8] === '$9.00', 'total row: ' + last.join('|'));
    // pick a part for a device from the dialog
    await t.eval(() => { const it = [...allItems()].find(i => i.role === 'main' && !i.part && SYM[i.sym].prefix && i.sym !== 'term'); goPage(findItem(it.id).pg.id); sel = new Set([it.id]); render(); pickPartFor(); });
    await t.page.click('[data-pick="X9"]');
    t.eq(await t.eval(() => findItem([...sel][0]).it.part), 'X9');
    const saved = await t.eval(() => JSON.parse(projectJSON()).parts);
    t.eq(Object.keys(saved).sort(), ['DF101', 'X9']);
    // a project opened without the library entry still knows the part
    await t.eval(() => { PARTS = []; });
    t.eq(await t.eval(() => partOf('X9').mfr), 'Acme');
  },
  'parts manager: add, edit, delete': async t => {
    await t.open();
    await t.eval(() => { PARTS = []; partsDlg(); });
    await t.page.click('[data-padd]'); await t.page.waitForTimeout(30);
    await t.page.fill('input[name="pn"]', 'P1'); await t.page.fill('input[name="price"]', '$3.25'); await t.confirm();
    t.eq(await t.eval(() => PARTS), [{ pn: 'P1', price: '3.25' }]);
    await t.eval(() => partsDlg()); await t.page.click('[data-pedit="P1"]'); await t.page.waitForTimeout(30);
    await t.page.fill('input[name="mfr"]', 'Brand'); await t.confirm();
    t.eq(await t.eval(() => PARTS[0].mfr), 'Brand');
    await t.eval(() => partsDlg()); await t.page.click('[data-pdel="P1"]');
    t.eq(await t.eval(() => PARTS.length), 0);
  },
  'load calculation, 80% warning and voltage drop': async t => {
    await t.open('#home');
    const ci = () => t.eval(() => { const b = [...allItems()].find(i => i.tag === 'BRK2'); const c = circuitInfo(b); return [Math.round(c.load), Math.round(c.pct * 10) / 10, c.vd == null ? null : Math.round(c.vd * 100) / 100]; });
    t.eq(await ci(), [540, 22.5, null]);
    await t.eval(() => commit(() => { [...allItems()].find(i => i.fn === 'CKT2' && i.sym === 'rout').va = '1800'; }));
    t.eq((await ci())[0], 2160);
    await t.eval(() => commit(() => { [...allItems()].find(i => i.tag === 'BRK2').run = '100 ft'; }));
    // 2160 VA / 120 V = 18 A; 2*12.9*18*100/6530 (12 AWG) = 7.11 V = 5.93 %
    t.eq((await ci())[2], 5.93);
    await t.eval(() => checkProject());
    const txt = await t.page.textContent('#dlgbody');
    t.ok(/above 80%/.test(txt), 'load warning'); t.ok(/voltage drop 5\.9%/.test(txt), 'drop warning');
  },
  'load defaults are editable and parts supply watts': async t => {
    await t.open('#home');
    await t.eval(() => commit(() => { S().loadDefaults = { rlgt: 100 }; }));
    t.eq(await t.eval(() => Math.round(circuitInfo([...allItems()].find(i => i.tag === 'BRK1')).load)), 200);
    await t.eval(() => { PARTS = [{ pn: 'LED9', watts: '9' }]; commit(() => { for (const i of allItems()) if (i.fn === 'CKT1' && i.sym === 'rlgt') applyPart(i, 'LED9'); }); });
    t.eq(await t.eval(() => Math.round(circuitInfo([...allItems()].find(i => i.tag === 'BRK1')).load)), 18);
  },
  'breaker labels: two-column panel directory': async t => {
    await t.open('#home');
    const d = await t.eval(() => { buildIndex(); const pn = [...panelRows().keys()][0]; const r = panelDirectorySVG(pn, 'letter'); const el = document.createElement('div'); el.innerHTML = r.svg; return { W: r.W, texts: [...el.querySelectorAll('text')].map(x => x.textContent) }; });
    t.eq(d.W, 215.9);
    t.ok(d.texts.includes('Kitchen and dining lights') && d.texts.includes('Dryer'), 'circuit names');
    t.ok(d.texts.includes('(2-pole, with 5)'), '2-pole continues two slots down');
    t.ok(d.texts.includes('20') && d.texts.includes('19'), 'at least 20 spaces numbered');
  },
};
