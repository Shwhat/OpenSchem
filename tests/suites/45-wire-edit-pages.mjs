// Dragging connection ends and segments; choosing pages for PDF export and printing.
export const tests = {
  'drag a connection end to a new point, it snaps and re-routes': async t => {
    await t.open();
    await t.eval(() => setMode('place', 'coil')); await t.click(100, 100); await t.click(160, 100); await t.key('Escape');
    await t.key('w'); await t.click(100, 108); await t.click(100, 140); await t.key('Escape'); await t.key('Escape');
    await t.eval(() => { sel = new Set([page().wires[0].id]); render(); });
    t.eq(await t.eval(() => document.querySelectorAll('#content [data-wend]').length), 2, 'end handles shown');
    // drag the free end onto the second coil's top point
    const [a, b] = await t.scr(100, 140), [c, d] = await t.scr(160.6, 92.4);
    await t.page.mouse.move(a, b); await t.page.mouse.down(); await t.page.mouse.move(c, d, { steps: 6 }); await t.page.mouse.up();
    const pts = await t.eval(() => page().wires[0].pts);
    t.eq([pts[0], pts[pts.length - 1]], [[100, 108], [160, 92]], 'snapped onto the connection point');
    t.ok(pts.every((p, i) => !i || p[0] === pts[i - 1][0] || p[1] === pts[i - 1][1]), 'stays orthogonal');
    t.eq(await t.eval(() => [...WN.values()].length), 1);
    await t.key('Control+z'); t.eq(await t.eval(() => page().wires[0].pts), [[100, 108], [100, 140]]);
    // shorten a straight wire by dragging its end along it
    await t.eval(() => { sel = new Set([page().wires[0].id]); render(); });
    const [e1, e2] = await t.scr(100, 140), [f1, f2] = await t.scr(100, 128);
    await t.page.mouse.move(e1, e2); await t.page.mouse.down(); await t.page.mouse.move(f1, f2, { steps: 4 }); await t.page.mouse.up();
    t.eq(await t.eval(() => page().wires[0].pts), [[100, 108], [100, 128]]);
  },
  'drag a segment of a selected connection sideways': async t => {
    await t.open();
    await t.eval(() => commit(() => page().wires.push({ id: 'w1', pts: [[100, 60], [100, 100], [160, 100], [160, 140]] })));
    await t.eval(() => { sel = new Set(['w1']); render(); });
    await t.drag(130, 100, 130, 112);
    t.eq(await t.eval(() => page().wires[0].pts), [[100, 60], [100, 112], [160, 112], [160, 140]], 'middle segment moved');
    // an end segment keeps its end point and gets a new corner
    await t.eval(() => { sel = new Set(['w1']); render(); });
    await t.drag(100, 80, 88, 80);
    t.eq(await t.eval(() => page().wires[0].pts), [[100, 60], [88, 60], [88, 112], [160, 112], [160, 140]]);
  },
  'page picker: quick choices, ranges and branches; PDF and print use the choice': async t => {
    await t.open('#home');
    await t.eval(() => ACTIONS.exportPDF());
    const n = await t.eval(() => allPages().length);
    t.eq(await t.page.textContent('#pkcount'), `${n} of ${n} page(s)`);
    await t.page.click('[data-pq="floor"]');
    t.eq(await t.page.textContent('#pkcount'), `2 of ${n} page(s)`);
    await t.page.fill('#pkrange', '1-3, 5'); await t.page.click('[data-pq="range"]');
    t.eq(await t.page.textContent('#pkcount'), `4 of ${n} page(s)`);
    await t.page.click('[data-pq="none"]');
    await t.page.click('[data-pkb="rep"]');
    const reps = await t.eval(() => REPORTS.filter(r => !r.front).length);
    t.eq(await t.page.textContent('#pkcount'), `${reps} of ${n} page(s)`);
    // print only the chosen pages
    await t.eval(() => { window.print = () => {}; $('#dlg').close('cancel'); ACTIONS.printAll(); });
    t.eq(await t.page.textContent('#pkcount'), `${n} of ${n} page(s)`, 'cancel does not keep the choice');
    await t.page.click('[data-pq="cur"]'); await t.confirm(); await t.page.waitForTimeout(80);
    t.eq(await t.eval(() => $('#printarea').children.length), 1);
    t.eq(await t.eval(() => P.lastExport.length), 1, 'choice remembered in the project');
    // PDF with two pages
    await t.eval(() => ACTIONS.exportPDF());
    await t.page.fill('#pkrange', '3-4'); await t.page.click('[data-pq="range"]');
    const [dl] = await Promise.all([t.page.waitForEvent('download', { timeout: 60000 }), t.confirm()]);
    const buf = await (await import('fs')).promises.readFile(await dl.path());
    t.eq((buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 2, 'two pages in the PDF');
  },
};
