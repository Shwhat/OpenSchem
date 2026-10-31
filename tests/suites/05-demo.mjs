// The demo project must show every feature. When a feature is added, add it to buildDemo() (ui/js/demo.js)
// and add a check here, so the demo stays complete.
export const tests = {
  'IEC and NFPA demo projects open from the Help menu and have no errors in the project check': async t => {
    await t.open();
    for (const [act, name, std] of [['demo', 'OpenSchem demo (IEC)', 'IEC'], ['demoNfpa', 'OpenSchem demo (NFPA)', 'NFPA']]) {
      await t.page.click('.menu[data-menu="help"]');
      t.eq(await t.eval(() => [...document.querySelectorAll('#dropdown .dd')].filter(d => /demo/i.test(d.textContent)).map(d => d.textContent)), ['Open IEC demo project', 'Open NFPA demo project'], 'two demos');
      await t.page.click(`#dropdown [data-act="${act}"]`);
      t.eq(await t.eval(() => [P.name, projStd()]), [name, std]);
      await t.eval(() => checkProject());
      t.ok(/^0 error/.test(await t.page.textContent('#dlgbody .sub')), await t.page.textContent('#dlgbody'));
      await t.page.click('#dlgbtns .primary');
    }
  },
  'demo projects cover every feature': async t => {
   for (const hash of ['#demo', '#demo-nfpa']) {
    await t.open(hash);
    const f = await t.eval(() => {
      const items = [...allItems()]; const syms = new Set(items.map(i => i.sym)); const kinds = new Set(P.pages.map(p => p.kind || 'sch'));
      const gfx = new Set(P.pages.flatMap(p => (p.gfx || []).map(g => g.t)));
      const lv = P.levels[0]; const rooms = new Set(lv.rooms.map(r => r.shape || (r.pts.length === 4 ? 'rect' : 'poly')));
      const reps = new Set(REPORTS.map(r => r.report));
      return {
        // the symbols of the project's standard (IEC keys, mapped to their NFPA counterparts in the NFPA demo)
        industrial: ['coil', 'no', 'nc', 'cb3', 'mc3', 'ol3', 'olnc', 'motor', 'fuse', 'pbno', 'pbnc', 'estop', 'lamp', 'term', 'ip', 'plcin',
          'tdon', 'tdoff', 'co', 'tno_on', 'tnc_on', 'tno_off', 'tnc_off', 'solc', 'sel', 'lsno', 'lsnc', 'prox', 'psw', 'tsw', 'lvl', 'flow', 'cb2', 'mpcb', 'disc3', 'xfmr', 'motor1', 'motordc', 'horn', 'heater', 'vfd', 'plug',
          'sl_cb', 'sl_mpcb', 'sl_fuse', 'sl_disc', 'sl_k', 'sl_ol', 'sl_motor', 'sl_xfmr', 'sl_vfd'].map(k => stdSym(k)).filter(s => !syms.has(s)),
        otherStd: items.filter(i => SYM[i.sym] && SYM[i.sym].std && SYM[i.sym].std !== projStd()).map(i => i.sym),
        pneumatic: PN_ORDER.filter(k => !syms.has(k)),
        pageTypes: [...new Set(P.pages.map(p => p.type || ''))].sort(),
        tubes: P.pages.flatMap(p => p.wires.filter(w => w.tube)), slShared: [...IX.dev.values()].some(d => d.items.some(i => i.role === 'sl') && d.mains.length && d.items.every(i => i.role !== 'sl' || IX.pos.get(i.id).pg.type === 'sl')),
        solXref: [...IX.dev.values()].some(d => d.main && SYM[d.main.sym].valve && d.items.some(i => SYM[i.sym].coilNo)) && [...IX.dev.values()].some(d => d.items.filter(i => SYM[i.sym].coilNo).length === 2),
        pnSl: [...IX.dev.values()].some(d => d.items.some(i => i.sym === 'pn_psw') && d.mains.length),
        valveActs: new Set(items.filter(i => SYM[i.sym] && SYM[i.sym].valve).flatMap(i => [i.actL, i.actR]).filter(Boolean)).size >= 5 && items.some(i => i.detent),
        partPrefix: Object.values(P.parts || {}).every(p => p.pn === p.mfr + '.' + p.ord && MFRS.some(m => m.code === p.mfr)),
        home: ['rpnl', 'rbrk1', 'rbrk2', 'rbrkgf', 'rnbar', 'rgbar', 'rswt', 'rsw3', 'rout', 'routgf', 'rout240', 'rlgt', 'rfan', 'rsmk'].filter(s => !syms.has(s)),
        boxes: ['bbox', 'dbox', 'plccard'].filter(s => !syms.has(s)),
        mixedCard: items.some(i => i.sym === 'plccard' && i.kind === 'DIO'),
        insideBox: items.some(i => i.inBox),
        pageKinds: [...kinds].sort(), card: P.pages.some(p => p.size === 'CARD'),
        gfx: ['line', 'poly', 'rect', 'circle', 'dim'].filter(g => !gfx.has(g)),
        text: items.some(i => i.sym === 'text'), cables: P.pages.some(p => (p.cables || []).length),
        rooms: [...rooms].sort(), floorOnly: P.pool.length > 0, legs: computeLegs().length > 0,
        layer: (P.ulayers || []).length > 0 && items.some(i => i.layer),
        parts: Object.values(P.parts || {}).some(p => p.price), partSize: Object.values(P.parts || {}).some(p => p.w),
        load: items.some(i => i.va), run: items.some(i => i.run), revs: (P.revs || []).length > 0, todos: (P.todos || []).length > 0,
        reports: ['cover', 'toc', 'panel', 'bom', 'term', 'conn', 'cables', 'cabdiag', 'tubes', 'rev', 'doors'].filter(r => !reps.has(r)),
        shapes: ['line', 'pline', 'arc', 'circle', 'ellipse', 'rect', 'polygon', 'spline', 'text'].filter(k => !(lv.shapes || []).some(x => x.t === k)),
        plineKinds: (lv.shapes || []).some(x => x.t === 'pline' && x.closed && x.b) && (lv.shapes || []).some(x => x.t === 'pline' && x.wd) && (lv.shapes || []).some(x => x.t === 'pline' && !x.closed && x.b),
        walls: (lv.shapes || []).filter(x => x.t === 'wall').length >= 8,
        doorStyles: [...new Set((lv.shapes || []).filter(x => x.t === 'opening' && x.kind === 'door').map(x => x.style))].sort(),
        openKinds: [...new Set((lv.shapes || []).filter(x => x.t === 'opening').map(x => x.kind))].sort(),
        dims: [...new Set((lv.shapes || []).filter(x => x.t === 'dim').map(x => x.kind))].sort(), assocDims: (lv.shapes || []).some(x => x.t === 'dim' && x.r1),
        annot: ['leader', 'hatch', 'insert'].filter(k => !(lv.shapes || []).some(x => x.t === k)), blockLinked: (lv.shapes || []).some(x => x.t === 'insert' && x.vals && x.vals.PART) && (lv.shapes || []).some(x => x.t === 'insert' && x.vals && x.vals.CIRCUIT),
        extras: (lv.shapes || []).some(x => x.t === 'rect' && x.r) && (lv.shapes || []).some(x => x.t === 'rect' && x.ch && x.rot) && (lv.shapes || []).some(x => x.t === 'ellipse' && x.a0 != null) && (lv.shapes || []).some(x => x.t === 'text' && x.align && x.text.includes('\n')) && ['hidden', 'center'].every(k => (lv.shapes || []).some(x => x.dash === k)),
        sheet: P.pages.some(p => p.view === 'sheet' && p.vps.length >= 2 && p.vps.some(v => v.scale > 0)),
        legend: P.pages.some(p => isFloor(p) && p.legend),
        customs: (P.customs || []).length >= 2 && P.customs.some(c => c.filters.length && c.notes) && REPORTS.filter(r => r.custom).every(r => r.rows.length > 0),
        layoutPlaced: P.pages.some(p => p.kind === 'layout' && p.lay.some(o => o.t === 'dev') && p.lay.some(o => o.t === 'rail') && p.lay.some(o => o.t === 'duct')),
      };
    });
    t.eq(f.industrial, [], 'industrial symbols missing'); t.eq(f.home, [], 'home symbols missing'); t.eq(f.boxes, [], 'boxes missing');
    t.ok(f.mixedCard, 'PLC card with inputs and outputs'); t.ok(f.insideBox, 'symbols inside a device box');
    t.eq(f.pageKinds, ['floor', 'layout', 'sch'], hash); t.ok(f.card, 'note card page');
    t.eq(f.gfx, [], 'graphics missing'); t.ok(f.text && f.cables, 'text and cables');
    t.eq(f.rooms, ['circle', 'ellipse', 'rect'], 'room shapes'); t.ok(f.floorOnly && f.legs, 'floor-only device and switch legs');
    t.ok(f.layer, 'user layer in use'); t.ok(f.parts && f.partSize, 'parts with prices and sizes');
    t.ok(f.load && f.run, 'load and run length'); t.ok(f.revs && f.todos, 'revisions and to-dos');
    t.eq(f.shapes, [], 'floor plan shapes missing');
    t.ok(f.walls, 'walls'); t.eq(f.doorStyles, ['bifold', 'double', 'garage', 'pocket', 'single', 'sliding']); t.eq(f.openKinds, ['door', 'opening', 'window']);
    t.eq(f.dims, ['ali', 'lin']); t.ok(f.assocDims, 'dimensions tied to walls'); t.eq(f.annot, [], 'leader, hatch and blocks'); t.ok(f.blockLinked, 'block attributes on the BOM and loads'); t.ok(f.sheet, 'view sheet'); t.ok(f.extras, 'rounded and rotated cut-corner rectangles, elliptical arc, multi-line text, hidden and center lines'); t.ok(f.plineKinds, 'rounded, wide and arc polylines');
    t.eq(f.reports, [], 'reports missing'); t.ok(f.layoutPlaced, 'panel layout with devices, rails and ducts'); t.ok(f.legend, 'circuit legend placed on a floor plan'); t.ok(f.customs, 'custom reports with filters, notes and rows');
    t.eq(f.otherStd, [], 'only symbols of the project standard'); t.eq(f.pneumatic, [], 'pneumatic symbols missing'); t.eq(f.pageTypes, ['', 'pneu', 'sl'], 'schematic, single-line and pneumatic pages');
    t.ok(f.tubes.length >= 10 && new Set(f.tubes.map(w => w.od)).size >= 3 && f.tubes.every(w => w.color && w.len && w.part), 'tubes with sizes, colors, lengths and part numbers');
    t.ok(f.slShared, 'single-line symbols share devices with multi-line symbols'); t.ok(f.solXref, 'valve solenoids cross-reference their valves, one valve with two solenoids');
    t.ok(f.pnSl, 'pneumatic pressure switch is the same device as its contact'); t.ok(f.valveActs, 'valve actuators and detent'); t.ok(f.partPrefix, 'part numbers are manufacturer code and order number');
   }
  },
  'demo project pages render, and the voltage drop shows on the panel schedule': async t => {
    await t.open('#demo-nfpa');
    t.eq(await t.eval(() => allPages().filter(pg => { try { pageSVG(pg); return false; } catch (e) { return true; } }).map(pageName)), [], 'NFPA demo pages render');
    await t.open('#demo');
    const errs = await t.eval(() => { const out = []; for (const pg of allPages()) { try { pageSVG(pg); } catch (e) { out.push(pageName(pg) + ': ' + e.message); } } return out; });
    t.eq(errs, []);
    const vd = await t.eval(() => REPORTS.filter(r => r.report === 'panel').flatMap(r => r.rows.map(x => x.cells.map(c => c.join(' ')))).find(r => r[2] === 'BRK5'));
    t.ok(vd && /%$/.test(vd[10]), 'voltage drop for the garage circuit: ' + JSON.stringify(vd));
  },
};
