// ---------- host bridge: OpenSchem server, with a plain browser fallback ----------
// On the server, window.OS_SERVER holds the signed-in user. Projects are kept on the server and addressed as
// "srv:<id>" in filePath. Without a server (the tests, or the page opened from disk) files go through downloads.
const SERVER = window.OS_SERVER || null;

async function api(method, url, body) {
  const o = { method, headers: { 'X-OpenSchem': '1' } };
  if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = typeof body === 'string' ? body : JSON.stringify(body); }
  const r = await fetch(url, o);
  if (r.status === 401) { location.href = '/login'; throw new Error('You are signed out.'); }
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) { const e = new Error((j && j.error) || 'Server error ' + r.status); e.status = r.status; e.data = j; throw e; }
  return j;
}
const srvId = path => (path || '').startsWith('srv:') ? path.slice(4) : '';

const host = {
  has: !!SERVER,
  user: SERVER ? SERVER.user : null,
  srv: null,      // the open server project: { id, name, access, owner, rev, readOnly, lockedBy }
  pending: null,  // project info for the next loadProject call
  beat: 0,
  async open() { return projectBrowser(); },
  // attach is called by loadProject: it keeps track of the open server project and its edit lock
  async attach(path) {
    const id = srvId(path), info = this.pending && this.pending.id === id ? this.pending : null; this.pending = null;
    if (this.srv && this.srv.id !== id) this.unlock();
    if (!this.has || !id) { this.srv = null; this.url(''); return; }
    this.srv = info ? { ...info, readOnly: info.access === 'view' } : { id, access: 'view', readOnly: true, rev: 0 };
    this.url(id);
    if (!this.srv.readOnly) await this.lock(true);
    if (typeof updateTitle === 'function') updateTitle();
  },
  url(id) { if (this.has) try { history.replaceState(null, '', id ? '?p=' + id : location.pathname); } catch (e) {} },
  async lock(first) {
    const s = this.srv; if (!s || s.access === 'view') return;
    try { await api('POST', `/api/projects/${s.id}/lock`); s.lockedBy = ''; if (s.readOnly && s.access !== 'view') { s.readOnly = false; flash('You can edit this project again'); } }
    catch (e) {
      if (e.status === 409 && e.data && e.data.project) { s.readOnly = true; s.lockedBy = e.data.project.lockedBy; if (first) flash(`Opened read-only: ${s.lockedBy} is editing this project. Use Save as to keep a copy.`); }
    }
    if (typeof updateTitle === 'function') updateTitle();
    clearInterval(this.beat); this.beat = setInterval(() => this.lock(false), 45000);
  },
  unlock() {
    clearInterval(this.beat);
    const s = this.srv; if (!s || s.readOnly) return;
    try { fetch(`/api/projects/${s.id}/unlock`, { method: 'POST', headers: { 'X-OpenSchem': '1' }, keepalive: true }); } catch (e) {}
  },
  fileLabel(path) {
    if (!this.has) return path ? path.split(/[\\/]/).pop() : 'Untitled.osp';
    if (!srvId(path) || !this.srv) return 'Not saved yet';
    const s = this.srv;
    const who = s.access === 'owner' ? '' : `${s.ownerName || 'shared'}'s project, `;
    return who + (s.lockedBy ? `read-only while ${s.lockedBy} edits` : s.readOnly ? 'view only' : 'saved on the server');
  },
  async save(path, content) {
    if (!this.has) { download(fileBaseName() + '.osp', content); return fileBaseName() + '.osp'; }
    const s = this.srv;
    if (!srvId(path) || !s) return this.saveAs(content);
    if (s.readOnly) {
      const msg = s.lockedBy ? `${s.lockedBy} is editing this project right now, so you cannot save over it.` : 'You can view this project but not change it.';
      return (await choose('Save', msg + ' Save your version as a new project?', [['copy', 'Save as a copy']])) === 'copy' ? this.saveAs() : '';
    }
    try { const r = await api('PUT', '/api/projects/' + s.id, { name: P.name, rev: s.rev, content }); Object.assign(s, r); return path; }
    catch (e) {
      if (e.status !== 409) throw e;
      const p = (e.data && e.data.project) || {};
      if (e.data.error === 'locked') { s.readOnly = true; s.lockedBy = p.lockedBy; updateTitle(); return this.save(path, content); }
      const c = await choose('Save', `${p.updatedByName || 'Someone'} saved this project after you opened it. Saving now replaces their changes.`, [['copy', 'Save as a copy'], ['over', 'Replace their changes']]);
      if (c === 'copy') return this.saveAs();
      if (c !== 'over') return '';
      const r = await api('PUT', '/api/projects/' + s.id, { name: P.name, rev: s.rev, force: true, content }); Object.assign(s, r); return path;
    }
  },
  async saveAs() {
    if (!this.has) { const n = fileBaseName() + '.osp'; download(n, projectJSON()); return n; }
    const name = await askText('Save as', 'Project name', P.name || 'Untitled', 'Save'); if (name == null) return '';
    if (name && name !== P.name) { P.name = name; }
    const r = await api('POST', '/api/projects', { name: P.name, content: projectJSON() });
    this.pending = r; await this.attach('srv:' + r.id); return 'srv:' + r.id;
  },
  async title(t) { document.title = this.srv && this.srv.readOnly ? t + ' (read-only)' : t; },
  async autosave(c) { if (this.has) try { await api('PUT', '/api/autosave', c); } catch (e) {} },
  async getAutosave() { if (this.has) try { const r = await fetch('/api/autosave'); if (r.ok) return await r.text(); } catch (e) {} return ''; },
  async saveText(content, name) { download(name, content, 'text/csv'); return name; },
  async saveBinary(b64, name) {
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    download(name, u, 'application/octet-stream'); return name;
  },
  async readData(n) {
    if (this.has) { try { const r = await fetch('/api/data/' + n); return r.ok ? await r.text() : ''; } catch (e) { return ''; } }
    try { return localStorage.getItem('os:' + n) || ''; } catch (e) { return ''; }
  },
  async writeData(n, c) {
    if (this.has) { try { await api('PUT', '/api/data/' + n, c); } catch (e) { flash('Could not save ' + n + ': ' + e.message); } return; }
    try { localStorage.setItem('os:' + n, c); } catch (e) {}
  },
  async saveFile(content, name) { download(name, content, 'application/octet-stream'); return name; },
  async openText(desc, ext) { return pickLocalFile('.' + ext, false); },
  async openBinary(desc, ext) { return pickLocalFile('.' + ext, true); },
  setDirty() {},
  async initialFile() {
    if (!this.has) return null;
    const id = new URLSearchParams(location.search).get('p'); if (!id) return null;
    try { const r = await api('GET', '/api/projects/' + encodeURIComponent(id)); this.pending = r.project; return { path: 'srv:' + id, content: r.content }; }
    catch (e) { this.url(''); flash('That project could not be opened: ' + e.message); return null; }
  },
};
function download(name, content, type = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function fileBaseName() { return (P && P.name || 'project').replace(/[\\/:*?"<>|]/g, '_'); }
function pickLocalFile(accept, binary) {
  return new Promise(res => {
    // the input stays in the page until it is used; a detached input can be discarded before it reports the file
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.style.display = 'none'; document.body.appendChild(i);
    i.addEventListener('cancel', () => { i.remove(); res(null); });
    i.onchange = () => {
      const f = i.files[0]; i.remove(); if (!f) return res(null);
      if (!binary) { f.text().then(t => res({ path: f.name, content: t })); return; }
      const r = new FileReader(); r.onload = () => res({ path: f.name, content: String(r.result).split(',')[1] }); r.readAsDataURL(f);
    };
    i.click();
  });
}
window.addEventListener('pagehide', () => host.unlock());

// ---------- small promise dialogs ----------
// choose: a message with extra buttons besides Cancel; resolves with the button's value, or '' for Cancel
function choose(title, text, buttons) {
  return new Promise(res => {
    dialog(title, [], () => {}, 'OK', `<div class="note" style="max-width:420px">${esc(text)}</div>`);
    const dlg = $('#dlg'); let v = '';
    $('#dlgbtns').innerHTML = '<button type="button" class="btn" data-v="">Cancel</button>' + buttons.map(([k, l], i) => `<button type="button" class="btn${i === buttons.length - 1 ? ' primary' : ''}" data-v="${esc(k)}">${esc(l)}</button>`).join('');
    $('#dlgbtns').onclick = e => { const b = e.target.closest('button'); if (!b) return; v = b.dataset.v; dlg.close('cancel'); };
    dlg.onclose = () => { $('#dlgbtns').onclick = null; res(v); };
    const p = $('#dlgbtns .primary'); if (p) p.focus();
  });
}
// askText: one text field; resolves with the trimmed text, or null for Cancel
function askText(title, label, value, okLabel = 'OK') {
  return new Promise(res => {
    let out = null;
    dialog(title, [['v', label, value]], v => { out = v.v; }, okLabel);
    const dlg = $('#dlg'), inner = dlg.onclose;
    dlg.onclose = () => { inner(); res(out); };
  });
}

// ---------- server features: project list, sharing, account ----------
function fmtWhen(s) { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
const ACCESS_LABEL = { owner: 'Owner', edit: 'Can edit', view: 'Can view' };

// projectBrowser: the Open dialog on the server. Resolves with { path, content } for the chosen project, or null.
function projectBrowser() {
  return new Promise(async res => {
    let list, users;
    try { [list, users] = await Promise.all([api('GET', '/api/projects'), api('GET', '/api/users')]); } catch (e) { alert('Could not load the project list: ' + e.message); return res(null); }
    let done = false, filter = '', sharing = '';
    const finish = v => { if (done) return; done = true; res(v); };
    const others = users.filter(u => u.id !== host.user.id);
    const rows = () => {
      const f = filter.toLowerCase();
      const shown = list.filter(p => !f || p.name.toLowerCase().includes(f) || p.ownerName.toLowerCase().includes(f));
      if (!shown.length) return `<tr><td colspan="5" class="pb-empty">${list.length ? 'No project matches the filter.' : 'No projects yet. Save a project or import one from this computer.'}</td></tr>`;
      return shown.map(p => {
        const n = p.shares ? Object.keys(p.shares).length : 0;
        let s = `<tr data-id="${p.id}"><td><a href="#" class="pb-open" data-id="${p.id}">${esc(p.name)}</a>${p.lockedBy ? `<div class="pb-sub">${esc(p.lockedBy)} is editing</div>` : ''}</td>
          <td>${esc(p.ownerName)}</td><td>${ACCESS_LABEL[p.access] || ''}${p.access === 'owner' && n ? `<div class="pb-sub">Shared with ${n}</div>` : ''}</td>
          <td>${esc(fmtWhen(p.updated))}<div class="pb-sub">${esc(p.updatedByName || '')}</div></td>
          <td class="pb-act">${p.access === 'owner' ? `<button type="button" class="btn" data-share="${p.id}">Share</button><button type="button" class="btn" data-del="${p.id}">Delete</button>` : ''}</td></tr>`;
        if (sharing === p.id) s += `<tr class="pb-share"><td colspan="5">${shareEditorHTML(others, p.shares || {})}<div class="pb-sharebtns"><button type="button" class="btn primary" data-saveshare="${p.id}">Save sharing</button></div></td></tr>`;
        return s;
      }).join('');
    };
    const draw = () => { $('#pbrows').innerHTML = rows(); };
    dialog('Projects', [], null, 'OK', `<div class="pb-top"><input id="pbfilter" placeholder="Filter by name or owner" autocomplete="off"><button type="button" class="btn" id="pbimport">Import from this computer...</button></div>
      <div class="pb-wrap"><table class="pb"><thead><tr><th>Project</th><th>Owner</th><th>Access</th><th>Last saved</th><th></th></tr></thead><tbody id="pbrows"></tbody></table></div>`);
    const dlg = $('#dlg'); dlg.style.width = '780px'; dlg.style.maxWidth = '96vw';
    dlg.onclose = () => finish(null);
    draw();
    $('#pbfilter').oninput = e => { filter = e.target.value; draw(); };
    $('#pbfilter').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const a = $('#pbrows .pb-open'); if (a) a.click(); } };
    const openId = async id => {
      try { const r = await api('GET', '/api/projects/' + id); host.pending = r.project; finish({ path: 'srv:' + id, content: r.content }); dlg.close(); }
      catch (e) { alert('Could not open the project: ' + e.message); }
    };
    $('#pbimport').onclick = async () => {
      const f = await pickLocalFile('.osp,.json', false); if (!f) return;
      let name = f.path.replace(/\.(osp|json)$/i, '');
      try { const o = JSON.parse(f.content); if (!o || !Array.isArray(o.pages)) throw new Error('not a project'); if (o.name) name = o.name; }
      catch (e) { alert('That file is not an OpenSchem project.'); return; }
      try { const r = await api('POST', '/api/projects', { name, content: f.content }); await openId(r.id); }
      catch (e) { alert('Import failed: ' + e.message); }
    };
    $('#pbrows').onclick = async e => {
      const t = e.target.closest('a,button'); if (!t) return; e.preventDefault();
      if (t.dataset.id) return openId(t.dataset.id);
      if (t.dataset.share) { sharing = sharing === t.dataset.share ? '' : t.dataset.share; draw(); return; }
      if (t.dataset.saveshare) {
        try { const r = await api('PUT', `/api/projects/${t.dataset.saveshare}/shares`, { shares: readShareEditor() }); Object.assign(list.find(p => p.id === r.id), r); sharing = ''; draw(); flash('Sharing saved'); }
        catch (err) { alert('Could not save sharing: ' + err.message); }
        return;
      }
      if (t.dataset.del) {
        const p = list.find(x => x.id === t.dataset.del);
        if (!confirm(`Delete "${p.name}" from the server? This cannot be undone.`)) return;
        try { await api('DELETE', '/api/projects/' + p.id); list = list.filter(x => x !== p); draw(); if (host.srv && host.srv.id === p.id) { host.srv = null; filePath = ''; host.url(''); updateTitle(); } }
        catch (err) { alert('Could not delete: ' + err.message); }
      }
    };
    setTimeout(() => $('#pbfilter').focus(), 0);
  });
}
function shareEditorHTML(users, shares) {
  if (!users.length) return '<div class="note">There are no other users on this server yet.</div>';
  return `<div class="pb-users">${users.map(u => `<div class="prow"><label>${esc(u.name)}</label><select data-user="${u.id}">${[['', 'No access'], ['view', 'Can view'], ['edit', 'Can edit']].map(([v, l]) => `<option value="${v}" ${(shares[u.id] || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}</div>`;
}
function readShareEditor() { const o = {}; document.querySelectorAll('#dlg select[data-user]').forEach(s => { if (s.value) o[s.dataset.user] = s.value; }); return o; }

async function shareProject() {
  if (!host.has) return;
  if (!host.srv) { flash('Save the project first, then share it'); return; }
  if (host.srv.access !== 'owner') { flash('Only the owner can share this project'); return; }
  let users, info;
  try { [users, info] = await Promise.all([api('GET', '/api/users'), api('GET', '/api/projects')]); } catch (e) { alert(e.message); return; }
  const me = info.find(p => p.id === host.srv.id) || {};
  const others = users.filter(u => u.id !== host.user.id);
  dialog('Share project', [], () => {
    const shares = readShareEditor();
    api('PUT', `/api/projects/${host.srv.id}/shares`, { shares }).then(() => flash('Sharing saved')).catch(e => alert('Could not save sharing: ' + e.message));
  }, 'Save', `<div class="note">People you share with see the project in their Open list. Only one person can edit it at a time; the others see it read-only until they are done.</div>${shareEditorHTML(others, me.shares || {})}`);
  if (!others.length) $('#dlgbtns').innerHTML = '<button class="btn primary" value="cancel">Close</button>';
}
function downloadProject() { download(fileBaseName() + '.osp', projectJSON()); flash('Downloaded ' + fileBaseName() + '.osp'); }
function changePassword() {
  if (!host.has) return;
  dialog('Change password', [['old', 'Current password', '', 'password'], ['nw', 'New password', '', 'password'], ['nw2', 'Repeat new password', '', 'password']], v => {
    if (v.nw.length < 8) { alert('Passwords need at least 8 characters.'); return false; }
    if (v.nw !== v.nw2) { alert('The new passwords do not match.'); return false; }
    api('POST', '/api/password', { old: v.old, new: v.nw }).then(() => flash('Password changed. Other devices are signed out.')).catch(e => alert(e.message));
  }, 'Change');
}
async function signOut() {
  if (!confirmDiscard()) return;
  host.unlock(); dirty = false; await host.autosave('');
  try { await api('POST', '/api/logout'); } catch (e) {}
  location.replace('/login');
}
if (SERVER) {
  const m = document.createElement('div'); m.className = 'menu'; m.dataset.menu = 'account'; m.id = 'acct'; m.textContent = SERVER.user.name; m.title = 'Signed in as ' + SERVER.user.name;
  const d = document.getElementById('docname'); if (d) d.after(m);
}
