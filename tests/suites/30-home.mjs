// Residential features: tags, numbering, wire colors, switch legs, display modes.
export const tests = {
  'home demo loads with homeowner names': async t => {
    await t.open('#home');
    t.eq(await t.eval(() => allPages().filter(p => !p.report).map(pageName)),
      ['CKT 1/1', 'CKT 2/1', 'CKT 3/1', 'CKT 4/1', 'PANEL/1', 'Main floor/1', 'Main floor/2']);
  },
  'switch legs follow the schematic wiring, including 3-ways': async t => {
    await t.open('#home');
    t.eq(await t.eval(() => computeLegs().map(([a, b]) => itemById(a).tag + '>' + itemById(b).tag)),
      ['SWT1>LGT1', 'SWT2>LGT2', 'SWT3>LGT2', 'SWT4>LGT3', 'SWT5>FAN1']);
  },
  'new wires get US colors from what they connect to': async t => {
    await t.open('#home');
    const ws = await t.eval(() => P.pages.filter(p => /^CKT[123]$/.test(p.fn)).flatMap(pg => pg.wires.map(w => [w.color, wireEnds(pg, w).join(' ')])));
    const bad = ws.filter(([c, ends]) => /(:N\b|LINE N|LOAD N|N bar)/.test(ends) ? c !== 'WH' : /:(T1|T2)\b/.test(ends) ? c !== 'RD' : c !== 'BK');
    t.eq(bad, [], 'neutrals white, travelers red, hots black');
    t.ok(ws.some(w => w[0] === 'RD'), '3-way travelers present');
    t.eq(await t.eval(() => [...new Set(P.pages.find(p => p.fn === 'CKT4').wires.map(w => w.awg))]), ['10'], 'dryer circuit wire size');
  },
  'numbering: whole house versus per room': async t => {
    await t.open('#home');
    t.eq(await t.eval(() => nextTag('', 'Garage', 'OUT', true)), 'OUT5');
    await t.eval(() => { S().numbering = 'room'; });
    t.eq(await t.eval(() => [nextTag('', 'Garage', 'OUT', true), nextTag('', 'Kitchen', 'OUT', true)]), ['OUT1', 'OUT3']);
  },
  'engineering and homeowner tag display': async t => {
    await t.open('#home');
    await t.eval(() => goPage(P.pages.find(p => p.fn === 'CKT2').id));
    t.eq(await t.eval(() => { const i = page().items.find(i => i.tag === 'OUT1'); return dispFull(i.fn, i.loc, i.tag); }), 'CKT 2 · Kitchen · Outlet 1');
    await t.eval(() => toggleViewMode());
    t.eq(await t.eval(() => { const i = page().items.find(i => i.tag === 'OUT1'); return dispFull(i.fn, i.loc, i.tag); }), '=CKT2+Kitchen-OUT1');
    t.eq(await t.eval(() => [S().terms, S().reportCols]), ['eng', 'eng']);
  },
  'ribbon right-click menu': async t => {
    await t.open();
    await t.page.click('.rpanel', { button: 'right', position: { x: 600, y: 30 } });
    t.eq(await t.eval(() => [...document.querySelectorAll('#dropdown .dd')].map(d => d.textContent)),
      ['Switch to homeowner view', 'Dark theme', 'Dark sheet', 'Customize ribbon...']);
  },
};
