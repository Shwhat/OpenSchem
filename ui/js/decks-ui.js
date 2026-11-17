// ---------- decks: commands, dialogs and Properties ----------
Object.assign(RI, {
  deck: '<svg viewBox="0 0 20 20"><path d="M2 9h16v2H2z" fill="#c49a63" stroke="#8a6d1d" stroke-width="0.9"/><path d="M4 11v6M10 11v6M16 11v6" stroke="#8a6d1d" stroke-width="1.6"/><path d="M3 9V4M8 9V4M13 9V4M18 9V4M3 5h15" stroke="#2b3442" stroke-width="0.9"/></svg>',
  deckstair: '<svg viewBox="0 0 20 20"><path d="M2 17h4v-4h4V9h4V5h4" fill="none" stroke="#8a6d1d" stroke-width="1.6"/><path d="M14 13.5h5M16.5 11v5" stroke="#2f7d32" stroke-width="1.5"/></svg>',
  decksec: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="10" height="7" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1"/><rect x="2" y="10" width="15" height="7" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1"/><path d="M15 3.5h4M17 1.5v4" stroke="#2f7d32" stroke-width="1.5"/></svg>',
  deckfrom: '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="6" fill="#dbe6f7" stroke="#2b3442" stroke-width="1.1"/><path d="M3 8v9h14V8" fill="#f4e3c0" stroke="#8a6d1d" stroke-width="1.1"/><path d="M7 8v9M11 8v9M15 8v9" stroke="#8a6d1d" stroke-width="0.8"/></svg>',
  hardware: '<svg viewBox="0 0 20 20"><path d="M4 3h12v14H4z" fill="#fff" stroke="#2b3442" stroke-width="1.1"/><path d="M7 7h6M7 10h6M7 13h4" stroke="#2b3442" stroke-width="1"/><circle cx="14.5" cy="14.5" r="2.5" fill="#dbe6f7" stroke="#2b3442" stroke-width="0.9"/></svg>',
});
Object.assign(CMDS, {
  newDeck: ['New deck', 'deck', 'newDeck'], deckFromFloor: ['Deck', 'deckfrom', 'deckFromFloor'], deckFromFrame: ['Deck on this wall', 'deckfrom', 'deckFromFrame'],
  deckSizeDlg: ['Size and height', 'decksec', 'deckSizeDlg'], deckFrameDlg: ['Framing', 'ffloor', 'deckFrameDlg'], deckDeckingDlg: ['Decking', 'deck', 'deckDeckingDlg'],
  deckStairsDlg: ['Stairs', 'deckstair', 'deckStairsDlg'], deckRailDlg: ['Guards', 'fwall', 'deckRailDlg'],
  deckAddStairs: ['Add stairs', 'deckstair', 'deckAddStairs'], deckAddSection: ['Add section', 'decksec', 'deckAddSection'], deckGoHardware: ['Hardware list', 'hardware', 'deckGoHardware'],
});
Object.assign(ACTIONS, {
  newDeck: () => newDeckDlg(), deckFromFloor, deckFromFrame, deckGoHardware,
  deckSizeDlg: () => frameSectionDlg('dsize'), deckFrameDlg: () => frameSectionDlg('dframe'), deckDeckingDlg: () => frameSectionDlg('ddeck'), deckStairsDlg: () => frameSectionDlg('dstairs'), deckRailDlg: () => frameSectionDlg('drail'),
  deckAddStairs: () => deckEdit(b => { b.stairs.push(newDeckStair(b, { at: Math.max(0, b.plats[0].w / 2 - (lumberKey() === 'metric' ? 500 : 24 * IN_MM)) })); }, 'Stairs added to the front'),
  deckAddSection: () => deckEdit(b => { const p = b.plats[b.plats.length - 1]; b.plats.push({ id: uid(), x: p.x, y: p.y + p.d, w: Math.min(p.w, lumberKey() === 'metric' ? 3000 : 120 * IN_MM), d: lumberKey() === 'metric' ? 2400 : 96 * IN_MM, h: Math.max(lumberKey() === 'metric' ? 300 : 12 * IN_MM, p.h - (lumberKey() === 'metric' ? 600 : 24 * IN_MM)) }); }, 'Lower section added in front, joined by steps'),
  deckRemoveStairs: () => deckEdit(b => { b.stairs.pop(); }, 'Stairs removed'), deckRemoveSection: () => deckEdit(b => { if (b.plats.length > 1) { b.plats.pop(); b.stairs = b.stairs.filter(s => s.plat < b.plats.length); } }, 'Section removed'),
});
function deckEdit(fn, msg) {
  const b = bldOf(page()); if (!isDeck(b)) { flash('Open a deck page first'); return; }
  commit(() => { fn(b); syncFramePages(b); if (!P.pages.includes(page())) curId = P.pages.find(p => p.bld === b.id).id; }); flash(msg);
}
function deckGoHardware() {
  const b = bldOf(page()) || (P.buildings || []).find(isDeck); if (!isDeck(b)) { flash('No decks in the project yet'); return; }
  const r = REPORTS.find(x => x.report === 'hardware' && x.bld === b.id); if (r) goPage(r.id); else flash('The hardware list is turned off in Project properties, or the deck has a problem');
}

// ---------- fields ----------
const autoLen = (k, label, autoText) => ({ k, label, type: 'text', get: b => getPath(b, k) >= 0 ? fmtCut(getPath(b, k)) : autoText, set: (b, raw) => { const v = parseLength(raw); setPath(b, k, raw && !/sugg|auto/i.test(raw) && v != null && v >= 0 ? v : -1); return ''; } });
function deckFields(b, section) {
  const F = [], f = (k, label, type, opts, extra) => F.push(Object.assign({ k, label, type, opts }, extra || {}));
  const sz = (from, to) => LC().sizes.map((s, i) => [String(i), s]).slice(from, to + 1);
  if (section === 'dsize') {
    f('name', 'Name', 'text'); f('kind', 'Kind', 'sel', DECK_KINDS); f('species', 'Lumber species', 'sel', DCA6.species);
    b.plats.forEach((p, i) => {
      const pre = b.plats.length > 1 ? `Section ${i + 1} ` : '';
      if (i) { f(`plats.${i}.x`, pre + 'from the left', 'len'); f(`plats.${i}.y`, pre + 'out from the house', 'len'); }
      f(`plats.${i}.w`, pre + (i ? 'width' : 'Width (along the house)'), 'len'); f(`plats.${i}.d`, pre + (i ? 'depth' : 'Depth (out from the house)'), 'len'); f(`plats.${i}.h`, pre + (i ? 'height' : 'Height of the decking above grade'), 'len');
    });
  } else if (section === 'dframe') {
    f('joist', 'Joists', 'num', [['-1', 'Suggested from DCA 6']].concat(sz(1, 4)));
    f('sp', 'Joist spacing', 'num', [['-1', 'From the decking']].concat(LC().sp.map(v => [String(v), fmtCut(v) + ' on center'])));
    F.push(autoLen('cant', 'Joist cantilever', 'suggested'));
    f('beam.ply', 'Beam plies', 'num', [['-1', 'Suggested'], ['2', 'Two'], ['3', 'Three']]);
    f('beam.size', 'Beam lumber', 'num', [['-1', 'Suggested']].concat(sz(1, 4)));
    F.push({ k: 'beam.posts', label: 'Posts per beam', type: 'text', get: x => x.beam.posts >= 2 ? String(x.beam.posts) : 'suggested', set: (x, raw) => { const n = Math.round(+raw); x.beam.posts = n >= 2 ? n : -1; return ''; } });
    f('fast', 'Ledger fasteners', 'sel', [['lag', '1/2" lag screws'], ['bolt', '1/2" through-bolts']]);
    f('frost', 'Footing depth below grade', 'len');
  } else if (section === 'ddeck') {
    f('dk.mat', 'Decking', 'sel', Object.entries(DECK_MATS).map(([k, v]) => [k, v[0]]));
    f('dk.lay', 'Layout', 'sel', DECK_LAYS); f('dk.gap', 'Gap between boards', 'len');
    if (b.dk.mat === 'comp') f('dk.compSp', 'Composite: most joist spacing', 'len');
  } else if (section === 'dstairs') {
    b.stairs.forEach((s, i) => {
      const pre = `Stairs ${i + 1} `;
      if (b.plats.length > 1) f(`stairs.${i}.plat`, pre + 'from section', 'num', b.plats.map((_, j) => [String(j), 'Section ' + (j + 1)]));
      f(`stairs.${i}.side`, pre + 'side', 'sel', [['front', 'Front'], ['left', 'Left'], ['right', 'Right'], ['back', 'Back']]);
      f(`stairs.${i}.at`, pre + 'from the start of the side', 'len'); f(`stairs.${i}.w`, pre + 'width', 'len');
    });
  } else if (section === 'drail') {
    f('rail.mode', 'Guards', 'sel', [['auto', 'Where the deck is over 30" high'], ['on', 'Always'], ['off', 'None']]);
    f('rail.h', 'Guard height', 'len'); f('rail.postSp', 'Most post spacing', 'len');
  }
  return F;
}
function renderDeckProps(pg, b) {
  const el = $('#props'), M = frameModel(b);
  const grp = section => { const fs = frameFields(b, section); if (!fs.length) return ''; return `<div class="pgrp"><h4>${esc(FRAME_SECTIONS[section])}</h4>${fs.map(fd => {
    const id = 'fb.' + fd.k;
    if (fd.type === 'check') return `<div class="prow"><label>${esc(fd.label)}</label><input type="checkbox" data-k="${esc(id)}" ${fieldGet(b, fd) ? 'checked' : ''} style="width:auto"></div>`;
    if (fd.opts) return row(id, esc(fd.label), '', 'select', fd.opts.map(([v, l]) => `<option value="${esc(v)}" ${String(fieldGet(b, fd)) === v || (fd.type === 'num' && Math.abs(+v - fieldGet(b, fd)) < 0.01) ? 'selected' : ''}>${esc(l)}</option>`).join(''));
    return row(id, esc(fd.label), fieldShow(b, fd));
  }).join('')}</div>`; };
  const errs = M.errs && M.errs.length ? `<div class="pgrp"><h4>Problems</h4>${M.errs.map(e => `<div class="note" style="color:var(--err)">${esc(e)}</div>`).join('')}</div>` : '';
  const checks = M.warns && M.warns.length ? `<div class="pgrp"><h4>Over the tables</h4>${M.warns.map(e => `<div class="note" style="color:var(--warn)">${esc(e)}</div>`).join('')}</div>` : '';
  const sum = M.boards ? `<div class="note">${M.plats.map(m => `${sizeName(m.js)} joists at ${fmtCut(M.sp)}, ${m.best.ply}-${sizeName(m.best.size)} beam${m.beams.length > 1 ? 's' : ''}, ${m.beams.length * m.best.n} footings`).join('; ')}. ${M.boards.length} boards to buy. Suggestions follow the AWC DCA 6 tables; the local building department decides.</div>` : '';
  el.innerHTML = `<div class="ident">${esc(b.name)}</div><div class="sub">Deck · ${esc(FRAME_VIEWS[pg.view])}</div>${sum}
    <div class="btnrow"><button class="btn small" data-act="deckAddStairs">Add stairs</button><button class="btn small" data-act="deckAddSection">Add section</button>${b.stairs.length ? '<button class="btn small" data-act="deckRemoveStairs">Remove stairs</button>' : ''}${b.plats.length > 1 ? '<button class="btn small" data-act="deckRemoveSection">Remove section</button>' : ''}<button class="btn small" data-act="frameGoLumber">Lumber list</button><button class="btn small" data-act="deckGoHardware">Hardware list</button></div>
    ${errs}${checks}${['dsize', 'dframe', 'ddeck', 'dstairs', 'drail', 'lumber'].map(grp).join('')}`;
}

// ---------- new decks ----------
function newDeckDlg(from = {}) {
  const m = lumberKey() === 'metric', d0 = newDeck();
  const L = v => fmtCut(v);
  dialog('New deck', [['name', 'Name', from.name || 'Deck ' + ((P.buildings || []).filter(isDeck).length + 1)], ['kind', 'Kind', from.kind || 'ledger', 'select', DECK_KINDS],
    ['shape', 'Shape', 'rect', 'select', [['rect', 'Rectangle'], ['L', 'L-shape'], ['levels', 'Two levels joined by steps']]],
    ['w', 'Width (along the house)', L(from.w || d0.plats[0].w)], ['d', 'Depth (out from the house)', L(from.d || d0.plats[0].d)], ['h', 'Height of the decking above grade', L(from.h || d0.plats[0].h)],
    ['w2', 'Second section width', L(m ? 2400 : 96 * IN_MM)], ['d2', 'Second section depth', L(m ? 2400 : 96 * IN_MM)], ['h2', 'Lower level height', L(m ? 300 : 12 * IN_MM)],
    ['species', 'Lumber species', 'sp', 'select', DCA6.species], ['mat', 'Decking', '54', 'select', Object.entries(DECK_MATS).map(([k, v]) => [k, v[0]])], ['lay', 'Decking layout', 'square', 'select', DECK_LAYS],
    ['stairs', 'Start with stairs at the front', true, 'check']], v => {
    const len = k => { const x = parseLength(v[k]); if (x == null || x <= 0) { alert(`Could not read "${v[k]}" as a length.`); return null; } return x; };
    const w = len('w'), d = len('d'), h = len('h'); if (w == null || d == null || h == null) return false;
    const b = newDeck({ name: v.name || 'Deck', kind: v.kind, w, d, h, link: from.link || null });
    if (v.shape !== 'rect') {
      const w2 = len('w2'), d2 = len('d2'), h2 = v.shape === 'levels' ? len('h2') : h; if (w2 == null || d2 == null || h2 == null) return false;
      b.plats.push({ id: uid(), x: Math.max(0, w - w2), y: d, w: w2, d: d2, h: h2 });
    }
    b.species = v.species; b.dk.mat = v.mat; b.dk.lay = v.lay;
    if (v.stairs) { const last = b.plats.length - 1; b.stairs.push(newDeckStair(b, { plat: last, at: Math.max(0, b.plats[last].w / 2 - (m ? 500 : 24 * IN_MM)) })); }
    commit(() => { P.buildings.push(b); syncFramePages(b); sortPages(); curId = P.pages.find(p => p.bld === b.id && p.view === 'dframe').id; sel.clear(); });
    zoomFit(); flash('Deck ' + b.name + ' added');
  }, 'Create', '<div class="note">Joists, beams, posts and footings are suggested from the AWC DCA 6 span tables for the species; change them on the deck\'s Framing settings. An L-shape adds a second section at the same height in front of the right side; two levels add a lower section there, joined by steps. Suggestions follow the tables; the local building department has the final say.</div>');
}
function deckFromFloor() {
  const pg = page(); if (!isFloor(pg)) { flash('Select a room or a wall on a floor plan first'); return; }
  const fs = [...sel].map(findFp).filter(Boolean);
  const room = fs.find(f => f.kind === 'room'), wl = fs.find(f => f.kind === 'shape' && isWall(f.s));
  if (room) { const k = lvScale(room.lv), bb = bboxPts(roomPoly(room.r)); newDeckDlg({ name: room.r.name || 'Deck', kind: 'free', w: (bb[2] - bb[0]) * k, d: (bb[3] - bb[1]) * k, link: { kind: 'room', level: room.lv.id, room: room.r.id } }); return; }
  if (wl) { newDeckDlg({ name: 'Deck', kind: 'ledger', w: wallAxis(wl.s).len * lvScale(wl.lv), link: { kind: 'wall', level: wl.lv.id, wall: wl.s.id } }); return; }
  flash('Select a room (drawn where the deck goes) or the house wall for the ledger');
}
function deckFromFrame() {
  const pg = page(), b = bldOf(pg); if (!b || isDeck(b) || b.mode !== 'building' || !WALL_KEYS.includes(pg.view)) { flash('Open a building wall elevation first'); return; }
  const M = frameModel(b), fw = M.walls && M.walls.find(w => w.key === pg.view); if (!fw) { flash('Fix the framing problems first'); return; }
  newDeckDlg({ name: b.name + ' deck', kind: 'ledger', w: fw.len + (pg.view === 'right' || pg.view === 'left' ? 2 * M.WD : 0), h: M.floor ? M.floor.height : undefined, link: { kind: 'bwall', bld: b.id, wall: pg.view } });
}
