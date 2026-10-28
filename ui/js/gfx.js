// ---------- graphics on pages: line, polyline, rectangle, circle, dimension, image ----------
// Stored per page in pg.gfx as { id, t, pts: [[x, y], ...], w, dash, color, fill, text, asset, layer }.
const GFX_TYPES = { line: 'Line', poly: 'Polyline', rect: 'Rectangle', circle: 'Circle', dim: 'Dimension', image: 'Image' };
const DASH = { solid: '', dash: '2,1', dot: '0.3,0.9', dashdot: '3,1,0.5,1' };
let gdraft = null;
const gfxOK = pg => pg && !pg.report && !isFloor(pg);
function gfxBox(g) {
  if (g.t === 'circle') { const r = gfxRadius(g); return [g.pts[0][0] - r, g.pts[0][1] - r, g.pts[0][0] + r, g.pts[0][1] + r]; }
  return bboxPts(g.pts);
}
const gfxRadius = g => Math.hypot(g.pts[1][0] - g.pts[0][0], g.pts[1][1] - g.pts[0][1]);
const gfxScale = pg => (pg && pg.scale) || 1;
function dimText(g, pg) { if (g.text) return g.text; const l = Math.hypot(g.pts[1][0] - g.pts[0][0], g.pts[1][1] - g.pts[0][1]) * gfxScale(pg); return (Math.round(l * 10) / 10) + ' mm'; }
function gfxSVG(g, pg, isSel, locked, preview) {
  const col = isSel ? 'var(--sel)' : (g.color || '#000000');
  const w = g.w || 0.35; const da = DASH[g.dash || 'solid'];
  const st = `stroke="${col}" stroke-width="${w}"${da ? ` stroke-dasharray="${da}"` : ''} stroke-linecap="round" stroke-linejoin="round"`;
  const fill = g.fill && g.t !== 'line' && g.t !== 'poly' && g.t !== 'dim' ? g.fill : 'none';
  const p = g.pts; let body = '', hit = '';
  const d = 'M' + p.map(q => q.join(',')).join('L');
  if (g.t === 'line' || g.t === 'poly') { body = `<path d="${d}" fill="none" ${st}/>`; hit = `<path class="wirehit" d="${d}"/>`; }
  else if (g.t === 'rect') {
    const [x0, y0, x1, y1] = bboxPts(p);
    body = `<rect x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}" fill="${fill}" ${st}/>`;
    hit = `<rect class="${fill === 'none' ? 'gfxedge' : 'hit'}" x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}"/>`;
  } else if (g.t === 'circle') {
    const r = r2(gfxRadius(g));
    body = `<circle cx="${p[0][0]}" cy="${p[0][1]}" r="${r}" fill="${fill}" ${st}/>`;
    hit = `<circle class="${fill === 'none' ? 'gfxedge' : 'hit'}" cx="${p[0][0]}" cy="${p[0][1]}" r="${r}"/>`;
  } else if (g.t === 'dim') {
    const [a, b] = p; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    const tick = q => `M${r2(q[0] - 1.2 * (ux - uy))},${r2(q[1] - 1.2 * (uy + ux))}L${r2(q[0] + 1.2 * (ux - uy))},${r2(q[1] + 1.2 * (uy + ux))}`;
    body = `<path d="${d}${tick(a)}${tick(b)}" fill="none" stroke="${col}" stroke-width="${Math.min(w, 0.25)}"/>`;
    let ang = Math.atan2(uy, ux) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
    const mx = (a[0] + b[0]) / 2 + uy * 1.2, my = (a[1] + b[1]) / 2 - ux * 1.2;
    body += `<text class="t ly-gfxt" x="${r2(mx)}" y="${r2(my)}" font-size="${FSS}" text-anchor="middle"${isSel ? ' style="fill:var(--sel)"' : ` fill="${col}"`} transform="rotate(${r2(ang)} ${r2(mx)} ${r2(my)})">${esc(dimText(g, pg))}</text>`;
    hit = `<path class="wirehit" d="${d}"/>`;
  } else if (g.t === 'image') {
    const [x0, y0, x1, y1] = bboxPts(p); const src = P.assets[g.asset];
    body = src ? `<image href="${src}" x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}" preserveAspectRatio="none"${g.opacity != null ? ` opacity="${g.opacity}"` : ''}/>` : `<rect x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}" fill="none" stroke="#999" stroke-dasharray="1,1"/>`;
    if (isSel) body += `<rect x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}" fill="none" stroke="var(--sel)" stroke-width="0.4" stroke-dasharray="2,1.5"/>`;
    hit = `<rect class="hit" x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}"/>`;
  }
  if (preview) return `<g class="gfxprev" opacity="0.7">${body}</g>`;
  return `<g ${locked ? '' : `data-id="${g.id}" `}class="gfx ly-gfx${isSel ? ' gsel' : ''}">${locked ? '' : hit}${body}</g>`;
}
function gfxPageSVG(pg, o) {
  if (!lyOn('gfx', o)) return '';
  let s = '';
  for (const g of pg.gfx || []) if (objShown(g, o)) s += gfxSVG(g, pg, !o.print && sel.has(g.id), !o.print && objLocked(g));
  return s;
}
// ---------- drawing ----------
function gfxMode(t) {
  const pg = page(); if (!gfxOK(pg)) { flash('Graphics are drawn on schematic and panel layout pages'); return; }
  setMode('g:' + t); flash(t === 'poly' ? 'Click the points, double click or Esc to finish' : 'Click the start point, then the end point');
}
function gfxDown(pg, x, y) {
  const t = mode.slice(2); const p = [x, y];
  if (!gdraft) { gdraft = { t, pts: [p] }; gfxPreview(x, y); return; }
  const last = gdraft.pts[gdraft.pts.length - 1];
  if (last[0] === x && last[1] === y) return;
  gdraft.pts.push(p);
  if (t !== 'poly') gfxFinish(pg); else gfxPreview(x, y);
}
function gfxPreview(x, y) {
  let s = `<rect class="snap" x="${x - 1}" y="${y - 1}" width="2" height="2"/>`;
  if (gdraft) s += gfxSVG(Object.assign({ w: 0.35, color: '#1f6fff' }, gdraft, { pts: gdraft.pts.concat([[x, y]]) }), page(), false, false, true);
  $('#overlay').innerHTML = s;
}
function gfxFinish(pg) {
  const d = gdraft; gdraft = null; $('#overlay').innerHTML = '';
  if (!d || d.pts.length < 2) return;
  if (d.t === 'rect' || d.t === 'circle') { const [a, b] = d.pts; if (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5) return; }
  commit(() => { const g = onActiveLayer({ id: uid(), t: d.t, pts: d.pts, w: d.t === 'dim' ? 0.25 : 0.35, dash: 'solid', color: '#000000' }); pg.gfx = pg.gfx || []; pg.gfx.push(g); sel = new Set([g.id]); });
}
function gfxImage() {
  const pg = page(); if (!gfxOK(pg)) { flash('Images are placed on schematic and panel layout pages'); return; }
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = () => {
    const f = i.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        const g2 = c.getContext('2d'); g2.drawImage(img, 0, 0, c.width, c.height);
        const png = /png|gif|svg/i.test(f.type);
        const id = uid(); P.assets[id] = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88);
        const w = 80, h = r2(80 * c.height / c.width);
        const r = svg.getBoundingClientRect(); const cx = snap(view.x + r.width / view.s / 2), cy = snap(view.y + r.height / view.s / 2);
        commit(() => { const g = onActiveLayer({ id: uid(), t: 'image', asset: id, pts: [[r2(cx - w / 2), r2(cy - h / 2)], [r2(cx + w / 2), r2(cy + h / 2)]] }); pg.gfx = pg.gfx || []; pg.gfx.push(g); sel = new Set([g.id]); });
      };
      img.onerror = () => alert('That file could not be read as an image. Use PNG or JPG.');
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  i.click();
}
// ---------- properties ----------
function gfxPropsHTML(g, pg) {
  const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('');
  let s = `<div class="ident">${GFX_TYPES[g.t]}</div><div class="sub">Graphic</div><div class="pgrp"><h4>Style</h4>`;
  if (g.t !== 'image') {
    s += row('gf.w', 'Line width (mm)', g.w || 0.35, 'number', 'step="0.05" min="0.05"');
    if (g.t !== 'dim') s += row('gf.dash', 'Line style', '', 'select', opt([['solid', 'Solid'], ['dash', 'Dashed'], ['dot', 'Dotted'], ['dashdot', 'Dash-dot']], g.dash || 'solid'));
    s += `<div class="prow"><label>Color</label><input type="color" data-k="gf.color" value="${g.color || '#000000'}"></div>`;
    if (g.t === 'rect' || g.t === 'circle') s += `<div class="prow"><label>Fill</label><span class="ckrow"><input type="checkbox" data-k="gf.filled" ${g.fill ? 'checked' : ''} style="width:auto"><input type="color" data-k="gf.fill" value="${g.fill || '#dbe6f7'}"></span></div>`;
    if (g.t === 'dim') s += row('gf.text', 'Text', g.text || '', 'text', `placeholder="${esc(dimText(Object.assign({}, g, { text: '' }), pg))}"`);
  } else {
    const [x0, y0, x1, y1] = bboxPts(g.pts);
    s += row('gf.iw', 'Width (mm)', r2(x1 - x0), 'number', 'step="1" min="2"') + row('gf.opacity', 'Opacity (%)', Math.round((g.opacity ?? 1) * 100), 'number', 'min="5" max="100" step="5"');
  }
  s += (userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(g.layer)) : '') + '</div>';
  return s + '<div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>';
}
function gfxPropChange(g, key, v) {
  commit(() => {
    if (key === 'w') g.w = Math.max(0.05, parseFloat(v) || 0.35);
    else if (key === 'filled') g.fill = v ? (g.fill || '#dbe6f7') : '';
    else if (key === 'fill') g.fill = v;
    else if (key === 'iw') { const [x0, y0, x1, y1] = bboxPts(g.pts); const w = Math.max(2, parseFloat(v) || (x1 - x0)); g.pts = [[x0, y0], [r2(x0 + w), r2(y0 + (y1 - y0) * w / (x1 - x0))]]; }
    else if (key === 'opacity') g.opacity = Math.max(0.05, Math.min(1, (parseFloat(v) || 100) / 100));
    else if (v === '' && key === 'text') delete g.text;
    else g[key] = v;
  });
}
