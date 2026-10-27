// ---------- host bridge (Go/WebView2) with browser fallback ----------
const host = {
  has: typeof window.osOpen === 'function',
  async open() { if (this.has) return await window.osOpen(); return null; },
  async save(path, content) { if (this.has) return await window.osSave(path, content); download('project.osp', content); return 'project.osp'; },
  async saveAs(content, name) { if (this.has) return await window.osSaveAs(content, name); download(name, content); return name; },
  async title(t) { document.title = t; if (this.has) try { await window.osSetTitle(t); } catch (e) {} },
  async autosave(c) { if (this.has) try { await window.osAutosave(c); } catch (e) {} },
  async getAutosave() { if (this.has) try { return await window.osGetAutosave(); } catch (e) {} return ''; },
  async saveText(content, name) { if (this.has) return await window.osSaveText(content, name); download(name, content); return name; },
  async saveBinary(b64, name, desc, ext) {
    if (this.has) return await window.osSaveBase64(b64, name, desc, ext);
    const a = document.createElement('a'); a.href = 'data:application/pdf;base64,' + b64; a.download = name; a.click(); return name;
  },
  async readData(n) { if (this.has) { try { return await window.osReadData(n); } catch (e) { return ''; } } try { return localStorage.getItem('os:' + n) || ''; } catch (e) { return ''; } },
  async writeData(n, c) { if (this.has) { try { await window.osWriteData(n, c); } catch (e) {} return; } try { localStorage.setItem('os:' + n, c); } catch (e) {} },
  async saveFile(content, name, desc, ext) { if (this.has) return await window.osSaveFile(content, name, desc, ext); download(name, content); return name; },
  async openText(desc, ext) {
    if (this.has) return await window.osOpenText(desc, ext);
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.' + ext; i.onchange = async () => res(i.files[0] ? { path: i.files[0].name, content: await i.files[0].text() } : null); i.click(); });
  },
  async openBinary(desc, ext) {
    if (this.has) return await window.osOpenBase64(desc, ext);
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.' + ext; i.onchange = () => { const f = i.files[0]; if (!f) return res(null); const r = new FileReader(); r.onload = () => res({ path: f.name, content: String(r.result).split(',')[1] }); r.readAsDataURL(f); }; i.click(); });
  },
  setDirty(d) { if (this.has && window.osSetDirty) try { window.osSetDirty(!!d); } catch (e) {} },
  quit() { if (this.has && window.osQuit) window.osQuit(); },
  async initialFile() { if (this.has) try { return await window.osInitialFile(); } catch (e) {} return null; },
};
function download(name, content) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' })); a.download = name; a.click();
}
