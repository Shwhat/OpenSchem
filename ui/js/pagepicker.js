// ---------- choose pages for PDF export and printing ----------
// Same grouping as the page navigator, with a checkbox per page and per branch. The last choice is kept in the project.
function parseRange(s, max) {
  const out = new Set();
  for (const part of String(s || '').split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part); if (!m) continue;
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let i = Math.max(1, Math.min(a, b)); i <= Math.min(max, Math.max(a, b)); i++) out.add(i);
  }
  return out;
}
function pagePicker(title, okLabel, onOk) {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers(); REPORTS = buildReports();
  const all = allPages(); const idx = new Map(all.map((p, i) => [p.id, i + 1]));
  const valid = new Set(all.map(p => p.id));
  let chosen = new Set(((P.lastExport || []).filter(id => valid.has(id))));
  if (!chosen.size) chosen = new Set(valid);
  const tree = navTree();
  const leaves = n => n.page ? [n.page] : n.kids.flatMap(leaves);
  const draw = () => {
    const node = (n, depth) => {
      if (n.page) return `<label class="pkp" style="padding-left:${depth * 16}px"><input type="checkbox" data-pk="${esc(n.page.id)}" ${chosen.has(n.page.id) ? 'checked' : ''}><span class="pkn">${idx.get(n.page.id)}</span><span>${esc(pageName(n.page))}</span><span class="pkd">${esc(navLeafText(n.page))}</span></label>`;
      const ls = leaves(n); const on = ls.filter(p => chosen.has(p.id)).length;
      return `<label class="pkb" style="padding-left:${depth * 16}px"><input type="checkbox" data-pkb="${esc(n.key)}" ${on === ls.length ? 'checked' : ''} ${on && on < ls.length ? 'data-mixed="1"' : ''}><b>${esc(n.label)}</b><span class="pkd">${on} of ${ls.length}</span></label>` + n.kids.map(k => node(k, depth + 1)).join('');
    };
    $('#pklist').innerHTML = tree.map(n => node(n, 0)).join('');
    $('#pklist').querySelectorAll('[data-mixed]').forEach(i => { i.indeterminate = true; });
    $('#pkcount').textContent = `${chosen.size} of ${all.length} page(s)`;
  };
  dialog(title, [], () => {
    if (!chosen.size) { alert('Choose at least one page.'); return false; }
    P.lastExport = [...chosen];
    onOk(all.filter(p => chosen.has(p.id)).map(p => p.id));
  }, okLabel, `<div class="pkbar"><button type="button" class="btn small" data-pq="all">All</button><button type="button" class="btn small" data-pq="none">None</button><button type="button" class="btn small" data-pq="cur">Current page</button><button type="button" class="btn small" data-pq="sch">Schematics</button><button type="button" class="btn small" data-pq="floor">Floor plans</button><button type="button" class="btn small" data-pq="layout">Panel layouts</button><button type="button" class="btn small" data-pq="rep">Reports</button></div>
    <div class="pkbar"><label for="pkrange">Sheets</label><input id="pkrange" class="search" placeholder="e.g. 1-5, 8" autocomplete="off"><button type="button" class="btn small" data-pq="range">Select</button><span id="pkcount" class="note" style="margin-left:auto"></span></div>
    <div id="pklist" class="pklist"></div>`);
  $('#dlg').style.width = '680px'; $('#dlg').style.maxWidth = '96vw';
  draw();
  const body = $('#dlgbody');
  body.onchange = e => {
    const t = e.target;
    if (t.dataset.pk) { t.checked ? chosen.add(t.dataset.pk) : chosen.delete(t.dataset.pk); draw(); return; }
    if (t.dataset.pkb) {
      const find = ns => { for (const n of ns) { if (n.page) continue; if (n.key === t.dataset.pkb) return n; const f = find(n.kids); if (f) return f; } };
      const n = find(tree); if (n) for (const p of leaves(n)) t.checked ? chosen.add(p.id) : chosen.delete(p.id);
      draw();
    }
  };
  body.onclick = e => {
    const b = e.target.closest('[data-pq]'); if (!b) return;
    const q = b.dataset.pq;
    const pick = f => { chosen = new Set(all.filter(f).map(p => p.id)); };
    if (q === 'all') pick(() => true); else if (q === 'none') chosen.clear();
    else if (q === 'cur') pick(p => p === page());
    else if (q === 'sch') pick(p => !p.report && !p.kind);
    else if (q === 'floor') pick(isFloor); else if (q === 'layout') pick(isLayout); else if (q === 'rep') pick(p => !!p.report);
    else if (q === 'range') { const r = parseRange($('#pkrange').value, all.length); if (!r.size) { flash('Enter sheet numbers such as 1-5, 8'); return; } pick(p => r.has(idx.get(p.id))); }
    draw();
  };
  body.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'pkrange') { e.preventDefault(); body.querySelector('[data-pq="range"]').click(); } };
}
