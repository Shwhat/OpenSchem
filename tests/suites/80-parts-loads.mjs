// Parts database, BOM cost, load calculation, voltage drop, breaker labels.
export const tests = {
  'parts: CSV import, picker fills device, BOM price and total, project keeps a copy': async t => {
    await t.open('#ind');
    const r = await t.eval(async () => { PARTS = []; const r = await importPartsCSV('Manufacturer;Order number;Description;Price;Category\nSCH;DF101;Fuse holder;4.50;Protection\nAcme Controls;X9;Relay;12;Relays\n'); saveParts(); render(); return r; });
    t.eq([r.added, r.newMfrs.length], [2, 1]);
    const acme = await t.eval(() => MFRS.find(m => m.name === 'Acme Controls').code); t.eq(acme, 'ACM', 'a new manufacturer gets a code made from its name');
    t.eq(await t.eval(() => PARTS.map(p => [p.pn, p.mfr, p.ord, p.price])), [['SCH.DF101', 'SCH', 'DF101', '4.5'], ['ACM.X9', 'ACM', 'X9', '12']]);
    const bom = await t.eval(() => bomRows().filter(r => r.part === 'SCH.DF101').map(r => [r.qty, r.mfr, r.price, r.total]));
    t.eq(bom, [[2, 'SCH', 4.5, 9]]);
    const last = await t.eval(() => { const r = REPORTS.filter(r => r.report === 'bom').pop(); return r.rows[r.rows.length - 1].cells.map(c => c.join(' ')); });
    t.ok(last[4].startsWith('Total') && /\$\d/.test(last[8]), 'total row: ' + last.join('|'));
    // pick a part for a device from the dialog
    await t.eval(() => { const it = [...allItems()].find(i => i.role === 'main' && !i.part && SYM[i.sym].prefix && i.sym !== 'term'); goPage(findItem(it.id).pg.id); sel = new Set([it.id]); render(); pickPartFor(); });
    await t.page.click('[data-pick="ACM.X9"]');
    t.eq(await t.eval(() => findItem([...sel][0]).it.part), 'ACM.X9');
    const saved = await t.eval(() => JSON.parse(projectJSON()).parts);
    t.ok(saved['SCH.DF101'] && saved['ACM.X9'], Object.keys(saved).join(','));
    // a project opened without the library entry still knows the part
    await t.eval(() => { PARTS = []; });
    t.eq(await t.eval(() => partOf('ACM.X9').mfr), 'ACM');
  },
  'parts import: duplicates are skipped or replaced after one question': async t => {
    await t.open();
    await t.eval(() => { PARTS = [{ pn: 'PXC.3031212', mfr: 'PXC', ord: '3031212', desc: 'Old text' }]; });
    const csv = 'Manufacturer,Order number,Type number,Description\nPhoenix Contact,3031212,ST 2.5,Feed-through terminal\nPXC,3031238,ST 2.5-PE,Ground terminal\n';
    let done = t.eval(c => importPartsCSV(c), csv);
    await t.page.waitForSelector('#dlgbtns [data-v="skip"]'); t.ok(/1 of the 2/.test(await t.page.textContent('#dlgbody')));
    await t.page.click('#dlgbtns [data-v="skip"]'); let r = await done;
    t.eq([r.added, r.skipped, await t.eval(() => PARTS.find(p => p.pn === 'PXC.3031212').desc)], [1, 1, 'Old text']);
    done = t.eval(c => importPartsCSV(c), csv); await t.page.waitForSelector('#dlgbtns [data-v="replace"]'); await t.page.click('#dlgbtns [data-v="replace"]'); r = await done;
    t.eq([r.replaced, await t.eval(() => PARTS.find(p => p.pn === 'PXC.3031212').type)], [2, 'ST 2.5']);
    done = t.eval(c => importPartsCSV(c), csv); await t.page.waitForSelector('#dlgbtns [data-v=""]'); await t.page.click('#dlgbtns [data-v=""]');
    t.eq(await done, null, 'Cancel imports nothing');
  },
  'parts manager: part number built from manufacturer and order number, add manufacturer, duplicate offers to open': async t => {
    await t.open();
    await t.eval(() => { PARTS = []; partsDlg(); });
    await t.page.click('[data-padd]'); await t.page.waitForTimeout(150);
    t.ok(await t.eval(() => $('#pnview').readOnly), 'the part number cannot be typed');
    await t.page.selectOption('select[name="mfr"]', 'PXC'); await t.page.fill('input[name="ord"]', '3031212');
    t.eq(await t.eval(() => $('#pnview').value), 'PXC.3031212');
    await t.page.fill('input[name="price"]', '$3.25'); await t.confirm();
    t.eq(await t.eval(() => PARTS), [{ pn: 'PXC.3031212', mfr: 'PXC', ord: '3031212', price: '3.25' }]);
    // a manufacturer that is not in the list yet is added from the picker
    await t.eval(() => partsDlg()); await t.page.click('[data-padd]'); await t.page.waitForTimeout(150);
    await t.page.fill('input[name="ord"]', 'K-77'); await t.page.selectOption('select[name="mfr"]', '__add'); await t.page.waitForTimeout(150);
    await t.page.fill('input[name="code"]', 'dev'); t.eq(await t.page.inputValue('input[name="code"]'), 'DEV', 'codes are capitals');
    await t.page.fill('input[name="name"]', 'Devon Controls'); await t.page.click('#dlgbtns .primary'); await t.page.waitForFunction(() => $('#dlg').open && $('#dlgtitle').textContent === 'Add part');
    t.eq([await t.page.inputValue('select[name="mfr"]'), await t.page.inputValue('input[name="ord"]'), await t.eval(() => $('#pnview').value)], ['DEV', 'K-77', 'DEV.K-77'], 'back in the part with the new manufacturer chosen');
    await t.confirm();
    t.ok(await t.eval(() => PARTS.some(p => p.pn === 'DEV.K-77') && JSON.parse(localStorage.getItem('os:manufacturers.json')).manufacturers.some(m => m.code === 'DEV')), 'manufacturer saved to the shared list');
    // a duplicate is not saved; the existing part can be opened
    await t.eval(() => partsDlg()); await t.page.click('[data-padd]'); await t.page.waitForTimeout(150);
    await t.page.selectOption('select[name="mfr"]', 'PXC'); await t.page.fill('input[name="ord"]', '3031212'); await t.page.fill('input[name="desc"]', 'Second copy'); await t.page.click('#dlgbtns .primary');
    await t.page.waitForSelector('#dlgbtns [data-v="open"]'); await t.page.click('#dlgbtns [data-v="open"]'); await t.page.waitForTimeout(150);
    t.eq(await t.eval(() => [$('#dlgtitle').textContent, PARTS.length]), ['Edit part PXC.3031212', 2]);
    await t.page.fill('input[name="type"]', 'ST 2.5'); await t.confirm();
    t.eq(await t.eval(() => PARTS.find(p => p.pn === 'PXC.3031212').type), 'ST 2.5');
    await t.eval(() => partsDlg()); await t.page.click('[data-pdel="DEV.K-77"]');
    t.eq(await t.eval(() => PARTS.length), 1);
  },
  'manufacturers: codes are 2 to 6 capitals or digits, a code in use cannot change or be deleted': async t => {
    await t.open();
    await t.eval(() => { PARTS = [{ pn: 'RIT.8606000', mfr: 'RIT', ord: '8606000' }]; mfrDlg(); });
    t.ok(await t.eval(() => $('[data-mdel="RIT"]').disabled && !$('[data-mdel="WAG"]').disabled), 'delete only when unused');
    await t.page.click('[data-medit="RIT"]'); await t.page.waitForTimeout(100);
    t.ok(await t.eval(() => $('#dlgform').elements.code.readOnly), 'code locked'); await t.page.fill('input[name="supplier"]', 'Local distributor'); await t.confirm();
    t.eq(await t.eval(() => mfrOf('RIT').supplier), 'Local distributor');
    await t.eval(() => mfrDlg()); await t.page.click('[data-madd]'); await t.page.waitForTimeout(100);
    await t.page.fill('input[name="code"]', 'TOOLONG1'); await t.page.fill('input[name="name"]', 'X'); await t.confirm(); await t.page.waitForTimeout(100);
    t.ok(await t.eval(() => $('#dlg').open && !mfrOf('TOOLONG1')), 'rejected');
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
