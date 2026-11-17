// ---------- framing and floor plans: buildings from rooms, floor plans from buildings, 3D views ----------
const DOOR_RO_EXTRA = () => lumberKey() === 'metric' ? 50 : 2 * IN_MM;   // rough opening width over the door leaf

// a building sized from a rectangular room on a floor plan; doors and windows in the walls along the room come along
function frameFromRoom() {
  const pg = page(); if (!isFloor(pg)) { flash('Select a room on a floor plan first'); return; }
  const f = [...sel].map(findFp).find(x => x && x.kind === 'room');
  if (!f) { flash('Select a rectangular room on the floor plan first'); return; }
  const lv = f.lv, s = lvScale(lv), pts = roomPoly(f.r);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const rect = pts.length === 4 && pts.every(p => (Math.abs(p[0] - minx) < 0.05 || Math.abs(p[0] - maxx) < 0.05) && (Math.abs(p[1] - miny) < 0.05 || Math.abs(p[1] - maxy) < 0.05));
  if (!rect) { alert('The building is made from a rectangular room. This room has another shape.'); return; }
  const WD = sizeDepth(0), ops = { front: [], right: [], back: [], left: [] };
  const tol = p => Math.max(1.5, ...lvWalls(lv).map(w => w.th)) + 0.5;
  for (const o of lvShapes(lv).filter(x => x.t === 'opening' && (x.kind === 'door' || x.kind === 'window'))) {
    const w = wallById(lv, o.wall); if (!w) continue; const [cx, cy] = o.c, t = tol();
    let k = null, c = 0;
    if (Math.abs(cy - maxy) < t && cx > minx && cx < maxx) { k = 'front'; c = (cx - minx) * s + WD; }
    else if (Math.abs(cy - miny) < t && cx > minx && cx < maxx) { k = 'back'; c = (maxx - cx) * s + WD; }
    else if (Math.abs(cx - maxx) < t && cy > miny && cy < maxy) { k = 'right'; c = (maxy - cy) * s; }
    else if (Math.abs(cx - minx) < t && cy > miny && cy < maxy) { k = 'left'; c = (cy - miny) * s; }
    if (!k) continue;
    const door = o.kind === 'door', wReal = o.w * s, ro = door ? wReal + DOOR_RO_EXTRA() : wReal;
    const op = newFrameOpening(door ? 'door' : 'window', 1000);
    op.w = Math.round(ro); op.ctr = false; op.x = Math.round(c - ro / 2);
    if (door) op.h = (o.h || 80 * IN_MM) + (lumberKey() === 'metric' ? 60 : 2.5 * IN_MM);
    else { op.h = o.h || op.h; op.sill = o.sill || op.sill; }
    ops[k].push(op);
  }
  newBuildingDlg('building', { name: f.r.name || 'Building', w: (maxx - minx) * s + 2 * WD, d: (maxy - miny) * s + 2 * WD, ops });
}

// a floor plan level with the building's walls, doors, windows and one room inside, for furniture from the block library
function frameToFloor() {
  const b = bldOf(page()); if (!b || b.mode !== 'building') { flash('Open a building\'s framing page first'); return; }
  const M = frameModel(b); if (!M.walls || !M.walls.length) { alert('Fix the framing problems first.'); return; }
  const name = b.name; let np;
  commit(() => {
    useSheet({ size: P.size }); const lv = { id: uid(), name, rooms: [], places: [], image: null, scale: defaultScale(), shapes: [] };
    const s = lv.scale, WD = M.WD, W = M.W, D = M.D;
    const ox = DA.x0 + 20, oy = DA.y1 - 20; const pt = (x, y) => [r2(ox + x / s), r2(oy - y / s)];
    const c = WD / 2, corners = [pt(c, c), pt(W - c, c), pt(W - c, D - c), pt(c, D - c)];
    const mk = (a, z) => { const w = { id: uid(), t: 'wall', a, b: z, th: r2(WD / s * 1000) / 1000, just: 'c', h: M.wallTop, kind: 'Framed ' + sizeName(b.stud) }; lv.shapes.push(w); return w; };
    const walls = { front: mk(corners[0], corners[1]), right: mk(corners[1], corners[2]), back: mk(corners[2], corners[3]), left: mk(corners[3], corners[0]) };
    for (const fw of M.walls) {
      const w = walls[fw.key];
      for (const op of fw.ops) {
        const mid = fw.def.toPlan((op.roL + op.roR) / 2); let p;
        if (fw.key === 'front') p = pt(mid, c); else if (fw.key === 'back') p = pt(mid, D - c); else if (fw.key === 'right') p = pt(W - c, mid); else p = pt(c, mid);
        const door = op.type === 'door', ow = (door ? op.w - DOOR_RO_EXTRA() : op.w) / s;
        const o = { id: uid(), t: 'opening', wall: w.id, c: p, w: r2(ow * 1000) / 1000, kind: op.type, side: 1, hinge: 'a', h: door ? op.h - (lumberKey() === 'metric' ? 60 : 2.5 * IN_MM) : op.h, tag: nextOpeningTag(op.type) };
        if (door) o.style = 'single'; else o.sill = op.sill;
        lv.shapes.push(o);
      }
    }
    lv.rooms.push({ id: uid(), name, pts: [pt(WD, WD), pt(W - WD, WD), pt(W - WD, D - WD), pt(WD, D - WD)] });
    P.levels.push(lv);
    np = newFloorPage(lv.id, 1, name); P.pages.push(np); sortPages(); curId = np.id; sel.clear();
  });
  zoomFit(); flash('Floor plan made. Add furniture from the block library (Annotate, Insert block).');
}

// ---------- 3D views ----------
// The scene is a list of boxes (a footprint polygon in real mm, plan y pointing back, from height z0 to z1) and flat floor
// polygons. Walls on the side facing the camera drop to a low height so the inside stays visible.
const V3 = { yaw: -0.6, pitch: 0.6, zoom: 1, cut: true, scene: null, orbit: null, mode: 'shell', M: null };
function view3D() {
  const pg = page(); let scene = null, title = ''; V3.M = null; V3.mode = 'shell';
  if (isFloor(pg) && levelOf(pg)) { scene = levelScene(levelOf(pg)); title = '3D view of ' + levelOf(pg).name; }
  else if (isFrame(pg) && bldOf(pg)) { const M = frameModel(bldOf(pg)); if (M.errs && M.errs.length) { alert(M.errs.join('\n')); return; } scene = buildingScene(M); V3.M = M; title = '3D view of ' + bldOf(pg).name; }
  if (!scene) { flash('Open a floor plan or framing page for a 3D view'); return; }
  if (!scene.boxes.length && !scene.floors.length) { flash('Nothing to show yet: draw walls, rooms or blocks first'); return; }
  V3.scene = scene; V3.yaw = -0.6; V3.pitch = 0.6; V3.zoom = 1;
  dialog(title, [], null, 'Close', `<div class="v3wrap"><canvas id="v3canvas" class="v3canvas"></canvas><div class="v3bar"><span class="note">Drag to turn, scroll to zoom.</span><span class="v3ctl">${V3.M ? '<span class="seg v3mode"><button type="button" class="on" data-v3mode="shell">Shell</button><button type="button" data-v3mode="framing">Framing</button><button type="button" data-v3mode="exploded">Exploded</button></span>' : ''}<label class="v3cut"><input type="checkbox" id="v3cut" ${V3.cut ? 'checked' : ''}> Lower walls facing me</label> <button type="button" class="btn small" id="v3top">Top</button> <button type="button" class="btn small" id="v3reset">Reset view</button></span></div></div>`);
  const dlg = $('#dlg'); dlg.style.width = '1000px'; dlg.style.maxWidth = '94vw';
  const cv = $('#v3canvas');
  cv.addEventListener('pointerdown', e => { V3.orbit = { x: e.clientX, y: e.clientY, yaw: V3.yaw, pitch: V3.pitch }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (!V3.orbit) return; V3.yaw = V3.orbit.yaw + (e.clientX - V3.orbit.x) * 0.008; V3.pitch = Math.max(0.1, Math.min(1.5, V3.orbit.pitch + (e.clientY - V3.orbit.y) * 0.006)); draw3D(cv); });
  const end = () => { V3.orbit = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => { e.preventDefault(); V3.zoom = Math.max(0.3, Math.min(4, V3.zoom * Math.exp(-e.deltaY * 0.0012))); draw3D(cv); }, { passive: false });
  $('#v3cut').addEventListener('change', e => { V3.cut = e.target.checked; draw3D(cv); });
  document.querySelectorAll('[data-v3mode]').forEach(bt => bt.addEventListener('click', () => { V3.mode = bt.dataset.v3mode; document.querySelectorAll('[data-v3mode]').forEach(x => x.classList.toggle('on', x === bt)); $('.v3cut').style.visibility = V3.mode === 'shell' ? '' : 'hidden'; draw3D(cv); }));
  $('#v3top').addEventListener('click', () => { V3.pitch = 1.5; V3.yaw = 0; draw3D(cv); });
  $('#v3reset').addEventListener('click', () => { V3.yaw = -0.6; V3.pitch = 0.6; V3.zoom = 1; draw3D(cv); });
  requestAnimationFrame(() => draw3D(cv));
}
const rect4 = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// heights for blocks by name or category (mm)
function blockHeight(def, name) {
  const n = String(name || '').toLowerCase(), I = v => v * IN_MM;
  const by = [[/fridge|refrigerator/, 68], [/range|stove|oven|dishwasher|washer|dryer|cabinet|counter|sink|vanity/, 36], [/bed/, 24], [/sofa|loveseat|armchair|chair/, 34],
    [/table|desk|bench/, 30], [/dresser|chest/, 34], [/night/, 24], [/shelf|bookcase/, 72], [/toilet/, 30], [/tub|bath/, 20], [/shower/, 80], [/water heater|furnace|boiler/, 60], [/rug|mat/, 0.5]];
  for (const [re, h] of by) if (re.test(n)) return I(h);
  const cat = (def && def.cat) || ''; return I(cat === 'appliances' ? 36 : cat === 'mechanical' ? 48 : cat === 'fixtures' ? 30 : 30);
}
function levelScene(lv) {
  const s = lvScale(lv), boxes = [], floors = [];
  const R = p => [p[0] * s, -p[1] * s];
  const WALLC = '#e8e2d6', GLASS = '#bcdcec';
  for (const r of lv.rooms) floors.push({ pts: roomPoly(r).map(R), color: '#d6c4a0' });
  for (const w of lvWalls(lv)) {
    const ax = wallAxis(w), H = w.h || WALL_H;
    const ops = openingsOf(lv, w).map(o => { const c = openingAt(o, w); return { a: c - o.w / 2, b: c + o.w / 2, o }; }).sort((a, b) => a.a - b.a);
    const quad = (s0, s1) => [axPt(w, ax, s0, ax.L), axPt(w, ax, s1, ax.L), axPt(w, ax, s1, ax.R), axPt(w, ax, s0, ax.R)].map(R);
    const mid = R(axPt(w, ax, ax.len / 2, 0));
    let pos = 0;
    const seg = (s0, s1, z0, z1, col) => { if (s1 - s0 > 1e-6 && z1 - z0 > 1) boxes.push({ pts: quad(s0, s1), z0, z1, color: col || WALLC, wall: true, mid }); };
    for (const g of ops) {
      seg(pos, g.a, 0, H);
      const o = g.o, door = o.kind === 'door' || o.kind === 'opening', top = door ? (o.h || 80 * IN_MM) : (o.sill || 36 * IN_MM) + (o.h || 48 * IN_MM);
      if (!door) { seg(g.a, g.b, 0, o.sill || 36 * IN_MM); const cm = (ax.L + ax.R) / 2; boxes.push({ pts: [axPt(w, ax, g.a, cm - 0.06), axPt(w, ax, g.b, cm - 0.06), axPt(w, ax, g.b, cm + 0.06), axPt(w, ax, g.a, cm + 0.06)].map(R), z0: o.sill || 36 * IN_MM, z1: top, color: GLASS, glass: true, mid }); }
      seg(g.a, g.b, Math.min(top, H), H); pos = g.b;
    }
    seg(pos, ax.len, 0, H);
  }
  for (const sh of lvShapes(lv)) {
    if (sh.t !== 'insert') continue;
    const def = blockDef(sh.name); const ol = insertOutline(sh).pts.map(R); if (ol.length < 4) continue;
    boxes.push({ pts: ol, z0: 0, z1: Math.max(10, blockHeight(def, sh.name)), color: def && def.cat === 'appliances' ? '#c9cfd4' : def && def.cat === 'fixtures' ? '#f2f2f2' : '#b98b58' });
  }
  return { boxes, floors };
}
function buildingScene(M) {
  const boxes = [], floors = [], b = M.b, R = M.roof, WD = M.WD;
  const W = M.W || M.L, D = M.D || WD; const WALLC = '#e8e2d6', GLASS = '#bcdcec', ROOFC = '#8a6b4a';
  const z0 = M.floor ? M.floor.deckT + M.floor.jd : 0;
  if (M.floor) { boxes.push({ pts: rect4(0, 0, W, D), z0: 0, z1: z0, color: '#c9b68e' }); if (M.floor.skids) M.floor.skidPos.forEach(p => boxes.push({ pts: M.floor.longAxis === 'x' ? rect4(0, p, W, p + M.floor.skidW) : rect4(p, 0, p + M.floor.skidW, D), z0: -M.floor.skidH, z1: 0, color: '#7d6a50' })); }
  floors.push({ pts: rect4(WD, WD, W - WD, D - WD), color: '#d6c4a0', z: z0 + 0.5 });
  for (const fw of M.walls) {
    const d = fw.def, H = fw.wallTop;
    const foot = (a, c) => { if (b.mode === 'wall') return rect4(a, 0, c, WD); const p0 = d.toPlan(a), p1 = d.toPlan(c), lo = Math.min(p0, p1), hi = Math.max(p0, p1);
      if (d.key === 'front') return rect4(lo, 0, hi, WD); if (d.key === 'back') return rect4(lo, D - WD, hi, D); if (d.key === 'right') return rect4(W - WD, lo, W, hi); return rect4(0, lo, WD, hi); };
    const mid = foot(fw.len / 2 - 1, fw.len / 2 + 1)[0];
    const seg = (a, c, h0, h1, col) => { if (c - a > 1 && h1 - h0 > 1) boxes.push({ pts: foot(a, c), z0: z0 + h0, z1: z0 + h1, color: col || WALLC, wall: true, mid }); };
    let pos = 0;
    for (const op of fw.ops) {
      seg(pos, op.roL, 0, H);
      if (op.type === 'window') { seg(op.roL, op.roR, 0, op.sill); const g = foot(op.roL, op.roR).map(p => p.slice()); boxes.push({ pts: g, z0: z0 + op.sill, z1: z0 + op.top, color: GLASS, glass: true, mid, thin: true }); }
      seg(op.roL, op.roR, op.top, H); pos = op.roR;
    }
    seg(pos, fw.len, 0, H);
    // gable and rake walls: the triangle or slope above the plates, in steps
    if (R && d.fill) {
      const n = 12; for (let i = 0; i < n; i++) { const a = fw.len * i / n, c = fw.len * (i + 1) / n; const h = Math.max(R.f(d.toPlan(a)), R.f(d.toPlan(c)), 0); if (h > 5) seg(a, c, H, H + h); }
    }
  }
  if (R) {
    const top = z0 + M.wallTop, th = 20;
    const planes = [];
    const P3 = (u, v) => R.axis === 'x' ? [u, v] : [v, u];   // u across the slope, v along the ridge
    const zAt = u => top + R.f(u) + R.rd * R.sf;
    const v0 = -R.rake, v1 = R.Lr + R.rake;
    if (R.type === 'gable') { planes.push([-R.eave, R.B / 2]); planes.push([R.B / 2, R.B + R.eave]); } else planes.push([-R.eave, R.B + R.eave]);
    for (const [u0, u1] of planes) floors.push({ roof: true, pts3: [[...P3(u0, v0), zAt(u0)], [...P3(u1, v0), zAt(u1)], [...P3(u1, v1), zAt(u1)], [...P3(u0, v1), zAt(u0)]], color: ROOFC, th });
  }
  return { boxes, floors };
}
function draw3D(cv) {
  if (cv && V3.M && V3.mode !== 'shell') { drawSolidsCanvas(cv, V3.M, V3.mode); return; }
  const sc = V3.scene; if (!cv || !sc) return;
  const wpx = cv.clientWidth || 900, hpx = Math.round(Math.max(320, Math.min(620, wpx * 0.62))), dpr = window.devicePixelRatio || 1;
  cv.style.height = hpx + 'px'; cv.width = Math.round(wpx * dpr); cv.height = Math.round(hpx * dpr);
  const ctx = cv.getContext('2d'); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement); ctx.fillStyle = (css.getPropertyValue('--panel2') || '#fff').trim() || '#fff'; ctx.fillRect(0, 0, wpx, hpx);
  const all = []; sc.boxes.forEach(bx => bx.pts.forEach(p => all.push(p))); sc.floors.forEach(f => (f.pts || f.pts3).forEach(p => all.push(p)));
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 2000);
  const tgt = [cx, 700, cy], dist = (size * 1.35 + 2000) / V3.zoom, cp = Math.cos(V3.pitch);
  const cam = [tgt[0] + dist * cp * Math.sin(V3.yaw), tgt[1] + dist * Math.sin(V3.pitch), tgt[2] - dist * cp * Math.cos(V3.yaw)];
  const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]], dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const fwd = norm(sub(tgt, cam)), right = norm(cross([0, 1, 0], fwd)), up = cross(fwd, right), f = hpx * 1.25;
  const proj = Q => { const v = sub(Q, cam), z = dot(v, fwd); if (z < 50) return null; return [wpx / 2 + f * dot(v, right) / z, hpx / 2 - f * dot(v, up) / z]; };
  const light = norm([0.35, 1, -0.5]);
  const shade = (hex, k) => { const n = parseInt(String(hex).replace('#', ''), 16); const g = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${g(n >> 16 & 255)},${g(n >> 8 & 255)},${g(n & 255)})`; };
  const W3 = p => [p[0], p[2], p[1]];   // plan (x, y back, z up) to world (x, up, z back)
  const polys = [];
  const camPlan = [cam[0], cam[2]];
  for (const bx of sc.boxes) {
    let z1 = bx.z1;
    if (V3.cut && bx.wall && bx.mid) { const toCam = [camPlan[0] - cx, camPlan[1] - cy], toWall = [bx.mid[0] - cx, bx.mid[1] - cy]; if (toCam[0] * toWall[0] + toCam[1] * toWall[1] > 0.35 * Math.hypot(...toCam) * Math.hypot(...toWall)) { z1 = Math.min(z1, bx.z0 + 200); if (bx.z0 > 300) continue; } }
    if (bx.glass && V3.cut && z1 !== bx.z1) continue;
    const n = bx.pts.length, bc = [0, (bx.z0 + z1) / 2, 0]; bx.pts.forEach(p => { bc[0] += p[0] / n; bc[2] += p[1] / n; });
    const faces = [bx.pts.map(p => W3([p[0], p[1], z1]))];
    for (let i = 0; i < n; i++) { const a = bx.pts[i], c = bx.pts[(i + 1) % n]; faces.push([W3([a[0], a[1], bx.z0]), W3([c[0], c[1], bx.z0]), W3([c[0], c[1], z1]), W3([a[0], a[1], z1])]); }
    for (const F of faces) {
      const c = [0, 0, 0]; F.forEach(q => { c[0] += q[0] / F.length; c[1] += q[1] / F.length; c[2] += q[2] / F.length; });
      let nn = norm(cross(sub(F[1], F[0]), sub(F[2], F[0]))); if (dot(nn, sub(c, bc)) < 0) nn = nn.map(v => -v);
      if (dot(nn, sub(cam, c)) <= 0) continue;
      polys.push({ F, c, n: nn, color: bx.color, alpha: bx.glass ? 0.55 : 1 });
    }
  }
  for (const fl of sc.floors) {
    if (fl.roof) { const F = fl.pts3.map(W3); const c = [0, 0, 0]; F.forEach(q => { c[0] += q[0] / 4; c[1] += q[1] / 4; c[2] += q[2] / 4; }); let nn = norm(cross(sub(F[1], F[0]), sub(F[2], F[0]))); if (nn[1] < 0) nn = nn.map(v => -v); polys.push({ F, c, n: nn, color: fl.color, alpha: V3.cut ? 0.35 : 1, both: true }); continue; }
    const F = fl.pts.map(p => W3([p[0], p[1], fl.z || 0])); const pts = F.map(proj); if (!pts.every(Boolean)) continue;
    ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fillStyle = fl.color; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  polys.forEach(p => { const v = sub(p.c, cam); p.d = dot(v, v); }); polys.sort((a, c) => c.d - a.d);
  for (const p of polys) {
    const pts = p.F.map(proj); if (!pts.every(Boolean)) continue;
    const k = 0.6 + 0.4 * Math.abs(dot(p.n, light));
    ctx.globalAlpha = p.alpha; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    ctx.fillStyle = shade(p.color, k); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  }
}
window.addEventListener('resize', () => { const cv = document.getElementById('v3canvas'); if (cv && $('#dlg').open) draw3D(cv); });
