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
  const { w, h, x0, x1, y0, y1, hdr, tb, cols, colw } = SH; const k = SH.k;
  let s = `<rect class="sheet" x="0" y="0" width="${w}" height="${h}"/>`;
  s += `<rect class="frame" x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}"/>`;
  s += `<line class="frame2" x1="${x0}" y1="${hdr}" x2="${x1}" y2="${hdr}"/>`;
  const hf = Math.min(2.8, (hdr - y0) * 0.6);
  for (let c = 0; c < cols; c++) {
    const cx = r2(x0 + c * colw);
    if (c) s += `<line class="frame2" x1="${cx}" y1="${y0}" x2="${cx}" y2="${hdr}"/>`;
    s += `<text class="ftext" x="${r2(cx + colw / 2)}" y="${r2(y0 + (hdr - y0) * 0.72)}" font-size="${hf}" text-anchor="middle">${c + 1}</text>`;
  }
  // title block
  s += `<line class="frame" x1="${x0}" y1="${tb}" x2="${x1}" y2="${tb}"/>`;
  const W = x1 - x0, X = f => r2(x0 + W * f);
  const lab = (x, y, t) => `<text class="ftext" x="${r2(x)}" y="${r2(y)}" font-size="${r2(Math.max(1.2, 2 * k))}" fill="#666">${esc(t)}</text>`;
  const val = (x, y, t, sz = 3.2, b = false, a = 'start') => `<text class="ftext" x="${r2(x)}" y="${r2(y)}" font-size="${r2(Math.max(1.5, sz * k))}" text-anchor="${a}"${b ? ' font-weight="bold"' : ''}>${esc(t)}</text>`;
  const isF = pg.kind === 'floor';
  const rv = typeof lastRev === 'function' ? lastRev(pg) : '';
  if (SH.compact) {
    // small sheets (note card): one row with description and page number
    const xp = X(0.72), ym = tb + (y1 - tb) / 2;
    s += `<line class="frame2" x1="${xp}" y1="${tb}" x2="${xp}" y2="${y1}"/>`;
    s += `<text class="ftext" x="${x0 + 1.5}" y="${r2(ym - 0.4)}" font-size="2.2" font-weight="bold">${esc(pg.desc || P.name || '')}</text>`;
    s += `<text class="ftext" x="${x0 + 1.5}" y="${r2(ym + 2.4)}" font-size="1.6" fill="#555">${esc([P.name, isF ? (levelOf(pg) || {}).name : dispCkt(pg.fn), pg.loc && !isF ? (home() ? niceRoom(pg.loc) : '+' + pg.loc) : ''].filter(Boolean).join(' · '))}</text>`;
    s += `<text class="ftext" x="${r2((xp + x1) / 2)}" y="${r2(ym + 0.6)}" font-size="2.6" font-weight="bold" text-anchor="middle">${esc(pg.num)}${rv ? ' rev ' + esc(rv) : ''}</text>`;
    s += `<text class="ftext" x="${r2((xp + x1) / 2)}" y="${r2(ym + 2.9)}" font-size="1.4" text-anchor="middle" fill="#555">${idx + 1} of ${total}</text>`;
    return s;
  }
  const a = X(0.225), b = X(0.65), c = X(0.825);
  for (const x of [a, b, c]) s += `<line class="frame2" x1="${x}" y1="${tb}" x2="${x}" y2="${y1}"/>`;
  const mid = r2(tb + (y1 - tb) / 2);
  s += `<line class="frame2" x1="${x0}" y1="${mid}" x2="${a}" y2="${mid}"/>`;
  s += `<line class="frame2" x1="${b}" y1="${mid}" x2="${x1}" y2="${mid}"/>`;
  const dy = v => tb + v * k, my = v => mid + v * k;
  s += lab(x0 + 2, dy(3.5), 'Company') + val(x0 + 2, dy(10), P.company || '', 3.6, true);
  s += lab(x0 + 2, my(3.5), 'Drawn by') + val(x0 + 2, my(10), P.author || '');
  s += lab(X(0.1125), my(3.5), 'Date') + val(X(0.1125), my(10), P.modified || P.created || '');
  s += lab(a + 2, dy(3.5), 'Project') + val((a + b) / 2, dy(12), P.name || '', 5, true, 'middle');
  s += val((a + b) / 2, dy(22.5), pg.desc || '', 4, false, 'middle');
  s += lab(b + 2, dy(3.5), isF ? 'Level' : L('fn')) + val(b + 2, dy(10.5), isF ? ((levelOf(pg) || {}).name || '') : dispCkt(pg.fn), 4, true);
  s += lab(b + 2, my(3.5), isF ? 'View' : L('loc')) + val(b + 2, my(10.5), isF ? fpViewName(pg) : (pg.loc ? (home() ? niceRoom(pg.loc) : '+' + pg.loc) : ''), 4, true);
  s += lab(c + 2, dy(3.5), 'Page') + val((c + x1) / 2, dy(11), pg.num, 6, true, 'middle');
  s += lab(c + 2, my(3.5), 'Sheet') + val((c + x1) / 2, my(10.5), `${idx + 1} of ${total}`, 3.4, false, 'middle');
  if (rv) s += lab(c + (x1 - c) * 0.786, dy(3.5), 'Rev') + val(c + (x1 - c) * 0.871, dy(11), rv, 4.5, true, 'middle');
  return s;
}

function connDir(box, cx, cy) {
  const [a, b, c, e] = box;
  if (cy <= b) return [0, -1]; if (cy >= e) return [0, 1];
  if (cx <= a) return [-1, 0]; if (cx >= c) return [1, 0];
  return Math.abs(cy) >= Math.abs(cx) ? [0, Math.sign(cy) || 1] : [Math.sign(cx) || 1, 0];
}

function itemSVG(it, pg, isSel, ghost, o = {}, locked = false) {
  const cls = ghost ? 'ghost' : 'item' + (isSel ? ' sel' : '') + (locked ? ' locked' : '');
  const did = ghost || locked ? '' : `data-id="${it.id}" `;
  if (it.sym === 'text') {
    const size = it.size || 3.5;
    const lines = String(it.text || '').split('\n');
    const b = itemBox(it);
    if (!ghost && !lyOn('text', o)) return '';
    let s = `<g ${did}class="${cls}"><rect class="hit" x="${b[0] - 1}" y="${b[1] - 1}" width="${b[2] - b[0] + 2}" height="${b[3] - b[1] + 2}"/>`;
    lines.forEach((l, i) => { s += txt(it.x, it.y + i * size * 1.25, l, { size, bold: it.bold, cls: 'ly-text' }); });
    return s + '</g>';
  }
  const d = SYM[it.sym]; if (!d) return '';
  const rot = it.rot || 0;
  const b = itemBox(it);
  let s = `<g ${did}class="${cls}">`;
  const on = k => ghost || lyOn(k, o);
  s += `<rect class="${d.edge ? 'gfxedge' : 'hit'}" x="${b[0] - (d.edge ? 0 : 1)}" y="${b[1] - (d.edge ? 0 : 1)}" width="${b[2] - b[0] + (d.edge ? 0 : 2)}" height="${b[3] - b[1] + (d.edge ? 0 : 2)}"/>`;
  if (on('sym')) s += `<g transform="translate(${it.x},${it.y}) rotate(${rot})${it.mir ? ' scale(-1,1)' : ''}"><g class="sym ly-sym">${d.draw(it)}</g></g>`;
  if (d.texts && on('sym')) for (const [lx, ly, t, sz, bold] of d.texts(it)) { const [rx, ry] = xf(it, lx, ly - sz * 0.35); s += txt(it.x + rx, it.y + ry + sz * 0.35, t, { size: sz, anchor: 'middle', bold, cls: 'ly-symt' }); }
  // connection point designations
  if ((ghost ? S().connLabels : lyOn('cl', o)) && !['term', 'ip', 'pe', 'plc', 'bar'].includes(d.role)) {
    const sb = symBox(it);
    symConns(it).forEach(([cx, cy], i) => {
      const lab = (it.cl || [])[i]; if (!lab) return;
      const [px, py] = xf(it, cx, cy); const [dx, dy] = xf(it, ...connDir(sb, cx, cy));
      if (d.card) {
        if (dx === 0) { const up = dy < 0; s += txt(it.x + px + 0.8, it.y + py + (up ? -1.2 : 1.2), lab, { size: FSS, cls: 'tc ly-cl', rot: -90, anchor: up ? 'start' : 'end' }); }
        else s += txt(it.x + px + dx * 1.2, it.y + py - 0.6, lab, { size: FSS, cls: 'tc ly-cl', anchor: dx < 0 ? 'end' : 'start' });
        return;
      }
      if (dx === 0) s += txt(it.x + px + 0.8, it.y + py - dy * 2.6 + 0.8, lab, { size: FSS, cls: 'tc ly-cl' });
      else s += txt(it.x + px - dx * 2.6, it.y + py - 0.9, lab, { size: FSS, cls: 'tc ly-cl', anchor: 'middle' });
    });
  }
  const vert = rot % 180 === 0;
  // interruption point label
  if (d.role === 'ip') {
    const refs = ghost ? [] : (IX.ips.get(it.ipName) || []).filter(o => o !== it).map(o => ref(pg, o));
    const [ox, oy] = xf(it, 0, -5.5);
    const others = ghost ? [] : (IX.ips.get(it.ipName) || []).filter(o => o !== it);
    const lines = (on('tag') ? [[it.ipName || '?', true, 'ly-tag']] : []).concat(refs.length && on('xref') ? [[refs.join(' '), false, 'tx ly-xref', pgIdOf(others[0])]] : []);
    if (vert) {
      const ys = oy < 0 ? -1 : 1;
      lines.forEach((l, i) => { const k = ys < 0 ? lines.length - 1 - i : i; s += txt(it.x, it.y + oy + ys * k * 3 + (ys > 0 ? 1.5 : 0), l[0], { bold: l[1], cls: l[2], anchor: 'middle', link: l[3] }); });
    } else {
      lines.forEach((l, i) => { s += txt(it.x + ox, it.y - 0.6 + i * 3.1, l[0], { bold: l[1], cls: l[2], anchor: ox < 0 ? 'end' : 'start', link: l[3] }); });
    }
    return s + '</g>';
  }
  if (d.role === 'pe' || d.role === 'bar' || d.role === 'mark') return s + '</g>';
  // device label
  const lines = [];
  const stripCont = d.role === 'term' && !ghost && pg.items.some(o => o !== it && o.sym === 'term' && devKey(o) === devKey(it) && (o.rot || 0) === rot &&
    (rot % 180 === 0 ? (o.y === it.y && it.x - o.x > 0 && it.x - o.x <= 12) : (o.x === it.x && it.y - o.y > 0 && it.y - o.y <= 12)));
  const boxed = !!it.inBox && !ghost;
  if (it.tag && !stripCont && !boxed && on('tag')) lines.push([dispOnPage(it, pg), true, 'ly-tag']);
  if (it.desc && on('desc')) String(it.desc).split('\n').forEach(l => lines.push([l, false, 'ly-desc']));
  if (!ghost && !boxed && it.tag && d.prefix && on('xref')) {
    const dv = IX.dev.get(devKey(it));
    if (dv) {
      if (it.role === 'aux' && dv.main) lines.push([ref(pg, dv.main), false, 'tx ly-xref', pgIdOf(dv.main)]);
      else if (it.role === 'aux' && !dv.main) lines.push(['no main function', false, 'tw ly-xref']);
      else if (it.role === 'sl') {
        // another view of the device (single-line, or a pneumatic view): refer to the other views, main function first
        const oth = dv.items.filter(o => o !== it).sort((a, b) => (b.role === 'main') - (a.role === 'main')); const r = oth.map(o => ref(pg, o));
        for (let i = 0; i < r.length; i += 3) lines.push([r.slice(i, i + 3).join(' '), false, 'tx ly-xref', pgIdOf(oth[i])]);
      }
      else if (it.role === 'main' && d.mirror) {
        const sl = dv.items.filter(o => o.role === 'sl');
        if (sl.length) lines.push([sl.map(o => ref(pg, o)).join(' '), false, 'tx ly-xref', pgIdOf(sl[0])]);
      }
      else if (it.role === 'main' && !d.mirror) {
        const oth = dv.items.filter(o => o !== it); const r = oth.map(o => ref(pg, o));
        for (let i = 0; i < r.length; i += 3) lines.push([r.slice(i, i + 3).join(' '), false, 'tx ly-xref', pgIdOf(oth[i])]);
      }
    }
  }
  if (d.role === 'term' && on('tag')) {
    const [nx, ny] = vert ? [2.2, 0.9] : [0, -2.2];
    s += txt(it.x + nx, it.y + ny, it.tn || '', { anchor: vert ? 'start' : 'middle', size: FS, cls: 'ly-tag' });
  }
  if (d.role === 'plc' && on('tag')) s += txt(it.x, it.y + 0.9, it.addr || '', { anchor: 'middle', size: FSS, cls: 'ly-tag' });
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
  if (!ghost && !boxed && d.mirror && it.tag && on('xref')) {
    const dv = IX.dev.get(devKey(it));
    const entries = [];
    if (dv) for (const o of dv.items) {
      if (o.role === 'main' || o.role === 'sl') continue;
      const kind = CONTACT_KIND[o.sym] || (SYM[o.sym] && SYM[o.sym].contact) || 'NO'; const cl = o.cl || [];
      if (kind === 'CO') { entries.push({ kind: 'NC', a: cl[0] || '', b: (cl[1] || '') + '/' + (cl[2] || ''), r: ref(pg, o), link: pgIdOf(o) }); continue; }
      for (let i = 0; i < cl.length; i += 2) entries.push({ kind, a: cl[i] || '', b: cl[i + 1] || '', r: ref(pg, o), link: pgIdOf(o) });
    }
    if (entries.length) {
      const lh = 3.4;
      const x0 = vert ? b[2] + 3 : it.x - 6;
      const y0 = vert ? it.y - ((entries.length - 1) * lh) / 2 : b[3] + 4;
      s += `<g class="sym ly-xrefg" stroke-width="0.25">`;
      entries.forEach((e, i) => {
        const gy = y0 + i * lh, gx = x0 + 1;
        // NFPA projects show parallel-line contacts (a slash for NC), IEC projects blade contacts
        if (isNFPA()) s += `<path d="M${gx},${gy - 1.4}v0.8M${gx - 0.9},${gy - 0.6}h1.8M${gx - 0.9},${gy + 0.6}h1.8M${gx},${gy + 1.4}v-0.8${e.kind === 'NC' ? `M${gx - 1},${gy + 1.1}L${gx + 1},${gy - 1.1}` : ''}"/>`;
        else s += e.kind === 'NO'
          ? `<path d="M${gx},${gy - 1.4}v0.9M${gx},${gy + 1.4}v-0.9l-0.9,-1.2"/>`
          : `<path d="M${gx},${gy - 1.4}v0.9h0.8M${gx},${gy + 1.4}v-0.9l1,-1.3"/>`;
      });
      s += '</g>';
      const rx = x0 + Math.max(10.5, 3.8 + Math.max(...entries.map(e => `${e.a}-${e.b}`.length)) * 1.2);
      entries.forEach((e, i) => {
        const gy = y0 + i * lh;
        s += txt(x0 + 3, gy + 0.8, `${e.a}-${e.b}`, { size: FSS, cls: 'ly-xref' });
        s += txt(rx, gy + 0.8, e.r, { size: FSS, cls: 'tx ly-xref', link: e.link });
      });
    }
  }
  if (!ghost && !o.print && openTodosFor(it.id).length) s += todoFlag(b[2] + 1.2, b[1] + 1);
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

// every page is drawn on its own paper size
function pageSVG(pg, o = {}) { const prev = SH; useSheet(pg); try { return pageSVG0(pg, o); } finally { SH = prev; } }
function pageSVG0(pg, o = {}) {
  if (pg.report === 'cover') return coverSVG(pg);
  if (pg.report) return reportSVG(pg);
  if (pg.kind === 'floor') return floorSVG(pg, o);
  if (pg.kind === 'layout') return layoutSVG(pg, o);
  const all = allPages(); const idx = all.indexOf(pg);
  const g = gs();
  let s = `<defs><pattern id="gp" x="${-g / 2}" y="${-g / 2}" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><circle cx="${g / 2}" cy="${g / 2}" r="${g < 3 ? 0.12 : 0.17}" class="grid"/></pattern></defs>`;
  s += frameSVG(pg, idx, all.length);
  if (opts.grid && !o.print) s += `<rect x="${SH.x0}" y="${SH.hdr}" width="${SH.x1 - SH.x0}" height="${SH.tb - SH.hdr}" fill="url(#gp)" pointer-events="none"/>`;
  s += gfxPageSVG(pg, o);
  // wires
  const wOn = lyOn('wire', o), wnOn = lyOn('wno', o);
  for (const w of pg.wires) {
    if (!objShown(w, o)) continue;
    const isSel = !o.print && sel.has(w.id); const lk = !o.print && objLocked(w);
    const d = 'M' + w.pts.map(p => p.join(',')).join('L');
    const wc = w.tube ? ` style="${!isSel ? `stroke:${TUBE_RGB[w.color] || '#1f5fbf'};` : ''}stroke-width:0.5"` : !isSel && w.color && wireColor(w.color) ? ` style="stroke:${wireColor(w.color)}"` : '';
    s += `<g ${lk ? '' : `data-id="${w.id}" `}class="${isSel ? 'selw' : ''}">`;
    if (wOn) s += `${lk ? '' : `<path class="wirehit" d="${d}"/>`}<path class="wire ly-wire" d="${d}"${wc}/>`;
    const num = WN.get(w.id); const lp = wireLabelPos(w);
    if (w.tube && wnOn && lp && lp.len >= 10) {
      const lab = [w.tag, tubeOdLabel(w.od)].filter(Boolean).join(' ');
      s += lp.vert ? txt(lp.x - 0.9, lp.y, lab, { size: FSS, anchor: 'middle', rot: -90, cls: (isSel ? 'tx ' : '') + 'ly-wno' }) : txt(lp.x, lp.y - 0.9, lab, { size: FSS, anchor: 'middle', cls: (isSel ? 'tx ' : '') + 'ly-wno' });
    } else if (wnOn && num && lp && lp.len >= 10) {
      s += lp.vert ? txt(lp.x - 0.9, lp.y, num, { size: FSS, anchor: 'middle', rot: -90, cls: (isSel ? 'tx ' : '') + 'ly-wno' })
                   : txt(lp.x, lp.y - 0.9, num, { size: FSS, anchor: 'middle', cls: (isSel ? 'tx ' : '') + 'ly-wno' });
    }
    s += '</g>';
  }
  if (lyOn('junc', o) && wOn) for (const [x, y] of (NETS.junctions.get(pg.id) || [])) s += `<circle class="junction ly-junc" cx="${x}" cy="${y}" r="0.75"/>`;
  if (lyOn('cable', o)) for (const c of pg.cables || []) if (objShown(c, o)) s += cableSVG(c, pg, !o.print && sel.has(c.id), !o.print && objLocked(c));
  for (const it of [...pg.items].sort((a, b) => (b.sym === 'dbox') - (a.sym === 'dbox'))) if (objShown(it, o)) s += itemSVG(it, pg, !o.print && sel.has(it.id), false, o, !o.print && objLocked(it));
  // grab handles on the ends of a single selected connection (drawn last so symbols do not cover them)
  if (!o.print && sel.size === 1) {
    const w = pg.wires.find(x => sel.has(x.id));
    if (w && !objLocked(w)) [0, w.pts.length - 1].forEach((i, e) => { const [x, y] = w.pts[i]; s += `<rect class="whandle" data-wend="${w.id}:${e}" x="${x - 0.9}" y="${y - 0.9}" width="1.8" height="1.8"/>`; });
  }
  return s;
}

function symPreview(key) {
  const d = SYM[key]; const [a, b, c, e] = d.box;
  const pad = 3; const vb = [a - pad - 6, b - pad, (c - a) + pad * 2 + 6, (e - b) + pad * 2];
  const side = Math.max(vb[2], vb[3]);
  const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
  return `<svg viewBox="${cx - side / 2} ${cy - side / 2} ${side} ${side}"><g class="sym">${d.draw({})}</g></svg>`;
}
