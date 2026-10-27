// ---------- rendering ----------
const pgIdOf = it => { const p = IX && IX.pos.get(it.id); return p && p.pg ? p.pg.id : ''; };
const CONTACT_KIND = { no: 'NO', mc3: 'NO', nc: 'NC', olnc: 'NC', pbno: 'NO', pbnc: 'NC', estop: 'NC', cb1: 'NO', cb3: 'NO' };

function txt(x, y, s, o = {}) {
  const size = o.size || FS;
  const anchor = o.anchor || 'start';
  const cls = 't' + (o.cls ? ' ' + o.cls : '');
  const w = o.bold ? ' font-weight="bold"' : '';
  const tr = o.rot ? ` transform="rotate(${o.rot} ${r2(x)} ${r2(y)})"` : '';
  const ln = o.link ? ` data-link="${esc(o.link)}"` : '';
  return `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" text-anchor="${anchor}" class="${cls}"${w}${tr}${ln}>${esc(s)}</text>`;
}

function frameSVG(pg, idx, total) {
  const { w, h, x0, x1, y0, y1, hdr, tb } = SH;
  let s = `<rect class="sheet" x="0" y="0" width="${w}" height="${h}"/>`;
  s += `<rect class="frame" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>`;
  s += `<line class="frame2" x1="${x0}" y1="${hdr}" x2="${x1}" y2="${hdr}"/>`;
  for (let c = 0; c < SH.cols; c++) {
    const cx = x0 + c * COLW;
    if (c) s += `<line class="frame2" x1="${cx}" y1="${y0}" x2="${cx}" y2="${hdr}"/>`;
    s += `<text class="ftext" x="${cx + COLW / 2}" y="${y0 + 4.3}" font-size="2.8" text-anchor="middle">${c + 1}</text>`;
  }
  // title block
  s += `<line class="frame" x1="${x0}" y1="${tb}" x2="${x1}" y2="${tb}"/>`;
  const cols = [x0, 105, 275, 345, x1];
  for (let i = 1; i < cols.length - 1; i++) s += `<line class="frame2" x1="${cols[i]}" y1="${tb}" x2="${cols[i]}" y2="${y1}"/>`;
  const mid = tb + 15;
  s += `<line class="frame2" x1="${x0}" y1="${mid}" x2="${105}" y2="${mid}"/>`;
  s += `<line class="frame2" x1="${275}" y1="${mid}" x2="${x1}" y2="${mid}"/>`;
  const lab = (x, y, t) => `<text class="ftext" x="${x}" y="${y}" font-size="2" fill="#666">${esc(t)}</text>`;
  const val = (x, y, t, sz = 3.2, b = false, a = 'start') => `<text class="ftext" x="${x}" y="${y}" font-size="${sz}" text-anchor="${a}"${b ? ' font-weight="bold"' : ''}>${esc(t)}</text>`;
  s += lab(x0 + 2, tb + 3.5, 'Company') + val(x0 + 2, tb + 10, P.company || '', 3.6, true);
  s += lab(x0 + 2, mid + 3.5, 'Drawn by') + val(x0 + 2, mid + 10, P.author || '');
  s += lab(60, mid + 3.5, 'Date') + val(60, mid + 10, P.modified || P.created || '');
  s += lab(107, tb + 3.5, 'Project') + val(190, tb + 12, P.name || '', 5, true, 'middle');
  s += val(190, tb + 22.5, pg.desc || '', 4, false, 'middle');
  const isF = pg.kind === 'floor';
  s += lab(277, tb + 3.5, isF ? 'Level' : L('fn')) + val(277, tb + 10.5, isF ? ((levelOf(pg) || {}).name || '') : dispCkt(pg.fn), 4, true);
  s += lab(277, mid + 3.5, isF ? 'View' : L('loc')) + val(277, mid + 10.5, isF ? fpViewName(pg) : (pg.loc ? (home() ? niceRoom(pg.loc) : '+' + pg.loc) : ''), 4, true);
  s += lab(347, tb + 3.5, 'Page') + val(380, tb + 11, pg.num, 6, true, 'middle');
  s += lab(347, mid + 3.5, 'Sheet') + val(380, mid + 10.5, `${idx + 1} of ${total}`, 3.4, false, 'middle');
  const rv = typeof lastRev === 'function' ? lastRev(pg) : ''; if (rv) s += lab(400, tb + 3.5, 'Rev') + val(406, tb + 11, rv, 4.5, true, 'middle');
  return s;
}

function connDir(d, cx, cy) {
  const [a, b, c, e] = d.box;
  if (cy <= b) return [0, -1]; if (cy >= e) return [0, 1];
  if (cx <= a) return [-1, 0]; if (cx >= c) return [1, 0];
  return Math.abs(cy) >= Math.abs(cx) ? [0, Math.sign(cy) || 1] : [Math.sign(cx) || 1, 0];
}

function itemSVG(it, pg, isSel, ghost) {
  const cls = ghost ? 'ghost' : 'item' + (isSel ? ' sel' : '');
  if (it.sym === 'text') {
    const size = it.size || 3.5;
    const lines = String(it.text || '').split('\n');
    const b = itemBox(it);
    let s = `<g data-id="${it.id}" class="${cls}"><rect class="hit" x="${b[0] - 1}" y="${b[1] - 1}" width="${b[2] - b[0] + 2}" height="${b[3] - b[1] + 2}"/>`;
    lines.forEach((l, i) => { s += txt(it.x, it.y + i * size * 1.25, l, { size, bold: it.bold }); });
    return s + '</g>';
  }
  const d = SYM[it.sym]; if (!d) return '';
  const rot = it.rot || 0;
  const b = itemBox(it);
  let s = `<g ${ghost ? '' : `data-id="${it.id}" `}class="${cls}">`;
  s += `<rect class="hit" x="${b[0] - 1}" y="${b[1] - 1}" width="${b[2] - b[0] + 2}" height="${b[3] - b[1] + 2}"/>`;
  s += `<g transform="translate(${it.x},${it.y}) rotate(${rot})${it.mir ? ' scale(-1,1)' : ''}"><g class="sym">${d.draw(it)}</g></g>`;
  if (d.texts) for (const [lx, ly, t, sz, bold] of d.texts(it)) { const [rx, ry] = xf(it, lx, ly - sz * 0.35); s += txt(it.x + rx, it.y + ry + sz * 0.35, t, { size: sz, anchor: 'middle', bold }); }
  // connection point designations
  if (S().connLabels && !['term', 'ip', 'pe', 'plc', 'bar'].includes(d.role)) {
    d.conns.forEach(([cx, cy], i) => {
      const lab = (it.cl || [])[i]; if (!lab) return;
      const [px, py] = xf(it, cx, cy); const [dx, dy] = xf(it, ...connDir(d, cx, cy));
      if (dx === 0) s += txt(it.x + px + 0.8, it.y + py - dy * 2.6 + 0.8, lab, { size: FSS, cls: 'tc' });
      else s += txt(it.x + px - dx * 2.6, it.y + py - 0.9, lab, { size: FSS, cls: 'tc', anchor: 'middle' });
    });
  }
  const vert = rot % 180 === 0;
  // interruption point label
  if (d.role === 'ip') {
    const refs = ghost ? [] : (IX.ips.get(it.ipName) || []).filter(o => o !== it).map(o => ref(pg, o));
    const [ox, oy] = xf(it, 0, -5.5);
    const others = ghost ? [] : (IX.ips.get(it.ipName) || []).filter(o => o !== it);
    const lines = [[it.ipName || '?', true, '']].concat(refs.length ? [[refs.join(' '), false, 'tx', pgIdOf(others[0])]] : []);
    if (vert) {
      const ys = oy < 0 ? -1 : 1;
      lines.forEach((l, i) => { const k = ys < 0 ? lines.length - 1 - i : i; s += txt(it.x, it.y + oy + ys * k * 3 + (ys > 0 ? 1.5 : 0), l[0], { bold: l[1], cls: l[2], anchor: 'middle', link: l[3] }); });
    } else {
      lines.forEach((l, i) => { s += txt(it.x + ox, it.y - 0.6 + i * 3.1, l[0], { bold: l[1], cls: l[2], anchor: ox < 0 ? 'end' : 'start', link: l[3] }); });
    }
    return s + '</g>';
  }
  if (d.role === 'pe' || d.role === 'bar') return s + '</g>';
  // device label
  const lines = [];
  const stripCont = d.role === 'term' && !ghost && pg.items.some(o => o !== it && o.sym === 'term' && devKey(o) === devKey(it) && (o.rot || 0) === rot &&
    (rot % 180 === 0 ? (o.y === it.y && it.x - o.x > 0 && it.x - o.x <= 12) : (o.x === it.x && it.y - o.y > 0 && it.y - o.y <= 12)));
  if (it.tag && !stripCont) lines.push([dispOnPage(it, pg), true, '']);
  if (it.desc) String(it.desc).split('\n').forEach(l => lines.push([l, false, '']));
  if (!ghost && it.tag && d.prefix) {
    const dv = IX.dev.get(devKey(it));
    if (dv) {
      if (it.role === 'aux' && dv.main) lines.push([ref(pg, dv.main), false, 'tx', pgIdOf(dv.main)]);
      else if (it.role === 'aux' && !dv.main) lines.push(['no main function', false, 'tw']);
      else if (it.role === 'main' && !d.mirror) {
        const oth = dv.items.filter(o => o !== it); const r = oth.map(o => ref(pg, o));
        for (let i = 0; i < r.length; i += 3) lines.push([r.slice(i, i + 3).join(' '), false, 'tx', pgIdOf(oth[i])]);
      }
    }
  }
  if (d.role === 'term') {
    const [nx, ny] = vert ? [2.2, 0.9] : [0, -2.2];
    s += txt(it.x + nx, it.y + ny, it.tn || '', { anchor: vert ? 'start' : 'middle', size: FS });
  }
  if (d.role === 'plc') {
    s += txt(it.x, it.y + (it.sym === 'plcin' ? 0.9 : 0.9), it.addr || '', { anchor: 'middle', size: FSS });
    if (vert && it.sym === 'plcin') { /* address inside box */ }
  }
  if (lines.length) {
    const lh = 3.1;
    if (vert) {
      const y0 = it.y - ((lines.length - 1) * lh) / 2 + 0.9;
      lines.forEach((l, i) => { s += txt(b[0] - 1.5, y0 + i * lh, l[0], { anchor: 'end', bold: l[1], cls: l[2], link: l[3] }); });
    } else {
      const y0 = b[1] - 1.5 - (lines.length - 1) * lh;
      lines.forEach((l, i) => { s += txt(it.x, y0 + i * lh, l[0], { anchor: 'middle', bold: l[1], cls: l[2], link: l[3] }); });
    }
  }
  // contact mirror for coils
  if (!ghost && d.mirror && it.tag) {
    const dv = IX.dev.get(devKey(it));
    const entries = [];
    if (dv) for (const o of dv.items) {
      if (o.role === 'main') continue;
      const kind = CONTACT_KIND[o.sym] || 'NO'; const cl = o.cl || [];
      for (let i = 0; i < cl.length; i += 2) entries.push({ kind, a: cl[i] || '', b: cl[i + 1] || '', r: ref(pg, o), link: pgIdOf(o) });
    }
    if (entries.length) {
      const lh = 3.4;
      const x0 = vert ? b[2] + 3 : it.x - 6;
      const y0 = vert ? it.y - ((entries.length - 1) * lh) / 2 : b[3] + 4;
      s += `<g class="sym" stroke-width="0.25">`;
      entries.forEach((e, i) => {
        const gy = y0 + i * lh, gx = x0 + 1;
        s += e.kind === 'NO'
          ? `<path d="M${gx},${gy - 1.4}v0.9M${gx},${gy + 1.4}v-0.9l-0.9,-1.2"/>`
          : `<path d="M${gx},${gy - 1.4}v0.9h0.8M${gx},${gy + 1.4}v-0.9l1,-1.3"/>`;
      });
      s += '</g>';
      entries.forEach((e, i) => {
        const gy = y0 + i * lh;
        s += txt(x0 + 3, gy + 0.8, `${e.a}-${e.b}`, { size: FSS });
        s += txt(x0 + 10.5, gy + 0.8, e.r, { size: FSS, cls: 'tx', link: e.link });
      });
    }
  }
  if (!ghost && openTodosFor(it.id).length) s += todoFlag(b[2] + 1.2, b[1] + 1);
  return s + '</g>';
}

function wireLabelPos(w) {
  let best = null, bl = -1;
  for (let i = 0; i < w.pts.length - 1; i++) {
    const a = w.pts[i], b = w.pts[i + 1]; const l = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    if (l > bl) { bl = l; best = [a, b]; }
  }
  if (!best) return null;
  const [a, b] = best; const vert = a[0] === b[0];
  return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, vert, len: bl };
}

function pageSVG(pg, o = {}) {
  if (pg.report === 'cover') return coverSVG(pg);
  if (pg.report) return reportSVG(pg);
  if (pg.kind === 'floor') return floorSVG(pg, o);
  const all = allPages(); const idx = all.indexOf(pg);
  const g = gs();
  let s = `<defs><pattern id="gp" x="${-g / 2}" y="${-g / 2}" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><circle cx="${g / 2}" cy="${g / 2}" r="${g < 3 ? 0.12 : 0.17}" class="grid"/></pattern></defs>`;
  s += frameSVG(pg, idx, all.length);
  if (opts.grid && !o.print) s += `<rect x="${SH.x0}" y="${SH.hdr}" width="${SH.x1 - SH.x0}" height="${SH.tb - SH.hdr}" fill="url(#gp)" pointer-events="none"/>`;
  // wires
  for (const w of pg.wires) {
    const isSel = !o.print && sel.has(w.id);
    const d = 'M' + w.pts.map(p => p.join(',')).join('L');
    const wc = !isSel && w.color && wireColor(w.color) ? ` style="stroke:${wireColor(w.color)}"` : '';
    s += `<g data-id="${w.id}" class="${isSel ? 'selw' : ''}"><path class="wirehit" d="${d}"/><path class="wire" d="${d}"${wc}/>`;
    const num = WN.get(w.id); const lp = wireLabelPos(w);
    if (num && lp && lp.len >= 10) {
      s += lp.vert ? txt(lp.x - 0.9, lp.y, num, { size: FSS, anchor: 'middle', rot: -90, cls: isSel ? 'tx' : '' })
                   : txt(lp.x, lp.y - 0.9, num, { size: FSS, anchor: 'middle', cls: isSel ? 'tx' : '' });
    }
    s += '</g>';
  }
  for (const [x, y] of (NETS.junctions.get(pg.id) || [])) s += `<circle class="junction" cx="${x}" cy="${y}" r="0.75"/>`;
  for (const c of pg.cables || []) s += cableSVG(c, pg, !o.print && sel.has(c.id));
  for (const it of pg.items) s += itemSVG(it, pg, !o.print && sel.has(it.id));
  return s;
}

function symPreview(key) {
  const d = SYM[key]; const [a, b, c, e] = d.box;
  const pad = 3; const vb = [a - pad - 6, b - pad, (c - a) + pad * 2 + 6, (e - b) + pad * 2];
  const side = Math.max(vb[2], vb[3]);
  const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
  return `<svg viewBox="${cx - side / 2} ${cy - side / 2} ${side} ${side}"><g class="sym">${d.draw({})}</g></svg>`;
}
