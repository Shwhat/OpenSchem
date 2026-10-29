// Pneumatics (ISO 1219): pneumatic pages, tubes as their own line type, valves with actuators and pilot ports,
// solenoids on electrical pages cross-referenced to their valves, the tubing list.
const pneuPage = t => t.eval(() => { commit(() => { const np = newPage('M02', 'PN1', '1', 'Pneumatics'); np.type = 'pneu'; P.pages.push(np); sortPages(); curId = np.id; }); zoomFit(); });

export const tests = {
  'pneumatic pages: the Connection tool draws tubes with size and color; tube settings carry to the next tube': async t => {
    await t.open();
    await t.eval(() => addPage());
    t.eq(await t.eval(() => [...document.querySelectorAll('#dlgbody select[name="type"] option')].map(o => o.value)), ['', 'sl', 'pneu']);
    await t.page.selectOption('#dlgbody select[name="type"]', 'pneu'); await t.confirm();
    t.eq(await t.eval(() => page().type), 'pneu');
    t.eq(await t.eval(() => [...document.querySelectorAll('#tab-symbols [data-sym]')].slice(0, 3).map(e => e.dataset.sym)), ['pn_sup', 'pn_exh', 'pn_sil'], 'pneumatic symbols first');
    await t.eval(() => { setMode('place', 'pn_v52'); }); await t.click(120, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'pn_cyl_da'); }); await t.click(128, 40); await t.key('Escape');
    await t.key('w'); await t.click(116, 92); await t.click(116, 48); await t.key('Escape');
    let w = await t.eval(() => page().wires.map(w => [w.tube, w.tag, w.od, w.color]));
    t.eq(w, [[true, 'T1', '6', 'BL']]);
    t.ok(await t.eval(() => getComputedStyle(document.querySelector('#content .wire')).strokeWidth === '0.5px'), 'tubes are drawn wider');
    await t.eval(() => { sel = new Set([page().wires[0].id]); render(); });
    t.ok(await t.eval(() => /Tube T1/.test($('#props').textContent)), 'tube properties');
    await t.page.selectOption('[data-k="w.od"]', '8'); await t.page.selectOption('[data-k="w.color"]', 'BK'); await t.page.fill('[data-k="w.len"]', '1.2 m'); await t.page.press('[data-k="w.len"]', 'Tab');
    await t.key('Escape'); await t.key('w'); await t.click(124, 92); await t.click(124, 60); await t.click(132, 60); await t.click(132, 48); await t.key('Escape');
    w = await t.eval(() => page().wires.map(w => [w.tag, w.od, w.color, w.len || '']));
    t.eq(w, [['T1', '8', 'BK', '1.2 m'], ['T2', '8', 'BK', '']]);
    t.eq(await t.eval(() => [...WN.keys()].length), 0, 'tubes have no wire numbers');
  },
  'the Tube tool draws tubes on any schematic page; tubes stay out of the connection list': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.key('w'); await t.click(100, 92); await t.click(100, 60); await t.key('Escape');
    await t.eval(() => setMode('tube')); await t.click(140, 92); await t.click(140, 60); await t.key('Escape');
    t.eq(await t.eval(() => page().wires.map(w => !!w.tube)), [false, true]);
    t.eq(await t.eval(() => connectionRows().length), 1);
    await t.page.click('.menu[data-menu="edit"]');
    t.ok(await t.eval(() => !!document.querySelector('#dropdown [data-act="tubeMode"]')), 'Draw tube in the Edit menu');
  },
  'valves: actuators are properties, a pilot actuator adds a pilot port, detent': async t => {
    await t.open(); await pneuPage(t);
    await t.eval(() => { setMode('place', 'pn_v52'); }); await t.click(120, 100); await t.key('Escape');
    const v = () => t.eval(() => { const it = page().items[0]; return [it.actL, it.actR, (it.cl || []).join('/'), connPts(it).length]; });
    t.eq(await v(), ['sol', 'spring', '4/2/5/1/3', 5]);
    await t.eval(() => { sel = new Set([page().items[0].id]); render(); });
    await t.page.selectOption('[data-k="it.actL"]', 'pilot');
    t.eq(await v(), ['pilot', 'spring', '4/2/5/1/3/14', 6]);
    t.eq(await t.eval(() => connPts(page().items[0])[5]), { x: 92, y: 100, i: 5 }, 'pilot port 14 on the left');
    await t.page.selectOption('[data-k="it.actR"]', 'pilot');
    t.eq(await v(), ['pilot', 'pilot', '4/2/5/1/3/14/12', 7]);
    await t.page.check('[data-k="it.detent"]');
    t.eq(await t.eval(() => page().items[0].detent), true);
    t.eq(await t.eval(() => Object.keys(VALVES)), ['pn_v22', 'pn_v32', 'pn_v52', 'pn_v53c', 'pn_v53e', 'pn_v53p']);
  },
  'valve solenoids on electrical pages cross-reference their valves': async t => {
    await t.open(); await pneuPage(t);
    await t.eval(() => { setMode('place', 'pn_v52'); }); await t.click(120, 100); await t.key('Escape');
    await t.eval(() => goPage(P.pages.find(p => !p.type).id));
    await t.eval(() => { setMode('place', 'solc'); }); await t.click(100, 100); await t.key('Escape');
    const it = await t.eval(() => { const s = page().items.find(i => i.sym === 'solc'); return [s.fn, s.loc, s.tag]; });
    t.eq(it, ['', '', 'QM1'], 'takes the tag of the last valve');
    // put it in the valve's function and location: one device, cross-referenced both ways
    await t.eval(() => { commit(() => { const s = page().items.find(i => i.sym === 'solc'); s.fn = 'M02'; s.loc = 'PN1'; }); });
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .ly-xref')].some(e => /^=M02\+PN1\/1\.\d$/.test(e.textContent))), 'solenoid refers to the valve');
    await t.eval(() => goPage(P.pages.find(p => p.type === 'pneu').id));
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .ly-xref')].some(e => /\/1\.3/.test(e.textContent))), 'valve refers to the solenoid');
  },
  'tubing list: From, To, tube OD, color, length and part number, grouped by tube size': async t => {
    await t.open(); await pneuPage(t);
    await t.eval(() => {
      const pg = page(); const add = (sym, x, y, o) => { const it = Object.assign(makeItem(sym, x, y, 0, pg), o || {}); pg.items.push(it); return it; };
      add('pn_sup', 40, 140); add('pn_shut', 40, 116, { tag: 'QM1' }); add('pn_v32', 120, 100, { tag: 'QM2' }); add('pn_cyl_sa', 128, 40, { tag: 'MM1' });
      const T = (od, color, len, part, ...pts) => pg.wires.push(Object.assign({ id: uid(), pts }, newTubeProps(), { od, color, len, part }));
      T('8', 'BL', '0.5 m', 'SMC.TU0805B-20', [40, 136], [40, 124]); T('8', 'BL', '1 m', 'SMC.TU0805B-20', [40, 108], [40, 100], [72, 100], [72, 124], [116, 124], [116, 108]);
      T('4', 'NA', '0.8 m', '', [116, 92], [116, 48]);
      PARTS = [{ pn: 'SMC.TU0805B-20', mfr: 'SMC', ord: 'TU0805B-20', desc: 'Tubing 8 mm', price: '52' }]; render();
    });
    const rep = await t.eval(() => { const r = REPORTS.filter(r => r.report === 'tubes'); return { n: r.length, title: r[0].title, cols: r[0].cols.map(c => c.h), rows: r.flatMap(x => x.rows.map(y => y.cells.map(c => c.join(' ')))) }; });
    t.eq([rep.n, rep.title], [1, 'Tubing list']);
    t.eq(rep.cols, ['Tube', 'From', 'To', 'Tube OD', 'Color', 'Length', 'Part number', 'Page']);
    t.eq(rep.rows.map(r => r.slice(0, 7)), [
      ['', 'Tube 4 mm: 1 tube(s), 0.8 total length', '', '', '', '', ''],
      ['T3', '-QM2:2', '-MM1:A', '4 mm', 'Natural', '0.8 m', ''],
      ['', 'Tube 8 mm: 2 tube(s), 1.5 total length', '', '', '', '', ''],
      ['T1', 'Air supply', '-QM1:1', '8 mm', 'Blue', '0.5 m', 'SMC.TU0805B-20'],
      ['T2', '-QM1:2', '-QM2:1', '8 mm', 'Blue', '1 m', 'SMC.TU0805B-20']]);
    // tubes with a part number are on the bill of materials
    t.eq(await t.eval(() => bomRows().filter(r => r.part === 'SMC.TU0805B-20').map(r => [r.qty, r.desc, r.tags.join(', ')])), [[2, 'Tube, 8 mm', 'T1 (0.5 m), T2 (1 m)']]);
    // the tubing list is a report that can be turned off, and a custom report can start from it
    t.ok(await t.eval(() => REPORT_DEFS.some(r => r[0] === 'tubes') && CUSTOM_KINDS.some(r => r[0] === 'tubes') && customSource('tubes').rows.length === 5));
  },
};
