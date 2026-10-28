// Keyboard-first dialogs, docked tabs, the to-do page filter, magnetic panels, place on schematic, circuit boxes.
const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
const roomNames = t => t.eval(() => levelOf(page()).rooms.map(r => r.name));

export const tests = {
  'docked tabs wrap onto extra rows at full size instead of squeezing': async t => {
    await t.open();
    await t.eval(() => { dockApply(dLayout([dC([dG(['pages', 'devices', 'symbols', 'todo', 'props'], 'todo')])], [])); DOCK.left.size = 200; dockCommit(); });
    const r = await t.eval(() => {
      const tabs = [...document.querySelectorAll('#dock-left .dtabs .tab')];
      const rows = new Set(tabs.map(b => Math.round(b.getBoundingClientRect().top)));
      const clipped = tabs.filter(b => b.scrollWidth > b.clientWidth + 1).length;
      const box = $('#dock-left .dtabs').getBoundingClientRect();
      const inside = tabs.every(b => { const q = b.getBoundingClientRect(); return q.left >= box.left - 1 && q.right <= box.right + 1; });
      return [tabs.length, rows.size > 1, clipped, inside, document.querySelector('#dock-left .dtabs .tab.active').dataset.dtab];
    });
    t.eq(r, [5, true, 0, true, 'todo']);
  },
  'floating panels stick to each other and join when dropped on a tab bar': async t => {
    await t.open();
    await t.eval(() => { const L = dLayout([dC([dG(['pages'])])], [dC([dG(['props'])])]); L.floats = [{ id: 'fa', x: 420, y: 200, w: 260, h: 300, tabs: ['devices'], active: 'devices' }, { id: 'fb', x: 760, y: 260, w: 240, h: 280, tabs: ['symbols', 'todo'], active: 'symbols' }]; dockApply(L); });
    const bar = id => t.eval(id => { const r = document.querySelector(`.dfloat[data-fid="${id}"] .dgrip`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
    const fl = id => t.eval(id => { const f = DOCK.floats.find(x => x.id === id); return f && [f.x, f.y, f.w, f.h]; }, id);
    // move fb so its left edge comes 7px from fa's right edge (680): it sticks at 680
    let [x, y] = await bar('fb');
    await t.page.mouse.move(x, y); await t.page.mouse.down(); await t.page.mouse.move(x - 73, y + 3, { steps: 5 }); await t.page.mouse.up();
    t.eq((await fl('fb'))[0], 680, 'left edge stuck to the neighbour');
    // its top also lines up with fa when close (200 vs 263 is too far, so it stays)
    t.eq((await fl('fb'))[1], 263);
    // Alt places it freely
    [x, y] = await bar('fb');
    await t.page.keyboard.down('Alt'); await t.page.mouse.move(x, y); await t.page.mouse.down(); await t.page.mouse.move(x + 5, y, { steps: 3 }); await t.page.mouse.up(); await t.page.keyboard.up('Alt');
    t.eq((await fl('fb'))[0], 685, 'Alt turns the magnet off');
    // resizing sticks too: fa's bottom edge (500) dragged to 538 lands on fb's bottom (543)
    await t.eval(() => { const f = DOCK.floats.find(x => x.id === 'fa'); f.h = 300; dockRender(); });
    const s = await t.eval(() => { const r = document.querySelector('.dfloat[data-fid="fa"] .drs.s').getBoundingClientRect(); return [r.left + r.width / 2 - 60, r.top + r.height / 2]; });
    await t.page.mouse.move(s[0], s[1]); await t.page.mouse.down(); await t.page.mouse.move(s[0], s[1] + 38, { steps: 4 }); await t.page.mouse.up();
    t.eq((await fl('fa'))[3], 343, 'bottom edge stuck to the neighbour');
    // drop fa by its bar onto fb's tab bar: fb gets its tabs
    [x, y] = await bar('fa'); const to = await t.eval(() => { const r = document.querySelector('.dfloat[data-fid="fb"] .dtabs').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
    await t.page.mouse.move(x, y); await t.page.mouse.down(); await t.page.mouse.move(to[0], to[1], { steps: 8 }); await t.page.mouse.up();
    t.eq(await t.eval(() => DOCK.floats.map(f => [f.id, f.tabs, f.active])), [['fb', ['symbols', 'todo', 'devices'], 'devices']]);
    // a floating window dropped on a docked tab bar joins the docked group
    await t.eval(() => { DOCK.floats.push({ id: 'fc', x: 500, y: 420, w: 240, h: 200, tabs: [], active: null }); dockRemove('todo'); DOCK.floats.find(f => f.id === 'fc').tabs = ['todo']; DOCK.floats.find(f => f.id === 'fc').active = 'todo'; dockCommit(); });
    [x, y] = await bar('fc'); const dk = await t.eval(() => { const r = document.querySelector('#dock-left .dtabs').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await t.page.mouse.move(x, y); await t.page.mouse.down(); await t.page.mouse.move(dk[0], dk[1], { steps: 8 }); await t.page.mouse.up();
    t.eq(await t.eval(() => [DOCK.left.cols[0].groups[0].tabs, DOCK.floats.length]), [['pages', 'todo'], 1]);
  },
  'place on schematic opens the circuit page, then a page for the room': async t => {
    await t.open('#home');
    const r = await t.eval(() => {
      const sch = P.pages.filter(p => !p.kind && !p.report);
      const devRoom = new Map(); for (const p of sch) for (const o of p.items) if (o.loc && SYM[o.sym] && SYM[o.sym].prefix) devRoom.set(o.loc, (devRoom.get(o.loc) || new Map()).set(p.id, ((devRoom.get(o.loc) || new Map()).get(p.id) || 0) + 1));
      const [room, pages] = [...devRoom.entries()][0]; const best = [...pages.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const fn = sch.find(p => p.fn && p.id !== best);
      const mk = (o) => { const it = makeItem('rlgt', 0, 0, 0, { fn: '', loc: '' }); Object.assign(it, o); P.pool.push(it); return it; };
      const last = sch.find(p => p.id !== best && p !== fn);
      lastSchemId = last.id;
      const a = schematicPageFor(mk({ fn: fn.fn, loc: '' })).fn === fn.fn;
      const b = schematicPageFor(mk({ loc: room })).id;
      const c = schematicPageFor(mk({ loc: 'Nowhere room' })).id;
      return [a, b === best || sch.find(p => p.id === b).loc === room, c === last.id];
    });
    t.eq(r, [true, true, true]);
  },
  'circuit legend is placed by hand, moved, deleted, and not drawn automatically': async t => {
    await t.open('#home');
    await t.eval(() => { const pg = P.pages.find(p => isFloor(p) && p.view === 'level'); delete pg.legend; goPage(pg.id); zoomFit(); });
    const boxes = () => t.eval(() => document.querySelectorAll('#content .legendbox').length);
    t.eq(await boxes(), 0, 'no legend until one is inserted');
    await t.eval(() => insertLegend());
    t.eq(await boxes(), 1);
    const pos = () => t.eval(() => [page().legend.x, page().legend.y]);
    const [x0, y0] = await pos();
    // drag it by its box (sheet mm converted back to plan coordinates for the test helper)
    const p = await t.eval(() => { const L = page().legend; return toPlan(page(), L.x + 20, L.y + 3); });
    const q = await t.eval(([x, y]) => { const pg = page(); const s = fpXform(pg).s; return [x - 60 / s, y + 80 / s]; }, p);
    await t.eval(() => { sel = new Set(); render(); });
    await t.drag(p[0], p[1], q[0], q[1]);
    const [x1, y1] = await pos();
    t.ok(Math.abs(x1 - (x0 - 60)) < 3 && Math.abs(y1 - (y0 + 80)) < 3, `moved: ${x0},${y0} -> ${x1},${y1}`);
    t.eq(await t.eval(() => sel.has('legend:' + page().id)), true, 'selected by clicking it');
    await t.key('Delete');
    t.eq([await boxes(), await t.eval(() => page().legend)], [0, undefined]);
    await t.key('Control+z');
    t.eq(await boxes(), 1, 'undo brings it back');
    // printing keeps it but drops the selection outline
    t.ok(await t.eval(() => pageSVG(page(), { print: true }).includes('legendbox')), 'printed');
    t.ok(await t.eval(() => !!CMDS.insertLegend && DEFAULT_RIBBON.find(x => x.id === 'floor').groups.some(g => g.items.includes('insertLegend'))), 'on the Floor plan tab');
  },
  'New page on the Pages panel makes the kind of page you are on, the arrow picks another kind': async t => {
    await t.open('#home');
    await t.eval(() => goPage(P.pages.find(p => isFloor(p) && p.view === 'level').id));
    t.eq(await t.eval(() => $('#tab-pages .splitbtn [data-act]').dataset.act), 'addFloorPage');
    await t.page.click('#tab-pages .splitbtn [data-act]');
    t.eq(await t.eval(() => $('#dlgtitle').textContent), 'New floor plan page');
    await t.enter();
    t.ok(await t.eval(() => isFloor(page())), 'new floor plan page opened');
    await t.eval(() => goPage(P.pages.find(p => !p.kind && !p.report).id));
    t.eq(await t.eval(() => $('#tab-pages .splitbtn [data-act]').dataset.act), 'addPage');
    await t.page.click('[data-newpagemenu]');
    t.eq(await t.eval(() => [...document.querySelectorAll('#dropdown .dd')].map(d => [d.textContent, d.dataset.act])), [['Schematic page', 'addPage'], ['Floor plan page', 'addFloorPage'], ['Panel layout page', 'newLayoutPage'], ['Custom report', 'newCustomReport']]);
    await t.page.click('#dropdown [data-act="addFloorPage"]');
    t.eq(await t.eval(() => [$('#dlg').open, $('#dlgtitle').textContent]), [true, 'New floor plan page']);
  },
  'pages filter: only pages with an open to-do': async t => {
    await t.open('#home');
    const r = await t.eval(() => {
      const ckt = P.pages.find(p => !isFloor(p) && p.items.length), other = P.pages.find(p => !isFloor(p) && p !== ckt && !p.report);
      const it = ckt.items.find(i => SYM[i.sym] && SYM[i.sym].prefix);
      P.todos = [{ id: 't1', text: 'check this', done: false, created: '', link: it.id }, { id: 't2', text: 'page note', done: false, created: '', link: 'page:' + other.id }, { id: 't3', text: 'old', done: true, created: '', link: 'page:' + P.pages.find(p => isFloor(p)).id }];
      const pl = placeOf(it.id); render();
      return [ckt.id, other.id, pl ? P.pages.filter(p => isFloor(p) && levelOf(p) === pl.lv && p.view === 'level').map(p => p.id) : []];
    });
    await t.page.click('[data-navtodo]');
    const shown = await t.eval(() => [...document.querySelectorAll('#tab-pages .navitem')].map(e => e.dataset.page));
    t.ok(shown.includes(r[0]) && shown.includes(r[1]), 'linked device page and linked page shown');
    for (const id of r[2]) t.ok(shown.includes(id), 'floor plan with the placed device shown');
    t.eq(shown.length, 2 + r[2].length, 'nothing else, done to-dos ignored');
    t.eq(await t.eval(() => $('[data-navtodo] .tcount').textContent), String(2 + r[2].length));
    // finishing a to-do drops its page
    await t.eval(() => commit(() => { P.todos.find(x => x.id === 't2').done = true; }));
    t.ok(!(await t.eval(() => [...document.querySelectorAll('#tab-pages .navitem')].map(e => e.dataset.page))).includes(r[1]));
    await t.page.click('[data-navtodo]');
    t.ok(await t.eval(() => document.querySelectorAll('#tab-pages .navitem, #tab-pages .navnode').length > 3), 'filter off shows the tree again');
  },
  'room name: place by two clicks, type, Enter, no mouse on the box': async t => {
    await t.open('#home'); await goFloor(t);
    await t.eval(() => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = []; render(); setMode('room'); });
    await t.click(40, 40); await t.click(120, 100);
    t.ok(await t.eval(() => $('#dlg').open), 'name box open');
    t.ok(await t.eval(() => document.activeElement && document.activeElement.name === 'name'), 'name field has focus');
    await t.page.keyboard.type('Pantry'); await t.enter();
    t.eq(await roomNames(t), ['Pantry']);
    // dragging a room works the same way
    await t.drag(140, 40, 220, 100);
    await t.page.keyboard.type('Laundry'); await t.enter();
    t.eq(await roomNames(t), ['Pantry', 'Laundry']);
  },
  'every dialog focuses its first field with the text selected, Enter confirms': async t => {
    await t.open();
    await t.eval(() => projectProps());
    t.eq(await t.eval(() => [document.activeElement.name, document.activeElement.selectionStart, document.activeElement.selectionEnd === document.activeElement.value.length]), ['name', 0, true]);
    await t.page.keyboard.type('Typed name'); await t.enter();
    t.eq(await t.eval(() => P.name), 'Typed name');
    // a dialog with only a check box still confirms with Enter
    await t.eval(() => renumberDlg());
    t.ok(await t.eval(() => $('#dlg').contains(document.activeElement)), 'focus inside the dialog');
    await t.enter();
  },
};
