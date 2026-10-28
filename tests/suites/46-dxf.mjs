// DXF import (R12, R2000, R2018) and export (R2000, checked with ezdxf when it is installed), SVG and PNG export.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const goFloor = t => t.eval(() => { goPage(P.pages.find(x => x.kind === 'floor' && x.view === 'level').id); zoomFit(); });
const blank = async t => { await t.open('#home'); await goFloor(t); await t.eval(() => { const lv = levelOf(page()); lv.rooms = []; lv.places = []; lv.shapes = []; P.ulayers = []; sel = new Set(); render(); }); };
const fixture = (t, n) => fs.readFileSync(path.join(t.root, 'tests', 'fixtures', n), 'utf8');
const counts = (t, text) => t.eval(text => { const d = dxfRead(text); const c = {}; for (const s of d.shapes) c[s.t] = (c[s.t] || 0) + 1; return { c, unit: d.unit, skipped: d.skipped }; }, text);
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
function ezdxf(file) {
  try { return JSON.parse(execFileSync('python3', ['-c', `
import ezdxf, json, sys
doc = ezdxf.readfile(sys.argv[1]); a = doc.audit()
c = {}
for e in doc.modelspace(): c[e.dxftype()] = c.get(e.dxftype(), 0) + 1
print(json.dumps({'errors': len(a.errors), 'fixes': len(a.fixes), 'version': doc.dxfversion, 'units': doc.header.get('$INSUNITS'), 'counts': c, 'layers': sorted(l.dxf.name for l in doc.layers)}))
`, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { return null; }
}

export const tests = {
  'DXF import reads R12, R2000 and R2018 files': async t => {
    await t.open('#home');
    const r12 = await counts(t, fixture(t, 'room-r12.dxf')), r2000 = await counts(t, fixture(t, 'room-r2000.dxf')), r2018 = await counts(t, fixture(t, 'room-r2018.dxf'));
    t.eq(r12.c, { pline: 1, line: 2, circle: 2, arc: 1, text: 1 }); t.eq(r12.unit, null, 'R12 files have no units');
    const full = { pline: 3, ellipse: 1, text: 2, line: 2, circle: 2, arc: 1 }; // the spline is stored by control points, so it comes in as a traced polyline
    t.eq(r2000.c, full); t.eq(r2018.c, full); t.eq([r2000.unit, r2018.unit], [25.4, 25.4]);
  },
  'imported geometry lands at real size, with layers, colors, line types, bulges and blocks': async t => {
    await blank(t);
    const text = fixture(t, 'room-r2018.dxf');
    const r = await t.eval(text => {
      const lv = levelOf(page()); const d = dxfRead(text); dxfPlace(d, lv, { unit: 25.4, place: 'center', layers: true }); render();
      const room = lv.shapes.find(s => s.t === 'pline' && s.closed); const b = bboxPts(room.pts);
      const bul = lv.shapes.find(s => s.t === 'pline' && s.b); const arc = lv.shapes.find(s => s.t === 'arc');
      const dashed = lv.shapes.find(s => s.t === 'line' && s.dash); const blockLine = lv.shapes.find(s => s.t === 'line' && !s.dash);
      return [r2(b[2] - b[0]), r2(b[3] - b[1]), room.color, P.ulayers.map(l => l.name).sort(), bul.b[0], [arc.r, arc.a0, arc.a1], !!dashed, r2(blockLine.a[0] - blockLine.b[0]), r2(Math.abs(blockLine.a[1] - blockLine.b[1])), lv.shapes.some(s => s.t === 'text' && s.text === 'Living room')];
    }, text);
    t.eq(r[0], 127); t.eq(r[1], 76.2); t.eq(r[2], '#e00000', 'WALLS layer color');
    t.eq(r[3], ['0', 'FURN', 'WALLS']); t.eq(r[4], 1);
    t.ok(near(r[5][0], 36 * 25.4 / 48) && r[5][1] === 180 && r[5][2] === 270, 'arc');
    t.ok(r[6], 'dashed line type'); t.eq([r[7], r[8]], [0, 12.7], 'block rotated 90 degrees'); t.ok(r[9], 'mtext');
  },
  'import dialog: new level, scale picked to fit the page': async t => {
    await t.open('#home');
    const text = fixture(t, 'room-r12.dxf');
    await t.eval(text => dxfImportDlg(dxfRead(text), 'room-r12.dxf'), text);
    await t.page.selectOption('#dlgbody select[name="level"]', '__new'); await t.page.fill('#dlgbody input[name="newName"]', 'Garage'); await t.confirm();
    const r = await t.eval(() => { const lv = P.levels.find(l => l.name === 'Garage'); return [!!lv, lv && lv.shapes.length, page().level === (lv || {}).id, lv && lv.scale]; });
    t.eq(r.slice(0, 3), [true, 7, true]); t.ok(r[3] >= 24, 'a scale that fits');
  },
  'DXF export writes a valid R2000 file that reads back': async t => {
    await blank(t);
    const text = await t.eval(() => {
      const lv = levelOf(page()); const I = 25.4 / 48;
      lv.shapes = [
        { id: 'w1', t: 'wall', a: [60, 60], b: [180, 60], th: 4.5 * I, just: 'c', h: 2438.4, kind: '2x4 interior' }, { id: 'o1', t: 'opening', wall: 'w1', c: [100, 60], w: 36 * I, kind: 'door', style: 'single', side: -1, hinge: 'a', tag: 'D1', h: 2032 },
        { id: 'l1', t: 'line', a: [60, 100], b: [123.5, 100], dash: 'dash' }, { id: 'a1', t: 'arc', c: [150, 120], r: 10, a0: 0, a1: 90 }, { id: 'c1', t: 'circle', c: [200, 120], r: 8 },
        { id: 'e1', t: 'ellipse', c: [240, 120], rx: 6, ry: 12, rot: 0 }, { id: 'p1', t: 'pline', pts: [[60, 150], [100, 150], [100, 180]], b: [0, 0.5], wd: [[1, 1], [0, 0]] },
        { id: 't1', t: 'text', p: [60, 200], text: 'Hello', h: 2.5, rot: 0 }, { id: 'd1', t: 'dim', kind: 'lin', p1: [60, 100], p2: [123.5, 100], loc: [90, 90], dir: 'h' },
      ];
      lv.rooms = [{ id: 'r1', name: 'Den', pts: [[60, 60], [180, 60], [180, 140], [60, 140]] }];
      return dxfWrite(lv);
    });
    t.ok(/AC1015/.test(text) && /\$INSUNITS\r\n 70|\$INSUNITS\r\n70\r\n1/.test(text.replace(/ /g, '')), 'R2000 header in inches');
    const file = path.join(os.tmpdir(), 'openschem-export.dxf'); fs.writeFileSync(file, text);
    const back = await t.eval(text => { const d = dxfRead(text); const c = {}; for (const s of d.shapes) c[s.t] = (c[s.t] || 0) + 1; const ln = d.shapes.find(s => s.t === 'line' && s._layer === '0'); return { c, unit: d.unit, len: ln ? Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]) : 0 }; }, text);
    t.eq(back.unit, 25.4); t.ok(near(back.len, 120, 0.01), 'a 10 ft line comes back 120 in long: ' + back.len);
    t.ok(back.c.ellipse === 1 && back.c.circle >= 1 && back.c.arc >= 2 && back.c.text >= 2, JSON.stringify(back.c));
    const ez = ezdxf(file);
    if (ez) { t.eq([ez.errors, ez.version, ez.units], [0, 'AC1015', 1], JSON.stringify(ez)); t.ok(['A-WALL', 'A-DOOR', 'A-AREA', 'A-ANNO-DIMS'].every(l => ez.layers.includes(l)), ez.layers.join()); t.ok(ez.counts.LWPOLYLINE >= 3, JSON.stringify(ez.counts)); }
    else console.log('    (ezdxf not installed: skipped the external DXF check)');
  },
  'SVG and PNG export of a page': async t => {
    await t.open('#home'); await goFloor(t);
    const r = await t.eval(async () => {
      const s = pageSvgText(page()); const doc = new DOMParser().parseFromString(s.text, 'image/svg+xml');
      const bad = doc.querySelector('parsererror'); const png = await svgToPng(s.text, s.w, s.h, 96);
      return [!!bad, s.text.startsWith('<?xml'), doc.documentElement.getAttribute('width'), doc.querySelectorAll('[class]').length, png.slice(0, 22), png.length > 5000, s.text.includes('Kitchen')];
    });
    t.eq(r.slice(0, 5), [false, true, '420mm', 0, 'data:image/png;base64,']); t.ok(r[5] && r[6]);
  },
};
