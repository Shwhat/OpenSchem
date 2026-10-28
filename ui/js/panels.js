// ---------- panels ----------
let devFilter = '';
function renderDevices() {
  const el = $('#tab-devices');
  const q = devFilter.toLowerCase();
  const devs = [...IX.dev.values()].sort((a, b) => natCmp(a.fn, b.fn) || natCmp(a.loc, b.loc) || natCmp(a.tag, b.tag));
  let s = `<input class="search" id="devsearch" placeholder="Filter devices" value="${esc(devFilter)}">`;
  for (const d of devs) {
    const id = dispFull(d.fn, d.loc, d.tag);
    const desc = (d.main || d.items[0]).desc || '';
    if (q && !(id + ' ' + desc + ' ' + d.items.map(i => i.part || '').join(' ')).toLowerCase().includes(q)) continue;
    const first = d.main || d.items[0];
    s += `<div class="dev"><div class="devhead" data-goto="${first.id}"><b>${esc(id)}</b><span class="d">${esc(desc)}</span></div>`;
    for (const it of d.items) {
      const p = IX.pos.get(it.id);
      const nm = it.sym === 'term' ? `Terminal ${it.tn || ''}` : SYM[it.sym].name;
      const cl = it.sym === 'term' ? '' : it.role === 'plc' ? (it.addr || '') : clText(it);
      s += `<div class="devfn" data-goto="${it.id}" title="${esc(nm + ' ' + cl)}">${it.role === 'main' && !SYM[it.sym].res ? '<span class="badge main">main</span>' : ''}<span class="n">${esc(nm)}</span><span class="c">${esc(cl)}</span><span class="r">${esc(IX.pos.get(it.id).pg ? ref(page(), it) : 'floor plan')}</span></div>`;
    }
    s += '</div>';
  }
  if (IX.ips.size) {
    s += '<div class="navgroup">Interruption points</div>';
    for (const [name, list] of [...IX.ips.entries()].sort((a, b) => natCmp(a[0], b[0]))) {
      s += `<div class="dev"><div class="devhead" data-goto="${list[0].id}"><b>${esc(name)}</b><span class="d">${list.length} location(s)</span></div>`;
      for (const it of list) { const p = IX.pos.get(it.id); s += `<div class="devfn" data-goto="${it.id}"><span>Interruption point</span><span class="r">${esc(pageName(p.pg))}.${p.col}</span></div>`; }
      s += '</div>';
    }
  }
  el.innerHTML = s;
  const inp = $('#devsearch'); inp.oninput = () => { devFilter = inp.value; renderDevices(); const i2 = $('#devsearch'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); };
}
function gotoItem(id) {
  if (String(id).startsWith('page:')) { goPage(id.slice(5)); return; }
  const f = findItem(id); if (!f) return;
  if (!f.pg) { showOnFloor(id); return; }
  if (f.cab) { curId = f.pg.id; sel = new Set([id]); render(); centerOn(f.cab.x1, f.cab.y1); return; }
  if (f.g || f.lo) { curId = f.pg.id; sel = new Set([id]); render(); const c = f.g ? gfxBox(f.g) : toLSheet(f.pg, f.lo.x, f.lo.y); centerOn(c[0], c[1]); return; }
  curId = f.pg.id; sel = new Set([id]); render();
  const o = f.it || { x: f.w.pts[0][0], y: f.w.pts[0][1] }; centerOn(o.x, o.y);
}
// ---------- properties ----------
function clText(it) {
  const cl = it.cl || []; const c = symConns(it);
  const paired = c.length % 2 === 0 && c.every((p, i) => i % 2 || p[0] === c[i + 1][0]);
  if (!paired) return cl.filter(Boolean).join(' ');
  const out = []; for (let i = 0; i < cl.length; i += 2) out.push(`${cl[i] || ''}-${cl[i + 1] || ''}`); return out.join(' ');
}
const row = (k, label, v, type = 'text', extra = '') => {
  if (type === 'textarea') return `<div class="prow"><label>${label}</label><textarea data-k="${k}" ${extra}>${esc(v)}</textarea></div>`;
  if (type === 'select') return `<div class="prow"><label>${label}</label><select data-k="${k}">${extra}</select></div>`;
  return `<div class="prow"><label>${label}</label><input type="${type}" data-k="${k}" value="${esc(v)}" ${extra}></div>`;
};
function renderProps() {
  const el = $('#props'); const pg = page();
  const ids = [...sel];
  if (isFloor(pg)) { renderFloorProps(pg); return; }
  if (isLayout(pg)) { renderLayoutProps(pg); return; }
  if (pg.report) {
    el.innerHTML = `<div class="ident">${esc(pg.title)}</div><div class="sub">Generated report, sheet ${pg.sheet} of ${pg.sheets}</div>
      <div class="pgrp"><h4>Report</h4><div class="note">${pg.report === 'cover' ? 'Generated from the project properties (name, description, company, drawn by). Turn it off in Project properties.' : pg.report === 'toc' ? 'Every page with its description and latest revision. Click a row to open that page.' : pg.report === 'conn' ? 'Every connection with its source and target, wire number, color and size.' : pg.report === 'cables' || pg.report === 'cabdiag' ? 'Cables with their conductors and where each one goes. Draw cables with the Cable tool.' : pg.report === 'rev' ? 'All revisions and the pages changed in each. Manage them in Project > Revisions.' : pg.report === 'bom' ? 'Grouped by part number. Enter part numbers on the main function of each device (or on each terminal).' : pg.report === 'panel' ? 'One row per breaker, sorted by slot. Set slot, amps and panel on each breaker. Rooms come from the devices on each circuit.' : 'One row per terminal, sorted by terminal number. Targets are found by following connections from each side of the terminal.'} Click a row to jump to the device.</div>
      <div class="btnrow">${['bom', 'panel', 'term'].includes(pg.report) ? `<button class="btn" data-act="${pg.report === 'bom' ? 'exportBOM' : pg.report === 'panel' ? 'exportPanel' : 'exportTerminals'}">Export CSV</button>` : ''}<button class="btn" data-act="exportPDF">Export PDF</button><button class="btn" data-act="printAll">Print / PDF</button>${pg.report === 'term' ? '<button class="btn" data-act="terminalEditor">Edit strip...</button>' : ''}${pg.report === 'bom' ? '<button class="btn" data-act="exportBOMXlsx">Export Excel</button>' : ''}${pg.report === 'panel' ? '<button class="btn" data-act="panelDirectoryDlg">Breaker labels...</button>' : ''}</div></div>`;
    return;
  }
  if (!ids.length) {
    const p = IX ? pg.items.length : 0;
    el.innerHTML = `<div class="ident">Page ${esc(pageName(pg))}</div><div class="sub">${esc(pg.desc)}</div>
      <div class="pgrp"><h4>Page</h4>${row('pg.fn', L('fn'), pg.fn)}${row('pg.loc', L('loc'), pg.loc)}${row('pg.num', 'Page number', pg.num)}${row('pg.desc', 'Description', pg.desc)}${row('pg.size', 'Paper size', '', 'select', SHEET_OPTS().map(([k, l]) => `<option value="${k}" ${(pg.size || P.size || 'A3L') === k ? 'selected' : ''}>${esc(l)}</option>`).join(''))}</div>
      ${pg.fn && allCircuits().includes(pg.fn) ? `<div class="pgrp"><h4>Circuit color</h4><div class="prow"><label>${esc(dispCkt(pg.fn))}</label><input type="color" data-k="ckt.${esc(pg.fn)}" value="${circuitColor(pg.fn)}"></div></div>` : ''}
      <div class="pgrp"><h4>Content</h4><div class="note">${p} symbol(s), ${pg.wires.length} connection(s)</div></div>
      <div class="pgrp"><h4>Project</h4>${row('pr.name', 'Project name', P.name)}${row('pr.company', 'Company', P.company)}${row('pr.author', 'Drawn by', P.author)}</div>`;
    return;
  }
  if (ids.length > 1) {
    const objs = ids.map(id => findItem(id)).filter(Boolean).map(objOf); const lys = [...new Set(objs.map(o => o.layer || ''))];
    el.innerHTML = `<div class="ident">${ids.length} objects selected</div>${userLayers().length ? `<div class="pgrp"><h4>Layer</h4>${row('ly.set', 'Layer', '', 'select', (lys.length > 1 ? '<option value="__" selected>(mixed)</option>' : '') + layerOptions(lys.length > 1 ? '__' : lys[0]))}</div>` : ''}<div class="btnrow"><button class="btn" data-act="rotateSel">Rotate (R)</button><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  const f = findItem(ids[0]); if (!f) { el.innerHTML = ''; return; }
  if (f.g) { el.innerHTML = gfxPropsHTML(f.g, pg); return; }
  if (f.cab) {
    const c = f.cab; const cr = cableCrossings(pg, c);
    const colOpts = v => [['', '(wire color)'], ['BK', 'Black'], ['WH', 'White'], ['RD', 'Red'], ['BL', 'Blue'], ['GN', 'Green'], ['BARE', 'Bare'], ['YL', 'Yellow']].map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('');
    el.innerHTML = `<div class="ident">${esc(home() ? 'Cable ' + c.tag.replace(/^W/, '') : fl(c.fn, c.loc) + '-' + c.tag)}</div><div class="sub">Cable, ${cr.length} conductor(s)</div>
      <div class="pgrp"><h4>Cable</h4>${row('cab.tag', L('tag'), c.tag)}${row('cab.ctype', 'Type', c.ctype || '', 'text', 'placeholder="e.g. 14/2 w/G NM-B"')}${row('cab.len', 'Length', c.len || '', 'text', 'placeholder="e.g. 25 ft"')}${row('cab.part', 'Part number', c.part || '', 'text', 'list="dl-parts"')}${partDatalist()}${partInfoHTML(c.part)}${row('cab.desc', L('desc'), c.desc || '', 'textarea')}
      <div class="btnrow"><button class="btn small" data-act="cableAutoType">Set type from wires</button></div>${(userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(c.layer)) : '')}</div>
      <div class="pgrp"><h4>Conductors</h4>${cr.length ? cr.map((x, i) => row('cond.' + x.w.id, `${i + 1}. wire ${esc(WN.get(x.w.id) || '')}`, '', 'select', colOpts((c.cond || {})[x.w.id] || ''))).join('') : '<div class="note">Drag the cable across the wires it carries.</div>'}</div>
      <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  if (f.w) {
    const w = f.w;
    el.innerHTML = `<div class="ident">Connection</div><div class="sub">Wire number: <b>${esc(WN.get(w.id) || '(none)')}</b></div>
      <div class="pgrp"><h4>Connection</h4>${row('w.no', 'Wire number', w.no || '', 'text', 'placeholder="auto"')}
      ${row('w.color', 'Color', '', 'select', [['', '(none)'], ['BK', 'Black (BK)'], ['WH', 'White (WH)'], ['GN', 'Green (GN)'], ['BARE', 'Bare copper'], ['RD', 'Red (RD)'], ['BL', 'Blue (BL)'], ['YL', 'Yellow (YL)']].map(([v, l]) => `<option value="${v}" ${(w.color || '') === v ? 'selected' : ''}>${l}</option>`).join(''))}
      ${row('w.awg', 'Wire size', '', 'select', [['', '(none)'], ['14', '14 AWG'], ['12', '12 AWG'], ['10', '10 AWG'], ['8', '8 AWG'], ['6', '6 AWG'], ['4', '4 AWG']].map(([v, l]) => `<option value="${v}" ${(w.awg || '') === v ? 'selected' : ''}>${l}</option>`).join(''))}
      ${row('w.cs', 'Cross-section', w.cs || '', 'text', 'placeholder="e.g. 1.5 mm2"')}
      ${(userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(w.layer)) : '')}<div class="note">A wire number entered here applies to the whole potential (all connected wires).</div></div>
      <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  const it = f.it;
  if (it.sym === 'text') {
    el.innerHTML = `<div class="ident">Text</div><div class="pgrp">${row('it.text', 'Text', it.text, 'textarea')}${row('it.size', 'Height (mm)', it.size || 3.5, 'number', 'step="0.5" min="1"')}<div class="prow"><label>Bold</label><input type="checkbox" data-k="it.bold" ${it.bold ? 'checked' : ''} style="width:auto"></div>${(userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(it.layer)) : '')}</div><div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  const d = SYM[it.sym];
  let s = '';
  if (d.role === 'ip') {
    const others = (IX.ips.get(it.ipName) || []).filter(o => o !== it);
    s += `<div class="ident">Interruption point ${esc(it.ipName)}</div><div class="sub">${d.name}</div>
      <div class="pgrp"><h4>Properties</h4>${row('it.ipName', 'Name', it.ipName, 'text', 'list="dl-ip"')}<datalist id="dl-ip">${[...IX.ips.keys()].map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
      <div class="pgrp"><h4>Cross-references</h4><div class="fnlist">${others.map(o => `<div data-goto="${o.id}"><span>${esc(o.ipName)}</span><span class="r">${esc(ref(pg, o))}</span></div>`).join('') || '<span class="note">No partner on another page yet.</span>'}</div></div>`;
  } else if (d.role === 'pe') {
    s += `<div class="ident">PE / ground</div><div class="sub">Joins the PE potential</div>`;
  } else {
    const dv = IX.dev.get(devKey(it));
    const sameFL = [...IX.dev.values()].filter(x => x.fn === (it.fn || '') && x.loc === (it.loc || ''));
    const tagOpts = sameFL.filter(x => (d.role === 'term') === x.items.some(i => i.sym === 'term')).map(x => `<option value="${esc(x.tag)}">`).join('');
    s += `<div class="ident">${esc(dispFull(it.fn, it.loc, it.tag))}${it.sym === 'term' ? ':' + esc(it.tn) : ''}</div><div class="sub">${d.name}${it.role === 'main' ? ' (main function)' : it.role === 'aux' ? ' (auxiliary function)' : ''}</div>`;
    s += `<div class="pgrp"><h4>${home() ? 'Name' : 'Device tag'}</h4>${row('it.fn', L('fn'), it.fn)}${row('it.loc', L('loc'), it.loc, 'text', 'list="dl-room"')}<datalist id="dl-room">${roomNames().map(c => `<option value="${esc(c)}">`).join('')}</datalist>${row('it.tag', d.role === 'term' ? 'Terminal strip' : L('tag'), it.tag, 'text', 'list="dl-tags"')}<datalist id="dl-tags">${tagOpts}</datalist>`;
    if (d.brk) {
      const ci = circuitInfo(it);
      s += row('it.run', 'Run length', it.run || '', 'text', `placeholder="${ci.len && !it.run ? esc(Math.round(ci.len) + ' ft from cables') : 'e.g. 50 ft'}"`);
      s += `<div class="note">Load ${Math.round(ci.load)} VA, ${fmtPct(ci.pct)} of ${ci.amps} A at ${ci.volts} V${ci.vd != null ? `, voltage drop ${fmtPct(ci.vd)} (${ci.awg} AWG, ${Math.round(ci.len)} ft)` : ''}${ci.pct > 80 ? ' · above 80%' : ''}${ci.vd > 3 ? ' · above 3% drop' : ''}</div>`;
      const pans = [...IX.dev.values()].filter(x => x.items.some(i => i.sym === 'rpnl')).map(x => x.tag);
      s += row('it.slot', 'Panel slot', it.slot || '') + row('it.amps', 'Amps', '', 'select', ['15', '20', '25', '30', '40', '50', '60'].map(a => `<option ${String(it.amps || d.amps) === a ? 'selected' : ''}>${a}</option>`).join(''));
      s += row('it.panel', 'Panel', '', 'select', ['<option value="">(none)</option>'].concat(pans.map(p => `<option value="${esc(p)}" ${it.panel === p ? 'selected' : ''}>${esc(dispTag(p))}</option>`)).join(''));
    }
    if (d.role === 'term') s += row('it.tn', 'Terminal no.', it.tn) + '<div class="btnrow"><button class="btn small" data-act="terminalEditor">Edit strip...</button></div>';
    if (!d.res && (d.role === 'main' || d.role === 'aux')) s += row('it.role', 'Function', '', 'select', `<option value="main" ${it.role === 'main' ? 'selected' : ''}>Main function</option><option value="aux" ${it.role === 'aux' ? 'selected' : ''}>Auxiliary function</option>`);
    if (it.role === 'main' && dv && dv.items.length > 1) s += '<div class="note">Changing =, + or - on the main function renames the whole device.</div>';
    s += '</div>';
    s += `<div class="pgrp"><h4>Data</h4>${row('it.desc', L('desc'), it.desc || '', 'textarea')}`;
    if (d.role === 'plc') s += row('it.addr', 'Address', it.addr || '');
    s += `${row('it.part', 'Part number', it.part || '', 'text', 'list="dl-parts"')}${partDatalist()}${partInfoHTML(it.part)}<div class="btnrow"><button class="btn small" data-act="pickPartFor">Choose from parts...</button></div>${row('it.tech', L('tech'), it.tech || '')}`;
    if (hasLoad(d)) s += row('it.va', 'Load (VA)', it.va ?? '', 'text', `placeholder="${deviceLoad(Object.assign({}, it, { va: '' }))} (default)"`);
    s += '</div>';
    if (d.fp) {
      const pl = placeOf(it.id);
      s += `<div class="pgrp"><h4>Floor plan</h4><div class="note">${pl ? 'Placed on ' + esc(pl.lv.name) + '.' : 'Not on a floor plan yet.'}</div><div class="btnrow">${pl ? `<button class="btn small" data-showfloor="${it.id}">Show on floor plan</button>` : '<button class="btn small" data-act="placeOnFloor">Place on floor plan</button>'}</div></div>`;
    }
    if (d.role !== 'term' && d.role !== 'plc' && (S().connLabels || !d.res)) {
      s += '<div class="pgrp"><h4>Connection points</h4>';
      if (it.sym !== 'bbox') symConns(it).forEach((c, i) => { s += row('cl.' + i, d.card ? `Channel ${i}` : `Point ${i + 1}`, (it.cl || [])[i] || ''); });
      if (d.contact && !d.fixed && it.role === 'aux') s += '<div class="btnrow"><button class="btn small" data-act="renumContact">Assign next free numbers</button></div>';
      s += '</div>';
    }
    if (dv && dv.items.length) {
      s += `<div class="pgrp"><h4>${home() ? 'Where it appears' : 'Functions of ' + esc(fullIdent(it))}</h4><div class="fnlist">`;
      for (const o of dv.items) {
        const p = IX.pos.get(o.id);
        const nm = o.sym === 'term' ? 'Terminal ' + (o.tn || '') : SYM[o.sym].name;
        s += `<div data-goto="${o.id}" class="${o === it ? 'me' : ''}"><span>${esc(nm)}</span><span style="color:var(--muted)">${esc(o.sym === 'term' ? '' : clText(o))}</span><span class="r">${esc(ref(pg, o))}</span></div>`;
      }
      s += '</div></div>';
    }
  }
  if (d.sized) s += sizedPropsHTML(it);
  s += todoPanelHTML(it.id);
  if (d.sized && !d.rotates) s += `<div class="pgrp"><h4>Placement</h4>${userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(it.layer)) : ''}<div class="note">X ${it.x}  Y ${it.y}  Column ${colOf(it.x)}</div><div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div></div>`;
  else s += `<div class="pgrp"><h4>Placement</h4>${row('it.variant', 'Variant', '', 'select', ['A 0°', 'B 90°', 'C 180°', 'D 270°', 'E 0° mirrored', 'F 90° mirrored', 'G 180° mirrored', 'H 270° mirrored'].map(l => `<option value="${l[0]}" ${variantOf(it) === l[0] ? 'selected' : ''}>${l}</option>`).join(''))}${(userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(it.layer)) : '')}<div class="note">X ${it.x}  Y ${it.y}  Column ${colOf(it.x)}</div><div class="btnrow"><button class="btn" data-act="rotateSel">Rotate (R)</button><button class="btn" data-act="mirrorSel">Mirror (M)</button><button class="btn" data-act="delSel">Delete</button></div></div>`;
  el.innerHTML = s;
}

$('#props').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
  const pg = page();
  const dot = k.indexOf('.'); const scope = k.slice(0, dot), key = k.slice(dot + 1);
  if (fpPropChange(scope, key, v)) return;
  if (layPropChange(scope, key, v)) return;
  if (scope === 'pg') {
    if (key === 'num' && P.pages.some(p => p !== pg && p.fn === pg.fn && p.loc === pg.loc && p.num === v)) { alert('A page with that name already exists.'); renderProps(); return; }
    if (key === 'size') { commit(() => setPageSize(pg, v)); zoomFit(); return; }
    commit(() => {
      if (key === 'fn' || key === 'loc') for (const it of pg.items) if (it[key] === pg[key] && it.sym !== 'ip' && it.sym !== 'pe' && it.sym !== 'text') it[key] = v;
      pg[key] = v; sortPages();
    }, { props: false });
    return;
  }
  if (scope === 'pr') { commit(() => { P[key] = v; }, { props: false }); return; }
  if (scope === 'ly') { if (v === '__') return; commit(() => { for (const id of sel) { const o = objOf(findItem(id)); if (o) { if (v) o.layer = v; else delete o.layer; } } for (const id of [...sel]) { const o = objOf(findItem(id)); if (o && !selectable(o)) sel.delete(id); } }); return; }
  const f = findItem([...sel][0]); if (!f) return;
  if ((scope === 'bx' || scope === 'pin') && f.it && sizedPropChange(f.it, scope, key, v)) return;
  if (scope === 'gf') { if (f.g) gfxPropChange(f.g, key, v); return; }
  if (scope === 'w') { commit(() => { if (v) f.w[key] = v; else delete f.w[key]; }); return; }
  if (scope === 'cab') { commit(() => { f.cab[key] = v; }, { props: false }); return; }
  if (scope === 'cond') { commit(() => { f.cab.cond = f.cab.cond || {}; if (v) f.cab.cond[key] = v; else delete f.cab.cond[key]; }, { props: false }); return; }
  const it = f.it;
  if (scope === 'cl') { commit(() => { it.cl = it.cl || []; it.cl[+key] = v; }, { props: false }); return; }
  if (key === 'variant') { const n = 'ABCDEFGH'.indexOf(v); transformSel(x => { x.rot = (n % 4) * 90; x.mir = n >= 4 || undefined; }, [it]); return; }
  commit(() => applyItemChange(it, key, v));
});
function applyItemChange(it, key, v) {
    if (key === 'size') it.size = Math.max(1, parseFloat(v) || 3.5);
    else if ((key === 'fn' || key === 'loc' || key === 'tag') && it.role === 'main') {
      const k0 = devKey(it);
      for (const o of allItems()) if (o !== it && devKey(o) === k0) o[key] = v;
      it[key] = v; if (SYM[it.sym].prefix && key === 'tag') lastMain[SYM[it.sym].prefix] = v;
    } else if (key === 'tag' && it.sym === 'term') { it.tag = v; it.tn = nextTerminal(it.fn, it.loc, v); lastMain.X = v; }
    else if ((key === 'fn' || key === 'loc' || key === 'tag') && it.role === 'aux') { it[key] = v; assignContactNumbers(it); }
    else if (key === 'role') { it.role = v; if (v === 'aux') assignContactNumbers(it); }
    else if (key === 'ipName') { it.ipName = v; P._lastIp = v; }
    else if (key === 'part') applyPart(it, v);
    else it[key] = v;
}
