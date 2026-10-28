// ---------- sizable symbols: black box, device box, PLC card ----------
// These keep their size and connection points on the item itself (w, h, pins, channels) instead of in the symbol
// definition. Their origin is the top-left corner and they are not rotated.
const pinPos = (it, p) => { const w = it.w || 24, h = it.h || 16; return p.s === 't' ? [p.o, 0] : p.s === 'b' ? [p.o, h] : p.s === 'l' ? [0, p.o] : [w, p.o]; };
// PLC addresses: %I0.0 .. %I0.7, %I1.0 (bit addressing), or %IW64, %IW66 (word addressing, step 2)
function plcAddrs(start, n, kind) {
  const out = []; const bit = /^(.*?)(\d+)\.(\d)$/.exec(start || '');
  if (bit) { let by = +bit[2], b = +bit[3]; for (let i = 0; i < n; i++) { out.push(`${bit[1]}${by}.${b}`); if (++b > 7) { b = 0; by++; } } return out; }
  const wd = /^(.*?)(\d+)$/.exec(start || ''); const step = /A/.test(kind) ? 2 : 1;
  for (let i = 0; i < n; i++) out.push(wd ? `${wd[1]}${+wd[2] + i * step}` : String(i));
  return out;
}
const PLC_KINDS = { DI: ['Digital inputs', '%I0.0', 't'], DO: ['Digital outputs', '%Q0.0', 'b'], DIO: ['Digital inputs and outputs', '%I0.0', 'tb', '%Q0.0'],
  AI: ['Analog inputs', '%IW64', 't'], AO: ['Analog outputs', '%QW64', 'b'], AIO: ['Analog inputs and outputs', '%IW64', 'tb', '%QW64'] };
// channels of a card: inputs on the top edge, outputs on the bottom edge
function plcChannels(it) {
  const k = PLC_KINDS[it.kind || 'DI'] || PLC_KINDS.DI; const out = [];
  const nIn = k[2].includes('t') ? (it.ch || 8) : 0, nOut = k[2] === 'b' ? (it.ch || 8) : k[2] === 'tb' ? (it.cho ?? 8) : 0;
  for (let i = 0; i < nIn; i++) out.push({ x: 8 + i * 8, y: 0, n: i, dir: 'in' });
  for (let i = 0; i < nOut; i++) out.push({ x: 8 + i * 8, y: 16, n: i, dir: 'out' });
  return out;
}
function plcCl(it) {
  const k = PLC_KINDS[it.kind || 'DI'] || PLC_KINDS.DI; const ch = plcChannels(it);
  const nIn = ch.filter(c => c.dir === 'in').length, nOut = ch.length - nIn;
  if (k[2] === 'tb') return plcAddrs(it.a0 || k[1], nIn, it.kind).concat(plcAddrs(it.a1 || k[3], nOut, it.kind));
  return plcAddrs(it.a0 || k[1], ch.length, it.kind);
}
const plcW = it => Math.max(1, ...plcChannels(it).map(c => c.n + 1)) * 8 + 8;
Object.assign(SYM, {
  bbox: { name: 'Black box', cat: 'Boxes', prefix: 'A', role: 'main', fixed: true, sized: true, rotates: true,
    conns: [[8, 0, '1'], [16, 0, '2'], [8, 16, '3'], [16, 16, '4']], box: [0, 0, 24, 16],
    boxOf: it => [0, 0, it.w || 24, it.h || 16],
    connsOf: it => (it.pins || [{ s: 't', o: 8 }, { s: 't', o: 16 }, { s: 'b', o: 8 }, { s: 'b', o: 16 }]).map((p, i) => [...pinPos(it, p), (it.cl || [])[i] || '']),
    init: it => { it.w = 24; it.h = 16; it.pins = [{ s: 't', o: 8 }, { s: 't', o: 16 }, { s: 'b', o: 8 }, { s: 'b', o: 16 }]; it.cl = ['1', '2', '3', '4']; },
    draw: it => `<rect x="0" y="0" width="${it.w || 24}" height="${it.h || 16}" stroke-width="0.35"/>`,
    texts: it => it.btext ? String(it.btext).split('\n').map((l, i, a) => [(it.w || 24) / 2, (it.h || 16) / 2 + (i - (a.length - 1) / 2) * 3.2 + 0.9, l, 2.5]) : [] },
  dbox: { name: 'Device box', cat: 'Boxes', prefix: 'A', role: 'main', fixed: true, sized: true, edge: true,
    conns: [], box: [0, 0, 40, 24],
    boxOf: it => [0, 0, it.w || 40, it.h || 24], connsOf: () => [],
    init: it => { it.w = 40; it.h = 24; it.cl = []; },
    draw: it => `<rect x="0" y="0" width="${it.w || 40}" height="${it.h || 24}" stroke-width="0.3" stroke-dasharray="3,1,0.5,1"/>` },
  plccard: { name: 'PLC card', cat: 'PLC', prefix: 'A', role: 'main', fixed: true, sized: true, card: true, rotates: true,
    conns: [], box: [0, 0, 72, 16],
    boxOf: it => [0, 0, plcW(it), 16],
    connsOf: it => plcChannels(it).map((c, i) => [c.x, c.y, (it.cl || [])[i] || '']),
    init: it => { it.ch = 8; it.cho = 8; it.kind = 'DI'; it.a0 = '%I0.0'; it.cl = plcCl(it); },
    draw: it => { let s = `<rect x="0" y="0" width="${plcW(it)}" height="16" stroke-width="0.35"/>`; for (const c of plcChannels(it)) s += `<path d="M${c.x},${c.y ? '16V14' : '0V2'}" stroke-width="0.3"/>`; return s; },
    texts: it => {
      const ch = plcChannels(it); const both = ch.some(c => c.dir === 'in') && ch.some(c => c.dir === 'out');
      const t = [[plcW(it) / 2, both ? 9 : ch[0] && ch[0].dir === 'in' ? 12.5 : 5, `${it.kind || 'DI'} ${both ? ch.filter(c => c.dir === 'in').length + '/' + ch.filter(c => c.dir === 'out').length : ch.length}`, 2.6, true]];
      for (const c of ch) t.push([c.x, c.dir === 'in' ? 5.2 : 12.2, String(c.n), 1.9]);
      return t;
    } },
});
SYMORDER.push('bbox', 'dbox', 'plccard');
for (const k of ['bbox', 'dbox', 'plccard']) SYM[k].ind = true;

// ---------- device boxes: symbols inside take the box's device name ----------
function inRect(x, y, b) { return x > b[0] && x < b[2] && y > b[1] && y < b[3]; }
const boxRect = it => [it.x, it.y, it.x + (it.w || 40), it.y + (it.h || 24)];
function syncDeviceBoxes() {
  let changed = false;
  for (const pg of P.pages) {
    if (isFloor(pg)) continue;
    const boxes = pg.items.filter(i => i.sym === 'dbox');
    for (const it of pg.items) {
      const d = SYM[it.sym]; if (!d || !d.prefix || d.sized || it.sym === 'term' || d.role === 'plc' || d.res) continue;
      const b = boxes.find(bx => inRect(it.x, it.y, boxRect(bx)));
      if (b) {
        if (it.inBox !== b.id || it.fn !== b.fn || it.loc !== b.loc || it.tag !== b.tag || it.role === 'main') {
          const retag = it.tag !== b.tag || it.fn !== b.fn || it.loc !== b.loc;
          it.inBox = b.id; if (it.role === 'main') { it.wasMain = true; it.role = 'aux'; }
          it.fn = b.fn; it.loc = b.loc; it.tag = b.tag;
          if (retag) assignContactNumbers(it);
          changed = true;
        }
      } else if (it.inBox) {
        delete it.inBox;
        if (it.wasMain) { it.role = 'main'; delete it.wasMain; }
        it.tag = nextTag(it.fn, it.loc, d.prefix); changed = true;
      }
    }
  }
  return changed;
}
// moving a device box moves what is inside it
function moveSet(orig) {
  const mv = new Set(sel);
  for (const bx of orig.items) if (bx.sym === 'dbox' && sel.has(bx.id)) {
    const r = boxRect(bx);
    for (const it of orig.items) if (it !== bx && inRect(it.x, it.y, r)) mv.add(it.id);
    for (const w of orig.wires) if (w.pts.every(p => inRect(p[0], p[1], r))) mv.add(w.id);
  }
  return mv;
}

// ---------- properties for sized symbols ----------
function sizedPropsHTML(it) {
  const d = SYM[it.sym]; let s = '';
  if (it.sym === 'bbox') {
    const pins = it.pins || [];
    s += `<div class="pgrp"><h4>Black box</h4>${row('bx.w', 'Width (mm)', it.w || 24, 'number', 'step="4" min="8"')}${row('bx.h', 'Height (mm)', it.h || 16, 'number', 'step="4" min="8"')}${row('bx.btext', 'Text inside', it.btext || '', 'textarea')}</div>`;
    s += `<div class="pgrp"><h4>Connection points</h4><table class="pintab"><tr><th>Edge</th><th>Offset</th><th>Designation</th><th></th></tr>${pins.map((p, i) => `<tr><td><select data-k="pin.${i}.s">${[['t', 'Top'], ['b', 'Bottom'], ['l', 'Left'], ['r', 'Right']].map(([k, l]) => `<option value="${k}" ${p.s === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td><input type="number" step="4" min="0" data-k="pin.${i}.o" value="${p.o}"></td><td><input data-k="cl.${i}" value="${esc((it.cl || [])[i] || '')}"></td><td><button class="btn small" data-pindel="${i}" title="Remove">×</button></td></tr>`).join('')}</table>
      <div class="btnrow"><button class="btn small" data-act="bbAddPin">Add connection point</button></div><div class="note">Offsets are measured from the left (top and bottom edges) or from the top (left and right edges).</div></div>`;
  } else if (it.sym === 'dbox') {
    const n = (page().items || []).filter(o => o.inBox === it.id).length;
    s += `<div class="pgrp"><h4>Device box</h4>${row('bx.w', 'Width (mm)', it.w || 40, 'number', 'step="4" min="8"')}${row('bx.h', 'Height (mm)', it.h || 24, 'number', 'step="4" min="8"')}<div class="note">${n} symbol(s) inside. Symbols placed inside the box become functions of this device and take its name. Moving the box moves them too.</div></div>`;
  } else if (it.sym === 'plccard') {
    const mixed = (PLC_KINDS[it.kind || 'DI'] || [])[2] === 'tb';
    s += `<div class="pgrp"><h4>PLC card</h4>${row('bx.kind', 'Type', '', 'select', Object.entries(PLC_KINDS).map(([k, v]) => `<option value="${k}" ${(it.kind || 'DI') === k ? 'selected' : ''}>${v[0]}</option>`).join(''))}
      ${row('bx.ch', mixed ? 'Inputs' : 'Channels', it.ch || 8, 'number', 'min="1" max="32"')}${row('bx.a0', mixed ? 'First input address' : 'Start address', it.a0 || '', 'text', 'placeholder="e.g. %I0.0"')}
      ${mixed ? row('bx.cho', 'Outputs', it.cho ?? 8, 'number', 'min="0" max="32"') + row('bx.a1', 'First output address', it.a1 || '', 'text', `placeholder="${PLC_KINDS[it.kind][3]}"`) : ''}
      <div class="note">Inputs connect on the top edge and outputs on the bottom edge. Addresses fill in from the start address. Edit single addresses under Connection points.</div></div>`;
  }
  return s;
}
function sizedPropChange(it, scope, key, v) {
  if (scope === 'pin') {
    const [i, f] = key.split('.');
    transformSel(x => { x.pins = clone(x.pins || []); x.pins[+i][f] = f === 'o' ? Math.max(0, snap(parseFloat(v) || 0)) : v; }, [it]);
    return true;
  }
  if (scope !== 'bx') return false;
  if (key === 'w' || key === 'h') { transformSel(x => { x[key] = Math.max(8, snap(parseFloat(v) || 8)); }, [it]); return true; }
  if (['ch', 'cho', 'kind', 'a0', 'a1'].includes(key)) {
    transformSel(x => {
      if (key === 'ch') x.ch = Math.max(1, Math.min(32, parseInt(v, 10) || 8));
      else if (key === 'cho') x.cho = Math.max(0, Math.min(32, parseInt(v, 10) || 0));
      else if (key === 'kind') {
        x.kind = v; const k = PLC_KINDS[v];
        if (!x.a0 || Object.values(PLC_KINDS).some(q => q[1] === x.a0 || q[3] === x.a0)) x.a0 = k[2] === 'b' ? k[1] : k[1];
        if (k[3] && (!x.a1 || Object.values(PLC_KINDS).some(q => q[1] === x.a1 || q[3] === x.a1))) x.a1 = k[3];
      }
      else x[key] = v;
      x.cl = plcCl(x);
    }, [it]);
    return true;
  }
  commit(() => { it[key] = v; });
  return true;
}
function bbAddPin() {
  const f = findItem([...sel][0]); const it = f && f.it; if (!it || it.sym !== 'bbox') return;
  commit(() => {
    it.pins = it.pins || []; const used = new Set(it.pins.filter(p => p.s === 't').map(p => p.o));
    let o = 4; while (used.has(o) && o < (it.w || 24)) o += 4;
    if (o >= (it.w || 24)) it.w = o + 4;
    it.pins.push({ s: 't', o }); it.cl = it.cl || []; it.cl[it.pins.length - 1] = String(it.pins.length);
  });
}
$('#props').addEventListener('click', e => {
  const b = e.target.closest('[data-pindel]'); if (!b) return;
  const f = findItem([...sel][0]); const it = f && f.it; if (!it) return;
  const i = +b.dataset.pindel;
  commit(() => { it.pins.splice(i, 1); (it.cl || []).splice(i, 1); });
});
