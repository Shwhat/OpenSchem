// The server: accounts, projects on the server, sharing, the edit lock, revision conflicts, per-user and shared data.
// Builds the server binary, starts it on a free port with an empty data folder, and drives the interface through it.
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const bin = path.join(ROOT, 'build', process.platform === 'win32' ? 'openschem-test.exe' : 'openschem-test');
execFileSync('go', ['build', '-o', bin, '.'], { cwd: ROOT, env: { ...process.env, CGO_ENABLED: '0' }, stdio: 'inherit' });
const port = await new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'openschem-test-'));
const proc = spawn(bin, [], { env: { ...process.env, OPENSCHEM_ADDR: '127.0.0.1:' + port, OPENSCHEM_DATA: data }, stdio: 'ignore' });
process.on('exit', () => { proc.kill(); fs.rmSync(data, { recursive: true, force: true }); });
const URL = 'http://127.0.0.1:' + port;
for (let i = 0; i < 100; i++) { try { if ((await fetch(URL + '/healthz')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 50)); }

let n = 0;
const uname = base => `${base}${Date.now() % 100000}${n++}`;
const H = { 'X-OpenSchem': '1' };

// sign up through the API with the page's own cookies, then open the app
async function signup(page, base) {
  const name = uname(base);
  const r = await page.request.post(URL + '/api/signup', { headers: H, data: { name, password: 'password123' } });
  if (!r.ok()) throw new Error('signup failed: ' + (await r.text()));
  return { name, id: (await r.json()).id };
}
async function openApp(page, q = '') {
  await page.goto(URL + '/' + q);
  await page.waitForFunction(() => typeof P !== 'undefined' && P && P.pages && typeof host !== 'undefined');
  await page.waitForTimeout(150);
}
// a second signed-in person in their own browser
async function second(t, base) {
  const ctx = await t.page.context().browser().newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const u = await signup(page, base);
  return { ctx, page, u, errors, done: async () => { await ctx.close(); if (errors.length) throw new Error('page error (second user): ' + errors.join(' | ')); } };
}
async function api(page, method, url, data) {
  const r = await page.request.fetch(URL + url, { method, headers: H, data });
  return r.status() === 200 ? r.json() : { status: r.status(), body: await r.text() };
}
// save the open project to the server under a name, through the Save as dialog
async function saveAs(page, name) {
  await page.evaluate(() => { saveAs(); });
  await page.waitForSelector('#dlg[open] input[name=v]');
  await page.fill('#dlg input[name=v]', name);
  await page.click('#dlgbtns .primary');
  await page.waitForFunction(() => host.srv && filePath.startsWith('srv:') && !dirty);
}
async function pick(page, label) {
  await page.waitForSelector('#dlg[open] #dlgbtns button');
  await page.click(`#dlgbtns button:has-text("${label}")`);
}

export const tests = {
  'sign-in page, account creation and the account menu': async t => {
    const p = t.page;
    await p.goto(URL + '/');
    t.ok(p.url().endsWith('/login'), 'signed-out visitors go to the sign-in page');
    const name = uname('devon');
    await p.click('#tabs button[data-t=up]');
    await p.fill('#name', name); await p.fill('#pw', 'password123'); await p.fill('#pw2', 'password124');
    await p.click('#go');
    t.eq(await p.textContent('#msg'), 'The passwords do not match.');
    await p.fill('#pw2', 'password123'); await p.click('#go');
    await p.waitForURL(URL + '/');
    await p.waitForFunction(() => typeof P !== 'undefined' && P && P.pages);
    t.eq(await p.textContent('#acct'), name, 'the account menu shows the user name');
    await p.dispatchEvent('#acct', 'mousedown');
    t.eq(await p.$$eval('#dropdown .dd span:first-child', els => els.map(e => e.textContent)), ['Change password...', 'Sign out']);
    await p.dispatchEvent('.menu[data-menu=file]', 'mousedown');
    const items = await p.$$eval('#dropdown .dd span:first-child', els => els.map(e => e.textContent));
    t.ok(items.includes('Share project...') && items.includes('Download project (.osp)'), 'server items in the File menu');
    // sign out and back in with the form
    await Promise.all([p.waitForURL(URL + '/login'), p.evaluate(() => { closeMenus(); signOut(); })]);
    await p.fill('#name', name); await p.fill('#pw', 'wrong-password'); await p.click('#go');
    await p.waitForFunction(() => document.getElementById('msg').textContent);
    t.eq(await p.textContent('#msg'), 'Wrong user name or password.');
    await p.fill('#pw', 'password123'); await p.click('#go');
    await p.waitForURL(URL + '/');
  },

  'save to the server, reopen from the project list and from the address': async t => {
    const p = t.page; await signup(p, 'devon'); await openApp(p);
    t.eq(await p.textContent('#docname'), 'New project  |  Not saved yet');
    await p.evaluate(() => { commit(() => { P.author = 'saved on server'; }); });
    await saveAs(p, 'Garage subpanel');
    t.eq(await p.evaluate(() => [P.name, host.srv.access, host.srv.rev, location.search.startsWith('?p=')]), ['Garage subpanel', 'owner', 1, true]);
    t.eq(await p.textContent('#docname'), 'Garage subpanel  |  saved on the server');
    // a second save keeps the same project and raises the revision
    await p.evaluate(() => { commit(() => { P.desc = 'second'; }); return save(); });
    await p.waitForFunction(() => host.srv.rev === 2 && !dirty);
    // reload: the address opens the project again
    const id = await p.evaluate(() => host.srv.id);
    await openApp(p, '?p=' + id);
    t.eq(await p.evaluate(() => [P.name, P.desc, filePath, P.author]), ['Garage subpanel', 'second', 'srv:' + id, 'saved on server']);
    // New project, then Open from the list
    await p.evaluate(() => fileNew()); await p.click('#dlgbtns .primary'); await p.waitForFunction(() => !$('#dlg').open && filePath === '');
    t.eq(await p.evaluate(() => [filePath, location.search]), ['', '']);
    await p.evaluate(() => { openFile(); });
    await p.waitForSelector('#pbrows a.pb-open');
    t.eq(await p.$$eval('#pbrows tr[data-id] td:nth-child(3)', els => els.map(e => e.textContent.trim())), ['Owner']);
    await p.fill('#pbfilter', 'nothing like it');
    t.eq(await p.textContent('#pbrows'), 'No project matches the filter.');
    await p.fill('#pbfilter', 'garage');
    await p.click('#pbrows a.pb-open');
    await p.waitForFunction(id => filePath === 'srv:' + id && !$('#dlg').open, id);
    t.eq(await p.evaluate(() => P.desc), 'second');
  },

  'sharing: view only, copies, and the shared list': async t => {
    const p = t.page; await signup(p, 'devon'); await openApp(p);
    const b = await second(t, 'alex');
    await saveAs(p, 'Kitchen circuits');
    const id = await p.evaluate(() => host.srv.id);
    // share from File > Share project
    await p.evaluate(() => { shareProject(); });
    await p.waitForSelector(`#dlg select[data-user="${b.u.id}"]`);
    await p.selectOption(`#dlg select[data-user="${b.u.id}"]`, 'view');
    await t.confirm();
    await p.waitForFunction(() => /Sharing saved/.test($('#st-msg').textContent));
    // the other user sees it in their list, view only
    await openApp(b.page);
    await b.page.evaluate(() => { openFile(); });
    await b.page.waitForSelector('#pbrows a.pb-open');
    t.eq(await b.page.$$eval('#pbrows tr[data-id] td', els => els.slice(1, 3).map(e => e.textContent.trim())), [await p.textContent('#acct'), 'Can view']);
    t.eq(await b.page.$$eval('#pbrows button', els => els.length), 0, 'no Share or Delete for a project you do not own');
    await b.page.click('#pbrows a.pb-open');
    await b.page.waitForFunction(() => host.srv && host.srv.readOnly);
    t.ok((await b.page.title()).endsWith('(read-only)'), 'title marks read-only');
    // saving offers a copy, which belongs to the viewer
    await b.page.evaluate(() => { commit(() => { P.desc = 'my copy'; }); save(); });
    await pick(b.page, 'Save as a copy');
    await b.page.waitForSelector('#dlg[open] input[name=v]');
    await b.page.fill('#dlg input[name=v]', 'Kitchen circuits (alex)');
    await b.page.click('#dlgbtns .primary');
    await b.page.waitForFunction(id => host.srv && host.srv.id !== id && host.srv.access === 'owner' && !dirty, id);
    const orig = await api(p, 'GET', '/api/projects/' + id);
    t.ok(!/my copy/.test(orig.content), 'the original is unchanged');
    // the owner can delete; the viewer cannot
    t.eq((await api(b.page, 'DELETE', '/api/projects/' + id)).status, 403);
    await b.done();
  },

  'one editor at a time, and conflicts after someone else saves': async t => {
    const p = t.page; await signup(p, 'devon'); await openApp(p);
    const b = await second(t, 'alex');
    await saveAs(p, 'Shop panel');
    const id = await p.evaluate(() => host.srv.id);
    await api(p, 'PUT', `/api/projects/${id}/shares`, { shares: { [b.u.id]: 'edit' } });
    // the second editor opens it while the owner has it open: read-only
    await openApp(b.page, '?p=' + id);
    await b.page.waitForFunction(() => host.srv && host.srv.lockedBy);
    t.eq(await b.page.evaluate(() => [host.srv.access, host.srv.readOnly]), ['edit', true]);
    t.ok((await b.page.textContent('#docname')).includes('read-only while'), 'shows who is editing');
    // the owner closes it; the second editor gets the lock on the next check
    await p.evaluate(() => fileNew()); await p.click('#dlgbtns .primary');
    await p.waitForTimeout(200);
    await b.page.evaluate(() => host.lock(false));
    t.eq(await b.page.evaluate(() => host.srv.readOnly), false);
    // someone saves a newer revision behind the editor's back (simulated through the API after the lock is released)
    await b.page.evaluate(() => { host.unlock(); host.srv.lockedBy = ''; });
    await b.page.waitForTimeout(100);
    const cur = await api(p, 'GET', '/api/projects/' + id);
    const changed = JSON.parse(cur.content); changed.desc = 'owner edit';
    const r = await api(p, 'PUT', '/api/projects/' + id, { name: 'Shop panel', rev: cur.project.rev, content: JSON.stringify(changed) });
    t.eq(r.rev, 2);
    await b.page.evaluate(() => host.lock(false));
    await b.page.evaluate(() => { commit(() => { P.desc = 'editor edit'; }); save(); });
    await b.page.waitForSelector('#dlg[open] .note');
    t.ok((await b.page.textContent('#dlg .note')).includes('saved this project after you opened it'), 'conflict message names the other person');
    await pick(b.page, 'Replace their changes');
    await b.page.waitForFunction(() => !dirty && host.srv.rev === 3);
    t.eq(JSON.parse((await api(p, 'GET', '/api/projects/' + id)).content).desc, 'editor edit');
    await b.done();
  },

  'preferences per user, libraries shared, autosave restore': async t => {
    const p = t.page; await signup(p, 'devon'); await openApp(p);
    const b = await second(t, 'alex');
    await p.evaluate(() => { PREFS.gridTest = 'devon'; savePrefs(); PARTS.push({ pn: 'SHARED-1', desc: 'Shared part' }); saveParts(); });
    await p.waitForTimeout(200);
    await openApp(b.page);
    t.eq(await b.page.evaluate(() => [PREFS.gridTest, PARTS.some(x => x.pn === 'SHARED-1')]), [undefined, true]);
    await b.done();
    // unsaved work comes back after the browser is closed
    await saveAs(p, 'Autosaved');
    await p.evaluate(() => { commit(() => { P.desc = 'not saved yet'; }); return host.autosave(JSON.stringify({ path: filePath, srv: host.srv, project: P })); });
    await openApp(p);
    t.eq(await p.evaluate(() => [P.desc, filePath.startsWith('srv:'), dirty, host.srv && host.srv.rev]), ['not saved yet', true, true, 1]);
  },

  'import from this computer and download': async t => {
    const p = t.page; await signup(p, 'devon'); await openApp(p);
    await p.evaluate(() => { openFile(); });
    await p.waitForSelector('#pbimport');
    const tmp = path.join(os.tmpdir(), 'openschem-import-' + Date.now() + '.osp');
    const proj = await p.evaluate(() => { const o = JSON.parse(projectJSON()); o.name = 'Imported barn'; return JSON.stringify(o); });
    fs.writeFileSync(tmp, proj);
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('#pbimport')]);
    await chooser.setFiles(tmp);
    await p.waitForFunction(() => host.srv && P.name === 'Imported barn' && !$('#dlg').open);
    fs.unlinkSync(tmp);
    t.eq(await p.evaluate(() => host.srv.access), 'owner');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => downloadProject())]);
    t.eq(dl.suggestedFilename(), 'Imported barn.osp');
    // exports download in the browser
    const [dl2] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportBOM())]);
    t.eq(dl2.suggestedFilename(), 'Imported barn BOM.csv');
  },

  'change password': async t => {
    const p = t.page; const u = await signup(p, 'devon'); await openApp(p);
    await p.evaluate(() => changePassword());
    await p.waitForSelector('#dlg input[name=old][type=password]');
    await p.fill('#dlg input[name=old]', 'password123'); await p.fill('#dlg input[name=nw]', 'newpassword1'); await p.fill('#dlg input[name=nw2]', 'newpassword1');
    await t.confirm();
    await p.waitForFunction(() => /Password changed/.test($('#st-msg').textContent));
    const r = await p.request.post(URL + '/api/login', { headers: H, data: { name: u.name, password: 'newpassword1' } });
    t.ok(r.ok(), 'the new password works');
  },
};
