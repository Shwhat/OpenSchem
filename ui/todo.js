// ---------- in-app to-do list (saved in the project) ----------
let todoFilter = 'open';
const todos = () => (P.todos = P.todos || []);
const openTodosFor = id => todos().filter(t => !t.done && t.link === id);
function todoLinkLabel(t) {
  if (!t.link) return '';
  if (t.link.startsWith('page:')) { const pg = P.pages.find(p => p.id === t.link.slice(5)); return pg ? 'Page ' + pageName(pg) : '(page deleted)'; }
  const f = findItem(t.link);
  if (!f) return '(device deleted)';
  if (f.it) return dispFull(f.it.fn, f.it.loc, f.it.tag) || SYM[f.it.sym].name;
  if (f.cab) return home() ? 'Cable ' + f.cab.tag.replace(/^W/, '') : '-' + f.cab.tag;
  return 'Connection';
}
function addTodo(text, link) {
  text = String(text || '').trim(); if (!text) return;
  commit(() => { todos().push({ id: uid(), text, done: false, created: today(), link: link || '' }); }, { props: false });
  renderTodo(); flash('To-do added');
}
function addTodoForSelection() {
  const id = [...sel][0]; const pg = page();
  const link = id ? (findItem(id) ? id : '') : (pg.report ? '' : 'page:' + pg.id);
  const fp = id && findFp(id); const lk = fp && fp.kind === 'place' ? fp.pl.item : link;
  dialog('Add to-do', [['text', 'To-do', ''], ['link', 'Linked to', lk ? 'yes' : 'no', 'select', lk ? [['yes', todoLinkLabel({ link: lk })], ['no', '(nothing)']] : [['no', '(nothing)']]]], v => {
    if (!v.text) return false;
    addTodo(v.text, v.link === 'yes' ? lk : '');
  }, 'Add');
}
function renderTodo() {
  const el = $('#tab-todo'); if (!el || !P) return;
  const all = todos(); const open = all.filter(t => !t.done).length;
  const tab = $('[data-tab="todo"]'); if (tab) tab.innerHTML = 'To-do' + (open ? ` <span class="tcount">${open}</span>` : '');
  if (el.classList.contains('hidden')) return;
  const list = all.filter(t => todoFilter === 'all' || (todoFilter === 'open' ? !t.done : t.done));
  const f = (k, l) => `<button class="btn small${todoFilter === k ? ' primary' : ''}" data-tdf="${k}">${l}</button>`;
  el.innerHTML = `<div class="td-add"><input class="search" id="tdnew" placeholder="Add a to-do and press Enter" style="margin:0;flex:1"><button class="btn small" data-tdact="link" title="Add a to-do linked to the selected device or this page">+ Linked</button></div>
    <div class="navbtns">${f('open', `Open (${open})`)}${f('done', `Done (${all.length - open})`)}${f('all', 'All')}</div>
    ${list.length ? list.map(t => `<div class="td${t.done ? ' done' : ''}">
      <input type="checkbox" data-tdchk="${t.id}" ${t.done ? 'checked' : ''}>
      <div class="td-body"><div class="td-text" data-tdedit="${t.id}" title="Double-click to edit">${esc(t.text)}</div>
        <div class="td-meta">${t.link ? `<a data-tdgo="${t.id}">${esc(todoLinkLabel(t))}</a> · ` : ''}${esc(t.done ? 'done ' + (t.doneDate || '') : 'added ' + t.created)}</div></div>
      <button class="td-del" data-tddel="${t.id}" title="Delete">×</button></div>`).join('')
      : `<div class="note" style="padding:8px 10px">${todoFilter === 'open' ? 'Nothing open.' : 'Nothing here.'}</div>`}
    ${all.some(t => t.done) && todoFilter !== 'open' ? '<div class="navbtns"><button class="btn small" data-tdact="clear">Delete done items</button></div>' : ''}`;
  const inp = $('#tdnew');
  inp.onkeydown = e => { if (e.key === 'Enter') { const v = inp.value; addTodo(v, ''); const n = $('#tdnew'); if (n) n.focus(); } };
}
document.addEventListener('click', e => {
  const flt = e.target.closest('[data-tdf]'); if (flt) { todoFilter = flt.dataset.tdf; renderTodo(); return; }
  const chk = e.target.closest('[data-tdchk]');
  if (chk) { const t = todos().find(x => x.id === chk.dataset.tdchk); if (t) commit(() => { t.done = chk.checked; t.doneDate = t.done ? today() : ''; }, { props: false }); renderTodo(); return; }
  const del = e.target.closest('[data-tddel]'); if (del) { commit(() => { P.todos = todos().filter(x => x.id !== del.dataset.tddel); }, { props: false }); renderTodo(); return; }
  const go = e.target.closest('[data-tdgo]');
  if (go) { const t = todos().find(x => x.id === go.dataset.tdgo); if (!t) return; if (t.link.startsWith('page:')) goPage(t.link.slice(5)); else gotoItem(t.link); return; }
  const act = e.target.closest('[data-tdact]');
  if (act) {
    if (act.dataset.tdact === 'link') addTodoForSelection();
    else if (act.dataset.tdact === 'clear' && confirm('Delete all done to-dos?')) { commit(() => { P.todos = todos().filter(t => !t.done); }, { props: false }); renderTodo(); }
  }
});
document.addEventListener('dblclick', e => {
  const ed = e.target.closest('[data-tdedit]'); if (!ed) return;
  const t = todos().find(x => x.id === ed.dataset.tdedit); if (!t) return;
  const v = prompt('Edit to-do:', t.text); if (v != null && v.trim()) { commit(() => { t.text = v.trim(); }, { props: false }); renderTodo(); }
});
function todoFlag(x, y) { return PRINTING ? '' : `<g class="tdflag" pointer-events="none"><path d="M${x},${y}v-4.2" stroke="#d97706" stroke-width="0.35"/><path d="M${x},${y - 4.2}l2.6,0.9l-2.6,0.9z" fill="#f59e0b"/></g>`; }
function todoPanelHTML(id) {
  const open = openTodosFor(id);
  return `<div class="pgrp"><h4>To-do</h4>${open.map(t => `<div class="td-mini"><input type="checkbox" data-tdchk="${t.id}"> ${esc(t.text)}</div>`).join('') || '<div class="note">No open to-dos.</div>'}
    <div class="btnrow"><button class="btn small" data-tdact="link">Add to-do</button></div></div>`;
}
