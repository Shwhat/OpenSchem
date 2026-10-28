// ---------- page navigator (tree or thumbnails) and the open page header ----------
// Branches are collapsed unless they hold the open page, so the tree shows one page open at a time.
// Expanding or collapsing a branch by hand is remembered until another page is opened inside it.
const NAV = { open: {}, filter: '', lastCur: null };
const REPORT_KINDS = { cover: 'Cover sheet', toc: 'Table of contents', panel: 'Panel schedules', bom: 'Bill of materials', term: 'Terminal diagrams', conn: 'Connection list', cables: 'Cable overview', cabdiag: 'Cable diagrams', rev: 'Revision overview' };

function navTree() {
  const sch = { key: 'sch', label: home() ? 'Circuits' : 'Schematic', kids: [] };
  const fnNode = new Map();
  for (const p of P.pages) {
    if (isFloor(p) || isLayout(p)) continue;
    const fk = 'sch/f:' + (p.fn || '');
    let f = fnNode.get(fk);
    if (!f) { f = { key: fk, label: p.fn ? dispCkt(p.fn) : L('nofl'), kids: [], locs: new Map() }; fnNode.set(fk, f); sch.kids.push(f); }
    if (p.loc) {
      const lk = fk + '/l:' + p.loc;
      let l = f.locs.get(lk);
      if (!l) { l = { key: lk, label: home() ? niceRoom(p.loc) : '+' + p.loc, kids: [] }; f.locs.set(lk, l); f.kids.push(l); }
      l.kids.push({ page: p });
    } else f.kids.push({ page: p });
  }
  const fp = { key: 'fp', label: 'Floor plans', kids: [], empty: true };
  const lvNode = new Map();
  for (const p of P.pages.filter(isFloor)) {
    fp.empty = false;
    const lv = levelOf(p); const k = 'fp/' + (lv ? lv.id : '?');
    let n = lvNode.get(k);
    if (!n) { n = { key: k, label: lv ? lv.name : '?', kids: [] }; lvNode.set(k, n); fp.kids.push(n); }
    n.kids.push({ page: p });
  }
  const lay = { key: 'lay', label: 'Panel layouts', kids: P.pages.filter(isLayout).map(p => ({ page: p })) };
  const rep = { key: 'rep', label: 'Reports', kids: [] };
  const kinds = new Map();
  for (const r of REPORTS.filter(r => !r.front)) { if (!kinds.has(r.report)) kinds.set(r.report, []); kinds.get(r.report).push(r); }
  for (const [k, list] of kinds) {
    if (list.length === 1) rep.kids.push({ page: list[0] });
    else rep.kids.push({ key: 'rep/' + k, label: REPORT_KINDS[k] || k, kids: list.map(r => ({ page: r })) });
  }
  const front = { key: 'front', label: 'Front pages', kids: REPORTS.filter(r => r.front).map(r => ({ page: r })) };
  return (front.kids.length ? [front] : []).concat([sch], lay.kids.length ? [lay] : [], [fp, rep]);
}
const navHas = (n, pg) => n.page ? n.page === pg : n.kids.some(k => navHas(k, pg));
const navLeafText = p => isLayout(p) ? (p.desc || '') + (p.loc ? '  ' + (home() ? niceRoom(p.loc) : '+' + p.loc) : '') : p.report ? p.desc + (p.sheets > 1 ? ` (${p.sheet}/${p.sheets})` : '') : (p.desc || '');
const navLeafNum = p => p.num;
const NAVICON = {
  sch: '<path d="M2 1.5h8l2 2v9H2z" fill="#fff" stroke="#556"/><path d="M4 6h3v4h3M7 6V4" fill="none" stroke="#0b2e8f" stroke-width=".9"/>',
  floor: '<path d="M1.5 2.5h11v9h-11z" fill="#fff" stroke="#556"/><path d="M1.5 7h5V2.5M9 7v4.5" fill="none" stroke="#556" stroke-width=".9"/>',
  report: '<path d="M2.5 1.5h9v11h-9z" fill="#fff" stroke="#556"/><path d="M4.5 4.5h5M4.5 6.5h5M4.5 8.5h5M4.5 10.5h3" stroke="#556" stroke-width=".8"/>',
  front: '<path d="M2.5 1.5h9v11h-9z" fill="#eef3fb" stroke="#2b4f91"/><path d="M4.5 5h5" stroke="#2b4f91" stroke-width="1.4"/><path d="M4.5 8h5M4.5 10h3" stroke="#2b4f91" stroke-width=".8"/>',
  layout: '<path d="M1.5 1.5h11v11h-11z" fill="#fff" stroke="#556"/><path d="M3 4h8M3 9h8" stroke="#888" stroke-width="1.2"/><rect x="3.5" y="5" width="2" height="3" fill="#7a8899"/><rect x="7" y="5" width="3" height="3" fill="#7a8899"/>',
};
const navIconKind = p => p.report ? (p.front ? 'front' : 'report') : isFloor(p) ? 'floor' : p.kind === 'layout' ? 'layout' : 'sch';
const navIcon = p => `<svg class="nicon" viewBox="0 0 14 14">${NAVICON[navIconKind(p)]}</svg>`;
function navMatch(p) {
  const q = NAV.filter.toLowerCase(); if (!q) return true;
  return (pageName(p) + ' ' + navLeafText(p)).toLowerCase().includes(q);
}
function navOpen(n, pg, depth) {
  if (NAV.filter) return true;
  if (n.key in NAV.open) return NAV.open[n.key];
  return depth === 0 || navHas(n, pg);
}
function navCount(n) { return n.page ? (navMatch(n.page) ? 1 : 0) : n.kids.reduce((a, k) => a + navCount(k), 0); }

function renderPages() {
  const el = $('#tab-pages'); const pg = page();
  const tree = navTree();
  // a newly opened page: drop manual collapse on the branches above it so it is visible
  if (NAV.lastCur !== curId) {
    NAV.lastCur = curId;
    const walk = (n, path) => { if (n.page) { if (n.page === pg) for (const k of path) if (NAV.open[k] === false) delete NAV.open[k]; return; } n.kids.forEach(k => walk(k, path.concat(n.key))); };
    tree.forEach(n => walk(n, []));
  }
  const thumbs = PREFS.navView === 'thumbs';
  let s = '<div class="navbtns"><button class="btn small" data-act="addPage">New page</button><button class="btn small" data-act="dupPage">Duplicate</button><button class="btn small" data-act="pageProps">Properties</button><button class="btn small" data-act="delPage">Delete</button></div>';
  s += `<div class="navbar"><input class="search" id="navsearch" placeholder="Filter pages" value="${esc(NAV.filter)}">
    <div class="seg"><button class="${thumbs ? '' : 'on'}" data-navview="tree" title="Page tree">Tree</button><button class="${thumbs ? 'on' : ''}" data-navview="thumbs" title="Page thumbnails">Thumbnails</button></div></div>`;
  if (thumbs) s += `<div class="navbar2"><label><input type="checkbox" id="navbig" ${PREFS.thumbSize === 'large' ? 'checked' : ''}> Large</label></div>`;
  else s += '<div class="navbar2"><button class="lnk" data-navall="1">Expand all</button><button class="lnk" data-navall="0">Collapse all</button></div>';
  s += `<div class="navroot">${esc(P.name)}</div>`;
  if (thumbs) s += thumbsHTML(tree, pg);
  else {
    const leaf = (p, depth) => navMatch(p) ? `<div class="navitem${p === pg ? ' active' : ''}" data-page="${p.id}" style="padding-left:${10 + depth * 14 + 12}px">${navIcon(p)}<span class="num">${esc(navLeafNum(p))}</span><span>${esc(navLeafText(p))}</span></div>` : '';
    const node = (n, depth) => {
      if (n.page) return leaf(n.page, depth);
      if (NAV.filter && !navCount(n)) return '';
      const open = navOpen(n, pg, depth);
      let h = `<div class="navnode${depth === 0 ? ' top' : ''}${navHas(n, pg) ? ' has' : ''}" data-navt="${esc(n.key)}" style="padding-left:${10 + depth * 14}px"><span class="caret">${open ? '▾' : '▸'}</span><span class="nl">${esc(n.label)}</span><span class="cnt">${navCount(n)}</span></div>`;
      if (open) h += n.kids.map(k => node(k, depth + 1)).join('');
      if (open && n.key === 'fp' && n.empty) h += '<div class="navbtns" style="padding-left:24px"><button class="btn small" data-act="addFloorPage">New floor plan page</button></div>';
      return h;
    };
    s += tree.map(n => node(n, 0)).join('');
  }
  el.innerHTML = s;
  const inp = $('#navsearch');
  inp.oninput = () => { NAV.filter = inp.value; renderPages(); const i2 = $('#navsearch'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); };
  const big = $('#navbig'); if (big) big.onchange = () => { PREFS.thumbSize = big.checked ? 'large' : 'small'; savePrefs(); renderPages(); };
  if (thumbs) scheduleThumbs();
  const act = el.querySelector('.navitem.active, .thumb.active');
  if (act && NAV.scrollTo !== curId) { NAV.scrollTo = curId; act.scrollIntoView({ block: 'nearest' }); }
}

// ---------- thumbnails ----------
const THUMB = { cache: new Map(), timer: null };
function thumbSVG(pg, tagId) {
  const sfx = '-' + tagId;
  const sh = sheetOf(pg);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sh.w} ${sh.h}">${pageSVG(pg, { print: true, thumb: true }).replace(/id="(gp|fpc-[^"]+|fgp-[^"]+)"/g, `id="$1${sfx}"`).replace(/url\(#(gp|fpc-[^)]+|fgp-[^)]+)\)/g, `url(#$1${sfx})`).replace(/ data-(id|link|goto)="[^"]*"/g, '')}</svg>`;
}
function thumbsHTML(tree, pg) {
  let h = '';
  const leaves = n => n.page ? [n.page] : n.kids.flatMap(leaves);
  const groups = [];
  for (const top of tree) groups.push([top.label, leaves(top)]);
  for (const [label, pages] of groups) {
    const ps = pages.filter(navMatch); if (!ps.length) continue;
    h += `<div class="navgroup">${esc(label)}</div><div class="thumbs${PREFS.thumbSize === 'large' ? ' large' : ''}">`;
    for (const p of ps) {
      const c = THUMB.cache.get(p.id);
      h += `<div class="thumb${p === pg ? ' active' : ''}" data-page="${p.id}" title="${esc(pageName(p) + (navLeafText(p) ? '  ' + navLeafText(p) : ''))}"><div class="tsheet" data-thumb="${p.id}" style="aspect-ratio:${sheetOf(p).w}/${sheetOf(p).h}">${c ? c.html : ''}</div><div class="tcap"><b>${esc(pageName(p))}</b> ${esc(navLeafText(p))}</div></div>`;
    }
    h += '</div>';
  }
  return h;
}
// thumbnails are drawn shortly after editing stops, a few pages at a time, and only redrawn when they changed
function scheduleThumbs() {
  clearTimeout(THUMB.timer);
  const fill = () => {
    for (const box of document.querySelectorAll('#tab-pages [data-thumb]')) { const c = THUMB.cache.get(box.dataset.thumb); if (c && !box.firstChild) box.innerHTML = c.html; }
  };
  fill();
  THUMB.timer = setTimeout(() => {
    const list = allPages(); let i = 0;
    const step = () => {
      if (PREFS.navView !== 'thumbs') return;
      const t0 = performance.now();
      while (i < list.length && performance.now() - t0 < 25) {
        const p = list[i++]; const html = thumbSVG(p, 'th' + String(p.id).replace(/[^\w-]/g, '_'));
        const old = THUMB.cache.get(p.id);
        if (!old || old.html !== html) {
          THUMB.cache.set(p.id, { html });
          const box = document.querySelector(`#tab-pages [data-thumb="${CSS.escape(p.id)}"]`); if (box) box.innerHTML = html;
        }
      }
      if (i < list.length) THUMB.timer = setTimeout(step, 0); else fill();
    };
    step();
  }, 250);
}

// ---------- hover preview on the tree ----------
let navPrevT = null;
$('#tab-pages').addEventListener('mouseover', e => {
  const it = e.target.closest('.navitem[data-page]'); clearTimeout(navPrevT);
  if (!it) { hideNavPreview(); return; }
  navPrevT = setTimeout(() => {
    const pg = allPages().find(p => p.id === it.dataset.page); if (!pg) return;
    let pv = $('#navprev'); if (!pv) { pv = document.createElement('div'); pv.id = 'navprev'; document.body.appendChild(pv); }
    pv.innerHTML = thumbSVG(pg, 'pv') + `<div class="tcap"><b>${esc(pageName(pg))}</b> ${esc(navLeafText(pg))}</div>`;
    const r = it.getBoundingClientRect(); const lr = $('#tab-pages').getBoundingClientRect();
    pv.style.left = (lr.right + 6) + 'px'; pv.style.top = Math.max(4, Math.min(r.top - 40, innerHeight - 290)) + 'px';
    pv.classList.add('show');
  }, 450);
});
$('#tab-pages').addEventListener('mouseleave', () => { clearTimeout(navPrevT); hideNavPreview(); });
function hideNavPreview() { const pv = $('#navprev'); if (pv) pv.classList.remove('show'); }

$('#tab-pages').addEventListener('click', e => {
  const t = e.target.closest('[data-navt]');
  if (t) { const k = t.dataset.navt; const tree = navTree(); const find = ns => { for (const n of ns) { if (n.page) continue; if (n.key === k) return n; const f = find(n.kids); if (f) return f; } }; const n = find(tree); const depth = k.split('/').length - 1; NAV.open[k] = !(n ? navOpen(n, page(), depth) : true); renderPages(); return; }
  const v = e.target.closest('[data-navview]'); if (v) { PREFS.navView = v.dataset.navview; savePrefs(); hideNavPreview(); renderPages(); return; }
  const a = e.target.closest('[data-navall]');
  if (a) {
    const on = a.dataset.navall === '1';
    const walk = (ns, depth) => ns.forEach(n => { if (n.page) return; NAV.open[n.key] = on || depth === 0; walk(n.kids, depth + 1); });
    walk(navTree(), 0);
    renderPages();
  }
});

// ---------- open page header (replaces one tab per page) ----------
function renderPageTabs() {
  const pg = page(); const all = allPages(); const i = all.indexOf(pg);
  const where = pg.report ? 'Report' : isFloor(pg) ? 'Floor plan' + (levelOf(pg) ? ' · ' + levelOf(pg).name : '') : [pg.fn && dispCkt(pg.fn), pg.loc && (home() ? niceRoom(pg.loc) : '+' + pg.loc)].filter(Boolean).join(' · ');
  $('#pagetabs').innerHTML = `<button class="phbtn" data-act="prevPage" title="Previous page (PgUp)" ${i <= 0 ? 'disabled' : ''}>‹</button><button class="phbtn" data-act="nextPage" title="Next page (PgDn)" ${i >= all.length - 1 ? 'disabled' : ''}>›</button>
    <div class="phname" data-pgname="1" title="Double click for page properties">${esc(pageName(pg))}</div><div class="phdesc">${esc(pg.report ? navLeafText(pg) : pg.desc || '')}</div><div class="phwhere">${esc(where)}</div><div class="phpos">Sheet ${i + 1} of ${all.length}</div>`;
}

// ---------- right-click menu on the navigator ----------
let navCtxPage = null;
$('#tab-pages').addEventListener('contextmenu', e => {
  const it = e.target.closest('[data-page]'); const br = e.target.closest('[data-navt]');
  if (!it && !br) return;
  e.preventDefault(); hideNavPreview();
  let items;
  if (it) {
    const pg = allPages().find(p => p.id === it.dataset.page); if (!pg) return;
    if (pg.id !== curId) goPage(pg.id);
    items = pg.report ? [['Open', 'navCtxOpen'], '-', ['Export PDF...', 'exportPDF'], ['Print...', 'printAll']]
      : [['Open', 'navCtxOpen'], ['Properties...', 'pageProps'], '-', ['New page...', isFloor(pg) ? 'addFloorPage' : 'addPage'], ['Duplicate', 'dupPage'], ['Delete', 'delPage']];
  } else {
    items = [['New page...', br.dataset.navt.startsWith('fp') ? 'addFloorPage' : 'addPage'], '-', ['Expand all', 'navExpandAll'], ['Collapse all', 'navCollapseAll']];
  }
  const dd = $('#dropdown');
  dd.innerHTML = items.map(i => i === '-' ? '<div class="ddsep"></div>' : `<div class="dd" data-act="${i[1]}"><span>${i[0]}</span></div>`).join('');
  dd.style.left = e.clientX + 'px'; dd.style.top = e.clientY + 'px'; dd.classList.remove('hidden');
});
function navSetAll(on) { const walk = (ns, depth) => ns.forEach(n => { if (n.page) return; NAV.open[n.key] = on || depth === 0; walk(n.kids, depth + 1); }); walk(navTree(), 0); renderPages(); }
