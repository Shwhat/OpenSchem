// ---------- About OpenSchem: the built-in guide ----------
// The pages come from ui/about/*.md, bundled into ABOUT_PAGES by tools/about.py, so the guide works offline.
// Links to /about/slug switch pages; the address #about or #about/slug opens the guide.
const mdInline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => /^\/about\//.test(u) ? `<a href="#" data-about="${u.slice(7)}">${t}</a>` : `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
function mdRender(src) {
  const L = src.replace(/\r/g, '').split('\n'), out = []; let i = 0;
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{1,4}) (.+)$/); if (h) { out.push(`<h${h[1].length}>${mdInline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\|/.test(l) && /^\|[\s:|-]+\|?\s*$/.test(L[i + 1] || '')) {
      const head = cells(l); i += 2; const rows = [];
      while (i < L.length && /^\|/.test(L[i])) rows.push(cells(L[i++]));
      out.push(`<table><thead><tr>${head.map(c => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue;
    }
    const li = l.match(/^(\s*)([-*]|\d+\.) (.+)$/);
    if (li) {
      const ord = /\d/.test(li[2]), items = [];
      while (i < L.length) { const m = L[i].match(/^\s*([-*]|\d+\.) (.+)$/); if (!m) break; items.push(m[2]); i++; }
      out.push(`<${ord ? 'ol' : 'ul'}>${items.map(t => `<li>${mdInline(t)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`); continue;
    }
    const para = []; while (i < L.length && L[i].trim() && !/^(#{1,4} |\||\s*([-*]|\d+\.) )/.test(L[i])) para.push(L[i++]);
    out.push(`<p>${mdInline(para.join(' '))}</p>`);
  }
  return out.join('');
}
function aboutDlg(slug) {
  let i = Math.max(0, ABOUT_PAGES.findIndex(p => p.slug === slug));
  dialog('About OpenSchem', [], null, 'Close', '<div id="aboutwrap"></div>');
  const dlg = $('#dlg'); dlg.style.width = '1040px'; dlg.style.maxWidth = '96vw';
  const wrap = $('#aboutwrap');
  const show = n => {
    i = n; const p = ABOUT_PAGES[i], prev = ABOUT_PAGES[i - 1], next = ABOUT_PAGES[i + 1];
    wrap.innerHTML = `<div class="abhead"><b>About OpenSchem</b><span class="note">Version ${esc(APP_VERSION)}</span></div>
      <div class="about"><nav class="abtoc">${ABOUT_PAGES.map((q, k) => `<a href="#" data-about="${q.slug}" class="${k === i ? 'on' : ''}">${esc(q.title)}</a>`).join('')}</nav>
      <select class="abselect" aria-label="About page">${ABOUT_PAGES.map((q, k) => `<option value="${q.slug}" ${k === i ? 'selected' : ''}>${esc(q.title)}</option>`).join('')}</select>
      <article class="abpage">${mdRender(p.body)}<div class="abpager">${prev ? `<a href="#" data-about="${prev.slug}">Previous: ${esc(prev.title)}</a>` : ''}<span style="flex:1"></span>${next ? `<a href="#" data-about="${next.slug}">Next: ${esc(next.title)}</a>` : ''}</div></article></div>`;
    wrap.querySelector('.abpage').scrollTop = 0;
  };
  wrap.addEventListener('click', e => { const a = e.target.closest('[data-about]'); if (!a) return; e.preventDefault(); const k = ABOUT_PAGES.findIndex(q => q.slug === a.dataset.about); if (k >= 0) show(k); });
  wrap.addEventListener('change', e => { if (e.target.classList.contains('abselect')) show(ABOUT_PAGES.findIndex(q => q.slug === e.target.value)); });
  show(i);
}
window.addEventListener('hashchange', () => { if (/^#about(\/|$)/.test(location.hash)) aboutDlg(location.hash.slice(7)); });
