// Excel export/import, find and replace, bulk edit, terminal strip editor.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export const tests = {
  'Excel: export opens in a spreadsheet reader, edits come back by ID': async t => {
    await t.open('#home');
    const b64 = await t.eval(() => { const cols = XL_COLS(); const d = deviceRowsForExcel(); return b64Encode(buildXlsx([{ name: 'Devices', rows: [cols.map(c => c[1])].concat(d.map(r => cols.map(([k]) => r[k]))) }])); });
    const dir = path.join(t.root, 'build'); const f = path.join(dir, 'devices-test.xlsx'); const f2 = path.join(dir, 'devices-edited.xlsx');
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    // check with an independent reader (openpyxl), and let it write a deflate-compressed copy with edits
    let py;
    try { py = execFileSync('python3', ['-c', `
import openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['Devices']
head = [c.value for c in ws[1]]
rows = list(ws.iter_rows(min_row=2, values_only=True))
tag = head.index('Name'); desc = head.index('Description'); va = head.index('Load (VA)')
n = 0
for r in ws.iter_rows(min_row=2):
    if r[tag].value == 'OUT1': r[desc].value = 'Counter outlet'; r[va].value = 360; n += 1
ws.append(['nope', 'X', '', 'ZZZ9'])
wb.save(sys.argv[2]); print(len(rows), n, head[0])
`, f, f2]).toString().trim(); } catch (e) { t.ok(false, 'python/openpyxl not available: ' + e.message); }
    const [nrows, n, first] = py.split(' ');
    t.ok(+nrows > 10, 'rows exported'); t.eq(n, '1'); t.eq(first, 'ID');
    const orig = await t.eval(() => [...allItems()].find(x => x.tag === 'OUT1').desc || '');
    const res = await t.eval(async b => applyDeviceRows(await readXlsx(b64Decode(b), 'Devices')), fs.readFileSync(f2).toString('base64'));
    t.eq([res.updated, res.unknown], [1, 1]);
    t.eq(await t.eval(() => { const i = [...allItems()].find(x => x.tag === 'OUT1'); return [i.desc, i.va, deviceLoad(i)]; }), ['Counter outlet', '360', 360]);
    const count = await t.eval(() => [...allItems()].length);
    await t.key('Control+z');
    t.eq(await t.eval(() => [...allItems()].find(x => x.tag === 'OUT1').desc || ''), orig, 'undo reverses the import');
    t.eq(await t.eval(() => [...allItems()].length), count, 'no devices created or deleted');
  },
  'find and replace across descriptions, then bulk edit the results': async t => {
    await t.open('#home');
    const hits = await t.eval(() => findMatches({ q: 'kitchen', field: 'desc' }).map(h => h.text));
    t.ok(hits.length >= 1 && hits.every(h => /kitchen/i.test(h)), JSON.stringify(hits));
    const n = await t.eval(() => replaceMatches({ q: 'Kitchen', field: 'desc', matchCase: true }, 'Galley'));
    t.ok(n >= 1);
    t.eq(await t.eval(() => findMatches({ q: 'Kitchen', field: 'desc', matchCase: true }).length), 0);
    t.ok(await t.eval(() => replaceMatches({ q: 'Kitchen', field: 'page', matchCase: true }, 'Galley')) >= 1);
    t.ok(await t.eval(() => P.pages.some(p => /Galley/.test(p.desc))), 'page descriptions too');
    // bulk edit: set part number on every outlet found by tag
    const ids = await t.eval(() => findMatches({ q: 'OUT', field: 'tag' }).map(h => h.id));
    await t.eval(i => bulkEdit(i, 'part', 'TR15'), ids);
    t.ok(await t.eval(() => [...allItems()].filter(i => /^OUT/.test(i.tag)).every(i => i.part === 'TR15')));
    await t.eval(() => findDlg()); await t.page.fill('#fq', 'Galley'); await t.page.waitForTimeout(50);
    t.ok(await t.eval(() => document.querySelectorAll('#dlgbody .fres').length) >= 1, 'dialog lists results');
  },
  'terminal strip editor: renumber, edit and set part for the strip': async t => {
    await t.open('#ind');
    const key = await t.eval(() => [...IX.dev.values()].find(d => d.tag === 'X1').key);
    await t.eval(k => terminalEditor(k), key);
    t.eq(await t.eval(() => document.querySelectorAll('#dlgbody .tsrow').length), 2);
    await t.page.fill('#dlgbody [data-ts="part"]', 'UK5N'); await t.page.click('#dlgbody [data-tsall="part"]');
    await t.page.fill('#dlgbody .tsrow:nth-child(2) [data-tf="tn"]', '7');
    await t.confirm();
    t.eq(await t.eval(() => [...allItems()].filter(i => i.tag === 'X1').map(i => [i.tn, i.part]).sort()), [['1', 'UK5N'], ['7', 'UK5N']]);
    await t.eval(k => terminalEditor(k), key);
    await t.page.click('#dlgbody [data-tsren]'); await t.confirm();
    t.eq(await t.eval(() => [...allItems()].filter(i => i.tag === 'X1').map(i => i.tn).sort()), ['1', '2']);
  },
};
