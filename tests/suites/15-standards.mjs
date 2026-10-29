// Symbol standards: IEC 60617 and NFPA 79 libraries, project standard, device letters, converting content, single-line
// symbols, the Library field on user symbols.
const items = t => t.eval(() => page().items.map(i => [i.sym, i.tag, (i.cl || []).join('/')]));
async function newProject(t, std, name = 'Test') {
  await t.eval(() => fileNew());
  await t.page.fill('#dlgbody input[name="name"]', name); await t.page.selectOption('#dlgbody select[name="std"]', std); await t.confirm();
}

export const tests = {
  'the standard is chosen for a new project and fixed after that': async t => {
    await t.open();
    await t.eval(() => fileNew());
    t.eq(await t.eval(() => [...document.querySelectorAll('#dlgbody select[name="std"] option')].map(o => o.value)), ['IEC', 'NFPA']);
    await t.page.fill('#dlgbody input[name="name"]', 'Mixer'); await t.page.selectOption('#dlgbody select[name="std"]', 'NFPA'); await t.confirm();
    t.eq(await t.eval(() => [P.name, P.std, projStd()]), ['Mixer', 'NFPA', 'NFPA']);
    // project properties show it but cannot change it
    await t.eval(() => projectProps());
    t.ok(await t.eval(() => [...document.querySelectorAll('#dlgbody input[readonly]')].some(i => i.value === 'NFPA 79')), 'standard shown read-only');
    t.ok(await t.eval(() => !$('#dlgform').elements.std), 'no field to change it');
    await t.page.click('#dlgbtns .btn:not(.primary)');
    t.eq(await t.eval(() => JSON.parse(projectJSON()).std), 'NFPA', 'saved with the project');
  },
  'device letters follow the project standard': async t => {
    await t.open();
    await newProject(t, 'NFPA');
    await t.eval(() => { setMode('place', 'n_coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'n_no'); }); await t.click(140, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'n_pbno'); }); await t.click(180, 100); await t.key('Escape');
    // a symbol of the other standard placed in this project still gets this project's letter
    await t.eval(() => { setMode('place', 'cb3'); }); await t.click(240, 100); await t.key('Escape');
    t.eq(await items(t), [['n_coil', 'CR1', 'A1/A2'], ['n_no', 'CR1', '13/14'], ['n_pbno', 'PB1', '13/14'], ['cb3', 'CB1', '1/2/3/4/5/6']]);
    await newProject(t, 'IEC');
    await t.eval(() => { setMode('place', 'n_coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'lsno'); }); await t.click(140, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'prox'); }); await t.click(180, 100); await t.key('Escape');
    t.eq(await items(t), [['n_coil', 'K1', 'A1/A2'], ['lsno', 'S1', '13/14'], ['prox', 'B1', '13/14']]);
  },
  'the palette shows the project standard, and the other standard on request': async t => {
    await t.open();
    await newProject(t, 'NFPA');
    const cards = () => t.eval(() => [...document.querySelectorAll('#tab-symbols [data-sym]')].map(e => e.dataset.sym));
    let c = await cards();
    t.ok(c.includes('n_coil') && c.includes('n_cb3') && c.includes('nsl_cb') && c.includes('pn_v52'), 'NFPA, single-line and pneumatic symbols');
    t.ok(!c.includes('coil') && !c.includes('sl_cb'), 'no IEC symbols by default');
    await t.eval(() => $('#symother').click());
    c = await cards(); t.ok(c.includes('coil') && c.includes('n_coil'), 'both standards');
    t.ok(await t.eval(() => [...document.querySelectorAll('#tab-symbols .symcat')].some(e => /IEC: Coils and contacts/.test(e.textContent))), 'other standard in its own categories');
    await t.eval(() => $('#symother').click());
    // the ribbon shows the project's version of each symbol
    await t.eval(() => { ribbonTab = 'insert'; renderToolbar(); });
    const rb = await t.eval(() => [...document.querySelectorAll('#toolbar [data-place]')].map(e => e.dataset.place));
    t.ok(rb.includes('n_coil') && rb.includes('n_pbno') && rb.includes('nsl_motor') && !rb.includes('coil'), rb.join(','));
  },
  'every symbol has a counterpart in the other standard and draws without errors': async t => {
    await t.open();
    const r = await t.eval(() => {
      const bad = [];
      for (const [k, d] of Object.entries(SYM)) {
        if (d.std && !SYM[d.pair]) bad.push(k + ' has no pair');
        if (d.std && SYM[d.pair].std === d.std) bad.push(k + ' pairs within its standard');
        if (d.std && d.pair && SYM[d.pair].conns.length !== d.conns.length) bad.push(k + ' differs in connection points');
        try { symPreview(k); } catch (e) { bad.push(k + ': ' + e.message); }
      }
      const iec = Object.keys(SYM).filter(k => SYM[k].std === 'IEC'), nfpa = Object.keys(SYM).filter(k => SYM[k].std === 'NFPA');
      return { bad, iec: iec.length, nfpa: nfpa.length, letters: ['coil', 'pbno', 'lsno', 'cb1', 'fuse', 'ol3', 'lamp', 'motor', 'solc', 'sel', 'xfmr'].map(k => SYM[k].np), sl: iec.filter(k => SYM[k].role === 'sl').length };
    });
    t.eq(r.bad, []); t.ok(r.iec >= 50 && r.nfpa >= 50, `${r.iec} IEC and ${r.nfpa} NFPA symbols`); t.eq(r.sl, 9, 'single-line symbols');
    t.eq(r.letters, ['CR', 'PB', 'LS', 'CB', 'FU', 'OL', 'PL', 'MTR', 'SOL', 'SS', 'T']);
  },
  'pasting content of the other standard asks to convert it or keep it': async t => {
    await t.open();
    await newProject(t, 'IEC');
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'no'); }); await t.click(140, 100); await t.key('Escape');
    await t.eval(() => { sel = new Set(page().items.map(i => i.id)); copySel(); });
    await newProject(t, 'NFPA');
    // keep as is
    let done = t.eval(() => paste());
    await t.page.waitForSelector('#dlgbtns [data-v="keep"]');
    const rows = await t.eval(() => [...document.querySelectorAll('#dlgbody table tr')].slice(1).map(r => [...r.cells].map(c => c.textContent.trim())));
    t.eq(rows, [['K1', 'Coil (IEC)', '→', 'Relay coil (NFPA)', 'CR1'], ['K1', 'NO contact (IEC)', '→', 'NO contact (NFPA)', 'CR1']]);
    await t.page.click('#dlgbtns [data-v="keep"]'); await done;
    t.eq((await items(t)).map(i => i[0]), ['coil', 'no']);
    // convert
    done = t.eval(() => paste()); await t.page.waitForSelector('#dlgbtns [data-v="convert"]'); await t.page.click('#dlgbtns [data-v="convert"]'); await done;
    const all = await items(t); t.eq(all.slice(2).map(i => i[0]), ['n_coil', 'n_no']);
    t.ok(/^CR\d+$/.test(all[2][1]) && all[2][1] === all[3][1], 'the device gets an NFPA letter: ' + all[2][1]);
    // cancel pastes nothing
    done = t.eval(() => paste()); await t.page.waitForSelector('#dlgbtns [data-v=""]'); await t.page.click('#dlgbtns [data-v=""]'); await done;
    t.eq((await items(t)).length, 4);
  },
  'macros and copied pages of the other standard are converted too': async t => {
    await t.open();
    await newProject(t, 'IEC');
    await t.eval(() => { setMode('place', 'pbno'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'lamp'); }); await t.click(140, 100); await t.key('Escape');
    await t.eval(() => { LIB.macros = [{ id: 'm1', name: 'Start', items: clone(page().items).map(i => Object.assign(i, { x: i.x - 96, y: i.y - 96 })), wires: [], cables: [], gfx: [] }]; copyPage(); });
    await newProject(t, 'NFPA');
    // copied page
    let done = t.eval(() => pastePage()); await t.page.waitForSelector('#dlgbtns [data-v="convert"]'); await t.page.click('#dlgbtns [data-v="convert"]'); await done;
    t.eq(await t.eval(() => [P.pages.length, page().items.map(i => [i.sym, i.tag])]), [2, [['n_pbno', 'PB1'], ['n_lamp', 'PL1']]]);
    // macro
    await t.eval(() => insertMacroDlg()); await t.page.click('[data-mac="ins:m1"]');
    await t.page.waitForSelector('#dlgbtns [data-v="convert"]'); await t.page.click('#dlgbtns [data-v="convert"]');
    await t.page.waitForFunction(() => mode === 'macro');
    t.eq(await t.eval(() => placeMacro.items.map(i => i.sym)), ['n_pbno', 'n_lamp']);
    await t.click(200, 160); await t.key('Escape');
    t.eq(await t.eval(() => page().items.slice(2).map(i => i.sym)), ['n_pbno', 'n_lamp']);
  },
  'single-line symbols are views of the multi-line device: cross-referenced and counted once': async t => {
    await t.open();
    await newProject(t, 'IEC');
    await t.eval(() => { setMode('place', 'cb3'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { commit(() => { const np = newPage('', '', '2', 'Single-line'); np.type = 'sl'; P.pages.push(np); curId = np.id; }); });
    await t.eval(() => { setMode('place', 'sl_cb'); }); await t.click(100, 100); await t.key('Escape');
    const r = await t.eval(() => {
      const it = page().items[0]; buildIndex(); const dv = IX.dev.get(devKey(it));
      return { sym: it.sym, role: it.role, tag: it.tag, n: dv.items.length, bom: bomRows().filter(b => b.tags.includes('-Q1')).map(b => b.qty), xref: [...document.querySelectorAll('#content .ly-xref')].map(e => e.textContent) };
    });
    t.eq([r.sym, r.role, r.tag, r.n], ['sl_cb', 'sl', 'Q1', 2]);
    t.eq(r.bom, [1], 'one BOM row with quantity 1');
    t.ok(r.xref.includes('/1.3'), 'single-line symbol refers to the multi-line symbol: ' + r.xref.join('|'));
    await t.eval(() => goPage(P.pages[0].id));
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .ly-xref')].some(e => e.textContent === '/2.3')), 'and back');
    // a device drawn only as a single-line symbol is not an error, and its page has no wire numbers
    await t.eval(() => { goPage(P.pages[1].id); setMode('place', 'sl_motor'); }); await t.click(160, 100); await t.key('Escape');
    await t.eval(() => { commit(() => page().wires.push({ id: 'w1', pts: [[100, 108], [100, 140]] })); checkProject(); });
    t.ok(/^0 error/.test(await t.page.textContent('#dlgbody .sub')), await t.page.textContent('#dlgbody'));
    t.eq(await t.eval(() => WN.get('w1') || ''), '', 'no wire number on a single-line page');
  },
  'changeover contacts and solenoid coils get their own numbers': async t => {
    await t.open();
    await t.eval(() => { setMode('place', 'coil'); }); await t.click(100, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'co'); }); await t.click(140, 100); await t.click(160, 100); await t.key('Escape');
    await t.eval(() => { setMode('place', 'pn_v53c'); }); await t.click(260, 60); await t.key('Escape');
    await t.eval(() => { setMode('place', 'solc'); }); await t.click(240, 140); await t.click(280, 140); await t.key('Escape');
    t.eq(await items(t), [['coil', 'K1', 'A1/A2'], ['co', 'K1', '11/12/14'], ['co', 'K1', '21/22/24'], ['pn_v53c', 'QM1', '4/2/5/1/3'], ['solc', 'QM1', 'A1/A2'], ['solc', 'QM1', 'A3/A4']]);
    // the coil's contact mirror shows the changeover contacts
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .ly-xref')].some(e => e.textContent === '11-12/14')), 'changeover in the contact mirror');
    // the valve lists its solenoids, each solenoid refers to the valve
    t.ok(await t.eval(() => [...document.querySelectorAll('#content .ly-xref')].filter(e => /^\/1\.\d$/.test(e.textContent)).length >= 3), 'cross-references');
  },
  'user symbols have a Library field that files them with a standard': async t => {
    await t.open();
    await newProject(t, 'IEC');
    await t.eval(() => copySymbol('n_coil'));
    t.eq(await t.page.inputValue('[data-se="d.lib"]'), 'NFPA', 'copy keeps the library of the original');
    await t.page.selectOption('[data-se="d.lib"]', 'IEC'); await t.page.fill('[data-se="d.name"]', 'Big coil'); await t.page.press('[data-se="d.name"]', 'Tab');
    await t.confirm();
    const r = await t.eval(() => { const k = Object.keys(SYM).find(k => SYM[k].user && SYM[k].name === 'Big coil'); return [SYM[k].lib, SYM[k].std, !![...document.querySelectorAll('#tab-symbols [data-sym]')].find(e => e.dataset.sym === k)]; });
    t.eq(r, ['IEC', 'IEC', true]);
    t.eq(await t.eval(() => SYM_LIBS.map(l => l[0])), ['', 'IEC', 'NFPA', 'Pneumatic', 'Residential']);
  },
};
