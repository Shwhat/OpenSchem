// Units, drawing scale, object snaps, ortho/polar, typed input, window/crossing selection, command line, docking.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;

export const tests = {
  'lengths parse and format in feet and inches and metric': async t => {
    await t.open('#home');
    const r = await t.eval(() => [
      parseLength(`12'6"`, 'imperial') / 25.4, parseLength(`12' 6 1/2"`, 'imperial') / 25.4, parseLength('150"', 'imperial') / 25.4,
      parseLength('3.5 m', 'metric'), parseLength('30 cm'), parseLength('10', 'imperial') / 25.4, parseLength('10', 'metric'), parseLength('abc'),
      formatLength(25.4 * 150.5, 'imperial', { den: 16 }), formatLength(3750, 'metric'), formatLength(450, 'metric'),
    ]);
    t.eq([r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]], [150, 150.5, 150, 3500, 300, 10, 10, null]);
    t.eq([r[8], r[9], r[10]], [`12'-6 1/2"`, '3.75 m', '450 mm']);
  },
  'drawing scale: levels default to 1/4"=1\', real size follows scale, metric switch converts': async t => {
    await t.open('#home'); await goFloor(t);
    t.eq(await t.eval(() => [P.units, levelOf(page()).scale, formatScale(levelOf(page()).scale)]), ['imperial', 48, `1/4" = 1'`]);
    t.eq(await t.eval(() => parseScale(`1/2" = 1'`)), 24);
    t.eq(await t.eval(() => parseScale('1:50')), 50);
    t.ok(near(await t.eval(() => toRealMm(levelOf(page()), 10)), 480));
    await t.eval(() => setUnits('metric'));
    t.eq(await t.eval(() => [P.units, levelOf(page()).scale]), ['metric', 50]);
    await t.eval(() => setLevelScale(levelOf(page()), 100));
    t.eq(await t.eval(() => formatScale(levelOf(page()).scale)), '1:100');
  },
  'old files get units and a scale on upgrade': async t => {
    await t.open('#home');
    const r = await t.eval(() => { const j = JSON.parse(JSON.stringify(P)); j.ver = 2; delete j.units; for (const l of j.levels || []) delete l.scale; loadProject(j, ''); return [P.ver, P.units, (P.levels || []).every(l => l.scale === 48)]; });
    t.eq(r, [4, 'imperial', true]);
  },
  'object snaps find endpoints, midpoints and centers': async t => {
    await t.open('#home'); await goFloor(t);
    const r = await t.eval(() => {
      const pg = page(), lv = levelOf(pg), room = lv.rooms[0], a = room.pts[0], b = room.pts[1];
      const e = osnapFind(pg, lv, [a[0] + 0.5, a[1] + 0.5]);
      const m = osnapFind(pg, lv, [(a[0] + b[0]) / 2 + 0.3, (a[1] + b[1]) / 2 + 0.3]);
      const far = osnapFind(pg, lv, [a[0] + 500, a[1] + 500]);
      PREFS.osnapOn = false; const off = osnapFind(pg, lv, a); PREFS.osnapOn = true;
      return [e && e.k, m && m.k, far, off];
    });
    t.eq(r, ['end', 'mid', null, null]);
  },
  'ortho and polar tracking constrain the next point': async t => {
    await t.open('#home');
    const r = await t.eval(() => {
      PREFS.ortho = true; PREFS.polar = false; const a = trackPoint([100, 100], [150, 108]).p;
      PREFS.ortho = false; PREFS.polar = true; PREFS.polarInc = 45; const b = trackPoint([100, 100], [150, 52]);
      PREFS.polar = false; const c = trackPoint([100, 100], [150, 108]).p; PREFS.ortho = true;
      return [a, b.tracked, Math.round(b.ang), c];
    });
    t.eq(r, [[150, 100], true, 45, [150, 108]]);
  },
  'typed lengths and coordinates draw a room shape to size': async t => {
    await t.open('#home'); await goFloor(t);
    const n0 = await t.eval(() => levelOf(page()).rooms.length);
    await t.eval(() => setMode('roompoly')); await t.click(40, 40);
    await t.eval(() => { fpTyped(`10',0`); fpTyped(`0,8'`); fpTyped(`-10',0`); fpTyped(''); });
    await t.page.fill('#dlgbody input[name="name"]', 'Den'); await t.confirm();
    const r = await t.eval(() => { const lv = levelOf(page()); const room = lv.rooms[lv.rooms.length - 1]; const p = room.pts; return [lv.rooms.length, p.length, Math.round(toRealMm(lv, Math.abs(p[1][0] - p[0][0])) / 25.4), Math.round(toRealMm(lv, Math.abs(p[2][1] - p[1][1])) / 25.4)]; });
    t.eq(r, [n0 + 1, 4, 120, 96]);
  },
  'window selection needs the whole room, crossing selection only a touch': async t => {
    await t.open('#home'); await goFloor(t);
    await t.eval(() => { const lv = levelOf(page()); lv.rooms = [{ id: 'ra', name: 'A', pts: [[300, 20], [340, 20], [340, 60], [300, 60]] }]; lv.places = []; render(); });
    await t.eval(() => { sel = new Set(); render(); });
    await t.drag(290, 10, 350, 70);
    t.ok(await t.eval(() => sel.has('ra')), 'window around the room selects it');
    await t.eval(() => { sel = new Set(); render(); });
    await t.drag(270, 10, 320, 50);
    t.ok(!(await t.eval(() => sel.has('ra'))), 'left to right box that does not enclose it selects nothing');
    await t.drag(350, 70, 320, 40);
    t.ok(await t.eval(() => sel.has('ra')), 'right to left box that touches it selects it');
  },
  'command line runs commands by name and alias': async t => {
    await t.open('#home'); await goFloor(t);
    const r = await t.eval(() => {
      PREFS.ortho = false; cmdExec('ortho'); const a = PREFS.ortho; cmdExec('OR'); const b = PREFS.ortho;
      cmdExec('rm'); const m = mode; cmdExec('rs'); const m2 = mode; escapeCommand();
      return [a, typeof cmdFind === 'function', m, m2];
    });
    t.eq(r[0], true); t.eq(r[2], 'room'); t.eq(r[3], 'roompoly');
  },
  'command bar shows on demand and takes typed text': async t => {
    await t.open('#home'); await goFloor(t);
    t.ok(await t.eval(() => $('#cmdbar').classList.contains('hidden')));
    await t.eval(() => toggleCmdline());
    t.ok(!(await t.eval(() => $('#cmdbar').classList.contains('hidden'))));
    await t.page.fill('#cmdinput', 'osnap'); await t.page.keyboard.press('Enter');
    t.eq(await t.eval(() => PREFS.osnapOn), false);
    await t.eval(() => { toggleCmdline(); PREFS.osnapOn = true; });
  },
  'panels dock, float, close and reopen': async t => {
    await t.open('#home');
    const where = id => t.eval(id => { const w = dockWhere(id); return w ? (w.float ? 'float' : w.area) : null; }, id);
    t.eq(await where('props'), 'right'); t.eq(await where('pages'), 'left');
    await t.eval(() => dockMove('props', { t: 'area', area: 'bottom' }));
    t.eq(await where('props'), 'bottom');
    await t.eval(() => dockMove('todo', { t: 'float', x: 200, y: 200 }));
    t.eq(await where('todo'), 'float');
    t.ok(await t.page.isVisible('.dfloat'));
    await t.eval(() => closePanel('todo')); t.eq(await where('todo'), null);
    await t.eval(() => showPanel('todo')); t.ok(await where('todo') !== null);
    t.ok(await t.page.isVisible('#tab-todo'));
    await t.page.click('[data-tab="symbols"]');
    t.ok(await t.page.isVisible('#tab-symbols'));
  },
  'workspaces: presets, save under a name, switch back': async t => {
    await t.open('#home');
    await t.eval(() => switchWorkspace('Floor plan'));
    t.eq(await t.eval(() => [PREFS.workspace, dockWhere('symbols').area, dockWhere('props').area]), ['Floor plan', 'left', 'right']);
    await t.eval(() => { dockMove('props', { t: 'area', area: 'bottom' }); saveWorkspace('Mine'); switchWorkspace('Schematic'); });
    t.eq(await t.eval(() => dockWhere('props').area), 'right');
    await t.eval(() => switchWorkspace('Mine'));
    t.eq(await t.eval(() => [PREFS.workspace, dockWhere('props').area, workspaceNames().includes('Mine')]), ['Mine', 'bottom', true]);
    await t.eval(() => { delete PREFS.workspaces.Mine; switchWorkspace('Schematic'); });
  },
};
