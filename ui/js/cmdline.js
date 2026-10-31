// ---------- command line and typed input ----------
// While a floor plan drawing command waits for a point, typing starts a length: 12'6" (along the cursor direction),
// @12',8' (across and up), 12'<45 (distance and angle), #12',8' (from the lower left corner). Enter accepts it.
// With the command line switched on, short commands with aliases can be typed as well (RM = room, ZE = zoom extents).
const CMDHIST = []; let cmdHi = 0;

// what the active floor plan command is waiting for: { kind: place | box | circle | poly, last: previous point or null }
function fpAwaiting() {
  const pg = page(); if (!P || !pg || !isFloor(pg) || !levelOf(pg)) return null;
  if (gripOp) return { kind: 'grip', last: gripOp.base };
  if (DRAW && mode.startsWith('d:')) return { kind: 'draw', last: drawLast(DRAW) };
  if (mode === 'fpplace') return { kind: 'place', last: null };
  if (BOX_MODES.includes(mode)) return { kind: mode === 'roomcirc' ? 'circle' : 'box', last: fbox && !fbox.select ? fbox.start : null };
  if (mode === 'roompoly') return { kind: 'poly', last: fpoly && fpoly.length ? fpoly[fpoly.length - 1] : null };
  return null;
}
function fpPromptText() {
  const aw = fpAwaiting(); if (!aw) return 'Command:';
  if (aw.kind === 'grip') return gripPrompt();
  if (aw.kind === 'draw') return DRAW.T.name.toUpperCase() + ': ' + drawPrompt();
  if (aw.kind === 'place') return 'Specify placement point (#x,y):';
  if (aw.kind === 'circle') return aw.last ? 'Specify diameter:' : 'Specify first point (x,y):';
  if (aw.kind === 'box') return aw.last ? 'Specify opposite corner (width,height or @dx,dy):' : 'Specify first corner (x,y):';
  return aw.last ? 'Specify next point (length, @dx,dy or length<angle, Enter to finish):' : 'Specify first point (x,y):';
}

// ---------- typed points ----------
function fpTypedPoint(pg, lv, aw, t) {
  let s = t.trim(), abs = false;
  if (s[0] === '#') { abs = true; s = s.slice(1); } else if (s[0] === '@') s = s.slice(1);
  const last = aw.last; if (!last) abs = true;
  const L = x => parseLength(x), toP = mm => toPlanMm(lv, mm);
  let m;
  if ((m = /^(.+?)<(.+)$/.exec(s))) {
    const d = L(m[1]), ang = parseFloat(m[2]); if (d == null || !isFinite(ang) || !last) return null;
    return polarPt(last, toP(d), ang);
  }
  if (s.includes(',')) {
    const parts = s.split(','); if (parts.length !== 2 || aw.kind === 'circle') return null;
    const x = L(parts[0]), y = L(parts[1]); if (x == null || y == null) return null;
    if (abs) return realToPlan(pg, [x, y]);
    let dx = x, dy = y;
    if (aw.kind === 'box' && t.trim()[0] !== '@' && !/^\s*-/.test(parts[0]) && !/^\s*-/.test(parts[1])) {
      // width,height: the box grows toward the cursor (right and down when the cursor has not moved)
      const aim = fAim || last; dx = Math.abs(x) * (aim[0] >= last[0] ? 1 : -1); dy = Math.abs(y) * (aim[1] >= last[1] ? -1 : 1);
    }
    return [last[0] + toP(dx), last[1] - toP(dy)];
  }
  const d = L(s); if (d == null || !last) return null;
  const aim = fAim || [last[0] + 1, last[1]];
  if (aw.kind === 'circle') { const dd = toP(Math.abs(d)); return [last[0] + (aim[0] >= last[0] ? 1 : -1) * dd, last[1] + (aim[1] >= last[1] ? 1 : -1) * dd]; }
  if (aw.kind === 'box') return null;
  const tp = trackPoint(last, aim).p; const ang = ptDist(last, tp) < 1e-6 ? 0 : ptAngle(last, tp);
  return polarPt(last, toP(d), ang);
}
function fpAcceptPoint(pg, lv, aw, q) {
  q = [r2(q[0]), r2(q[1])];
  if (aw.kind === 'place') { fpPlaceAt(pg, lv, q); return; }
  if (aw.kind === 'poly') { fpPolyAdd(pg, q, null); return; }
  if (!aw.last) { fpBoxStart(pg, q); fbox.armed = true; return; }
  fbox.cur = q; fbox.armed = true; fpFinishBox(pg);
}
// returns true when the text was meant as drawing input
function fpTyped(text) {
  const aw = fpAwaiting(); if (!aw) return false;
  if (aw.kind === 'grip') return gripTyped(text);
  if (aw.kind === 'draw') return drawTyped(text);
  const pg = page(), lv = levelOf(pg); const t = String(text || '').trim();
  if (aw.kind === 'poly' && (!t || /^c(lose)?$/i.test(t))) {
    if (fpoly && fpoly.length >= 3) { finishPoly(pg); return true; }
    if (fpoly) { flash('A room needs at least three corners'); return true; }
    return !!t;
  }
  if (!t) return false;
  const q = fpTypedPoint(pg, lv, aw, t);
  if (!q) { flash(`Could not read "${t}". Try 12'6", @12',8' or 10'<45`); return true; }
  fpAcceptPoint(pg, lv, aw, q); return true;
}

// ---------- the command bar ----------
function cmdSync() {
  const bar = $('#cmdbar'), inp = $('#cmdinput'); if (!bar) return;
  const active = document.activeElement === inp || !!inp.value;
  bar.classList.toggle('hidden', !(PREFS.cmdline || active));
  $('#cmdprompt').textContent = fpPromptText();
}
function cmdType(ch) { const inp = $('#cmdinput'); $('#cmdbar').classList.remove('hidden'); inp.focus(); inp.value += ch; $('#cmdprompt').textContent = fpPromptText(); }
function cmdFocus() { $('#cmdbar').classList.remove('hidden'); $('#cmdinput').focus(); }
function toggleCmdline() { PREFS.cmdline = !PREFS.cmdline; savePrefs(); cmdSync(); renderToolbar(); if (PREFS.cmdline) cmdFocus(); else $('#cmdinput').blur(); }
function cmdDone() { const inp = $('#cmdinput'); inp.value = ''; inp.blur(); cmdSync(); }
function cmdSubmit(text) {
  text = String(text || '').trim();
  if (text) { CMDHIST.push(text); if (CMDHIST.length > 50) CMDHIST.shift(); }
  cmdHi = CMDHIST.length;
  const aw = fpAwaiting();
  if (aw && (aw.kind === 'draw' || aw.kind === 'grip' || !/^[a-z]/i.test(text) || (aw.kind === 'poly' && /^c(lose)?$/i.test(text)))) { if (fpTyped(text)) return; }
  if (!text) return;
  cmdExec(text);
}
$('#cmdinput').addEventListener('keydown', e => {
  const inp = e.target;
  if (e.key === 'F12') { e.preventDefault(); e.stopPropagation(); toggleDyn(); return; }
  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const t = inp.value; inp.value = ''; cmdSubmit(t); if (!PREFS.cmdline && document.activeElement === inp && !fpAwaiting()) cmdDone(); cmdSync(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (inp.value) inp.value = ''; else { cmdDone(); escapeCommand(); } cmdSync(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (cmdHi > 0) { cmdHi--; inp.value = CMDHIST[cmdHi] || ''; } }
  else if (e.key === 'ArrowDown') { e.preventDefault(); if (cmdHi < CMDHIST.length) { cmdHi++; inp.value = CMDHIST[cmdHi] || ''; } }
  else e.stopPropagation();
});
$('#cmdinput').addEventListener('blur', () => setTimeout(cmdSync, 0));
$('#cmdinput').addEventListener('focus', cmdSync);

// ---------- commands and aliases ----------
// [name, aliases, description, function(argument text)]. Later tools register theirs with registerCommand().
const COMMANDS = [];
function registerCommand(name, aliases, desc, fn) { const c = { name, aliases: aliases.map(a => a.toUpperCase()), desc, fn }; const i = COMMANDS.findIndex(x => x.name === name); if (i >= 0) COMMANDS[i] = c; else COMMANDS.push(c); }
const needFloor = () => { if (isFloor(page())) return true; flash('That command works on floor plan pages'); return false; };
const goMode = m => () => { if (needFloor()) setMode(m); };
registerCommand('SELECT', ['SEL'], 'Select objects', () => setMode('select'));
registerCommand('ROOM', ['RM'], 'Draw a room (box)', goMode('room'));
registerCommand('ROOMSHAPE', ['RS'], 'Draw a room shape (click the corners)', goMode('roompoly'));
registerCommand('ROOMOVAL', ['RV'], 'Draw an oval room', goMode('roomoval'));
registerCommand('ROOMROUND', ['RR'], 'Draw a round room', goMode('roomcirc'));
registerCommand('AREA', [], 'Draw the area a page shows', goMode('area'));
registerCommand('ZOOMEXTENTS', ['ZE', 'FIT'], 'Zoom to the page', () => zoomFit());
registerCommand('ZOOMWINDOW', ['ZW'], 'Zoom to a box', () => zoomWindow());
registerCommand('ZOOMPREVIOUS', ['ZP'], 'Previous view', () => zoomPrev());
registerCommand('ZOOMIN', ['ZI'], 'Zoom in', () => zoomAt(1.25));
registerCommand('ZOOMOUT', ['ZO'], 'Zoom out', () => zoomAt(0.8));
registerCommand('UNDO', ['U'], 'Undo', () => undo());
registerCommand('REDO', [], 'Redo', () => redo());
registerCommand('ROTATE', ['RO'], 'Rotate the selection', () => rotateSel());
registerCommand('MIRROR', ['MI'], 'Mirror the selection', () => mirrorSel());
registerCommand('ERASE', ['E', 'DELETE'], 'Delete the selection', () => delSel());
registerCommand('COPY', ['CO'], 'Copy the selection', () => copySel());
registerCommand('PASTE', ['PA'], 'Paste', () => paste());
registerCommand('SELECTALL', ['SA'], 'Select everything on the page', () => ACTIONS.selAll());
registerCommand('SNAP', ['SN'], 'Snap to grid on or off', () => toggleSnap());
registerCommand('GRID', [], 'Show or hide the grid', () => ACTIONS.toggleGrid());
registerCommand('OSNAP', ['OS'], 'Object snaps on or off', () => toggleOsnap());
registerCommand('ORTHO', ['OR'], 'Ortho on or off', () => toggleOrtho());
registerCommand('POLAR', ['PT'], 'Polar tracking on or off', () => togglePolar());
registerCommand('DSETTINGS', ['DS'], 'Drafting settings (object snaps, ortho, polar)', () => osnapDlg());
registerCommand('UNITS', ['UN'], 'Units: UNITS metric or UNITS imperial', a => {
  const v = String(a || '').trim().toLowerCase();
  if (!v) { projectProps(); return; }
  if (/^(m|metric)/.test(v)) { setUnits('metric'); flash('Metric units'); } else if (/^(i|imp|ft|feet)/.test(v)) { setUnits('imperial'); flash('Feet and inches'); } else flash('Use UNITS metric or UNITS imperial');
});
registerCommand('SCALE', ['SC'], 'Drawing scale of the level: SCALE 1/4"=1\' or SCALE 1:50', a => {
  if (!needFloor()) return; const lv = levelOf(page());
  if (!String(a || '').trim()) { scaleDlg(lv); return; }
  const r = parseScale(a); if (!r) { flash('Could not read that scale. Try 1/4"=1\' or 1:50'); return; }
  setLevelScale(lv, r); flash('Scale ' + formatScale(r));
});
registerCommand('SAVE', [], 'Save the project', () => save());
registerCommand('OPEN', [], 'Open a project', () => openFile());
registerCommand('NEW', [], 'New project', () => fileNew());
registerCommand('PRINT', ['PLOT'], 'Print or export the pages', () => ACTIONS.printAll());
registerCommand('FIND', [], 'Find and replace', () => findDlg());
registerCommand('COMMANDLINE', ['CMD'], 'Show or hide the command line', () => toggleCmdline());
registerCommand('HELP', ['?'], 'List the commands', () => cmdHelp());
function cmdFind(word) {
  const w = word.toUpperCase();
  return COMMANDS.find(c => c.name === w) || COMMANDS.find(c => c.aliases.includes(w)) || (w.length > 1 ? COMMANDS.filter(c => c.name.startsWith(w)).length === 1 && COMMANDS.find(c => c.name.startsWith(w)) : null);
}
function cmdExec(text) {
  const m = /^(\S+)\s*(.*)$/.exec(text.trim()); if (!m) return;
  const c = cmdFind(m[1]);
  if (!c) { flash(`Unknown command "${m[1]}". Type HELP for the list.`); return; }
  c.fn(m[2]); flash(c.name);
}
function cmdHelp() {
  const rows = COMMANDS.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<b>${esc(c.name)}${c.aliases.length ? ' (' + c.aliases.map(esc).join(', ') + ')' : ''}</b><span>${esc(c.desc)}</span>`).join('');
  dialog('Commands', [], null, 'OK', `<div class="note" style="margin-bottom:6px">Turn the command line on in View. Press Enter to type a command; while drawing on a floor plan, just start typing a length.</div><div class="kbd" style="grid-template-columns:230px 1fr">${rows}</div>`);
}
