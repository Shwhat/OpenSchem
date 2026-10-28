// ---------- cables ----------
function nextCableTag() {
  let max = 0; for (const pg of P.pages) for (const c of pg.cables || []) { const m = /^W(\d+)$/.exec(c.tag || ''); if (m) max = Math.max(max, +m[1]); }
  return 'W' + (max + 1);
}
function cableCrossings(pg, c) {
  const out = []; const horiz = c.y1 === c.y2;
  const lo = horiz ? Math.min(c.x1, c.x2) : Math.min(c.y1, c.y2), hi = horiz ? Math.max(c.x1, c.x2) : Math.max(c.y1, c.y2);
  for (const w of pg.wires) {
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i + 1];
      if (horiz && a[0] === b[0] && a[0] > lo && a[0] < hi && c.y1 > Math.min(a[1], b[1]) && c.y1 < Math.max(a[1], b[1])) { out.push({ w, x: a[0], y: c.y1, along: a[0] }); break; }
      if (!horiz && a[1] === b[1] && a[1] > lo && a[1] < hi && c.x1 > Math.min(a[0], b[0]) && c.x1 < Math.max(a[0], b[0])) { out.push({ w, x: c.x1, y: a[1], along: a[1] }); break; }
    }
  }
  return out.sort((a, b) => a.along - b.along);
}
function condColor(c, cr) { return (c.cond || {})[cr.w.id] || cr.w.color || ''; }
function defaultCableType(pg, c) {
  const cr = cableCrossings(pg, c); if (!cr.length) return '';
  const cols = cr.map(x => condColor(c, x)); const awg = cr.map(x => x.w.awg).find(Boolean);
  if (!awg) return `${cr.length}-conductor`;
  const n = cols.filter(k => k !== 'GN' && k !== 'BARE').length, g = cols.length - n;
  return `${awg}/${n}${g ? ' w/G' : ''}`;
}
function cableSVG(c, pg, isSel, locked) {
  const cr = cableCrossings(pg, c); const horiz = c.y1 === c.y2;
  const col = isSel ? '#1f6fff' : (sheetDark() ? '#c8cdd4' : '#444');
  let s = locked ? '<g class="cable">' : `<g data-id="${c.id}" class="cable${isSel ? ' csel' : ''}"><path class="wirehit" d="M${c.x1},${c.y1}L${c.x2},${c.y2}"/>`;
  s += `<path d="M${c.x1},${c.y1}L${c.x2},${c.y2}" stroke="${col}" stroke-width="0.3" stroke-dasharray="2,0.8,0.4,0.8" fill="none" class="ly-cable"/>`;
  const tick = (x, y) => horiz ? `M${x - 0.8},${y + 1.4}L${x + 0.8},${y - 1.4}` : `M${x - 1.4},${y - 0.8}L${x + 1.4},${y + 0.8}`;
  s += `<path d="${tick(c.x1, c.y1)}${tick(c.x2, c.y2)}" stroke="${col}" stroke-width="0.3" fill="none" class="ly-cable"/>`;
  for (const x of cr) s += `<circle cx="${x.x}" cy="${x.y}" r="0.55" fill="${col}" class="ly-cable"/>`;
  const label = [home() ? (c.tag ? 'Cable ' + c.tag.replace(/^W/, '') : 'Cable') : identOnPage(c, pg), c.ctype, c.len].filter(Boolean).join('  ');
  s += horiz ? txt(Math.min(c.x1, c.x2), c.y1 - 1.6, label, { size: FSS, cls: isSel ? 'tx' : 'ly-cable' })
             : txt(c.x1 - 1.6, Math.min(c.y1, c.y2), label, { size: FSS, anchor: 'end', rot: -90, cls: isSel ? 'tx' : 'ly-cable' });
  return s + '</g>';
}
function findCable(id) { for (const pg of P.pages) { const c = (pg.cables || []).find(x => x.id === id); if (c) return { c, pg }; } return null; }

// targets reached from a point, following wires but not passing through devices
function traverse(pg, start, skipWire) {
  const seen = new Set([start.join(',')]), q = [start], used = new Set(skipWire ? [skipWire] : []), targets = [];
  while (q.length) {
    const p = q.shift();
    for (const it of pg.items) for (const c of connPts(it)) {
      if (c.x !== p[0] || c.y !== p[1]) continue;
      const d = SYM[it.sym]; let t;
      if (d.role === 'ip') t = '> ' + (it.ipName || '?');
      else if (d.role === 'pe') t = 'PE';
      else if (d.role === 'bar') t = d.pot + ' bar';
      else if (d.role === 'term') t = dispOnPage(it, pg) + ':' + (it.tn || '');
      else t = dispOnPage(it, pg) + ':' + ((it.cl || [])[c.i] || c.i + 1);
      if (!targets.includes(t)) targets.push(t);
    }
    for (const w of pg.wires) {
      if (used.has(w.id) || !onPoly(p, w.pts)) continue;
      used.add(w.id);
      const ends = [w.pts[0], w.pts[w.pts.length - 1]];
      for (const w2 of pg.wires) if (w2 !== w) for (const e of [w2.pts[0], w2.pts[w2.pts.length - 1]]) if (onPoly(e, w.pts)) ends.push(e);
      for (const e of ends) { const k = e.join(','); if (!seen.has(k)) { seen.add(k); q.push(e); } }
    }
  }
  return targets;
}
function wireEnds(pg, w) {
  const a = w.pts[0], b = w.pts[w.pts.length - 1];
  return [traverse(pg, a, w.id).join(', '), traverse(pg, b, w.id).join(', ')];
}
