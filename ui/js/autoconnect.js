// ---------- automatic connections ----------
// When a symbol is placed or moved, a connection point that faces another symbol's connection point on the same
// line (pointing back at it, with nothing nearer in between) is joined with a straight connection. These wires are
// marked auto: when a moved symbol leaves them crooked they are removed and connected again. Toggle with PREFS.autoConnect.
function connFacing(it) {
  const d = SYM[it.sym]; if (!d || it.sym === 'text' || d.role === 'ip' || d.role === 'bar' || d.edge) return [];
  const box = symBox(it);
  return symConns(it).map(([cx, cy], i) => {
    const [lx, ly] = connDir(box, cx, cy); const [dx, dy] = xf(it, lx, ly); const [rx, ry] = xf(it, cx, cy);
    return { x: r2(it.x + rx), y: r2(it.y + ry), dx: Math.round(dx), dy: Math.round(dy), i, it };
  });
}
const wireAt = (pg, x, y) => pg.wires.some(w => onPoly([x, y], w.pts));
// segments [[x1, y1], [x2, y2]] that automatic connection would draw for these items (not yet added)
function autoSegments(pg, items, extra) {
  const all = []; for (const it of pg.items.concat(extra || [])) if (objShown(it)) all.push(...connFacing(it));
  const ids = new Set(items.map(i => i.id)); const segs = []; const seen = new Set();
  for (const c of all) {
    if (!ids.has(c.it.id) || (!c.dx && !c.dy) || wireAt(pg, c.x, c.y)) continue;
    let best = null, bd = Infinity;
    for (const o of all) {
      if (o.it === c.it) continue;
      const along = c.dx ? (o.y === c.y ? (o.x - c.x) * c.dx : -1) : (o.x === c.x ? (o.y - c.y) * c.dy : -1);
      if (along <= 0.5 || along >= bd) continue;
      bd = along; best = o;
    }
    // also stop at a symbol body in the way
    if (!best || best.dx !== -c.dx || best.dy !== -c.dy || wireAt(pg, best.x, best.y)) continue;
    const between = pg.items.concat(extra || []).some(o => o !== c.it && o !== best.it && o.sym !== 'text' && SYM[o.sym] && !SYM[o.sym].edge && segHitsBox([c.x, c.y], [best.x, best.y], itemBox(o)));
    if (between) continue;
    const k = [c.x, c.y, best.x, best.y].join(','), k2 = [best.x, best.y, c.x, c.y].join(',');
    if (seen.has(k) || seen.has(k2)) continue; seen.add(k);
    const seg = [[c.x, c.y], [best.x, best.y]]; if (seg[0][1] > seg[1][1] || seg[0][0] > seg[1][0]) seg.reverse(); segs.push(seg);
  }
  return segs;
}
function segHitsBox(a, b, bx) {
  const [x0, y0, x1, y1] = bx;
  if (a[0] === b[0]) { const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]); return a[0] > x0 && a[0] < x1 && hi > y0 + 0.01 && lo < y1 - 0.01; }
  const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]); return a[1] > y0 && a[1] < y1 && hi > x0 + 0.01 && lo < x1 - 0.01;
}
// inside commit(): add the automatic connections for these items
function autoConnect(pg, items) {
  if (!PREFS.autoConnect || !items.length || isFloor(pg) || isLayout(pg) || pg.report) return 0;
  const segs = autoSegments(pg, items);
  for (const pts of segs) pg.wires.push(onActiveLayer(Object.assign({ id: uid(), pts, auto: true }, isPneuPage(pg) ? newTubeProps() : autoWire(pg, pts) || {})));
  return segs.length;
}
// after moving: drop automatic connections the move left crooked, then connect again
function reAutoConnect(pg, items) {
  if (!PREFS.autoConnect || !items.length) return;
  const pts = new Set(); for (const it of items) for (const c of connPts(it)) pts.add(c.x + ',' + c.y);
  pg.wires = pg.wires.filter(w => !(w.auto && !sel.has(w.id) && (w.pts.length !== 2 || (w.pts[0][0] !== w.pts[1][0] && w.pts[0][1] !== w.pts[1][1])) && [w.pts[0], w.pts[w.pts.length - 1]].some(p => pts.has(p.join(',')))));
  autoConnect(pg, items);
}
function toggleAutoConnect() { PREFS.autoConnect = !PREFS.autoConnect; savePrefs(); renderToolbar(); flash('Automatic connections ' + (PREFS.autoConnect ? 'on' : 'off')); }
