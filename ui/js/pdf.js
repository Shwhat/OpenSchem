// ---------- PDF export ----------
const PDF_ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-weight', 'text-anchor', 'opacity', 'fill-opacity', 'stroke-opacity'];
async function exportPDF() {
  if (!window.jspdf || !window.svg2pdf) { alert('PDF export is not available in this build.'); return; }
  flash('Creating PDF...');
  PRINTING = true; const keep = sel; sel = new Set();
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-6000px;top:0;width:1680px;height:1188px;overflow:hidden';
  document.body.appendChild(box);
  try {
    buildIndex(); NETS = computeNets(); WN = computeWireNumbers(); REPORTS = buildReports();
    const pages = allPages(); const num = new Map(pages.map((p, i) => [p.id, i + 1]));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [420, 297], compress: true });
    doc.setProperties({ title: P.name || 'OpenSchem project', creator: 'OpenSchem', author: P.author || '' });
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i]; if (i) doc.addPage([420, 297], 'landscape');
      box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SH.w} ${SH.h}" width="1680" height="1188">${pageSVG(pg, { print: true }).replace(/id="(gp|fpc-[^"]+|fgp-[^"]+)"/g, 'id="$1-pdf"').replace(/url\(#(gp|fpc-[^)]+|fgp-[^)]+)\)/g, 'url(#$1-pdf)')}</svg>`;
      const el = box.firstElementChild;
      const links = [];
      el.querySelectorAll('[data-link]').forEach(n => { const p = num.get(n.dataset.link); if (!p || p === i + 1) return; try { const b = n.getBBox(); links.push([b.x, b.y, b.width, b.height, p]); } catch (e) {} });
      el.querySelectorAll('.hit,.wirehit').forEach(n => n.remove());
      el.querySelectorAll('[fill^="url(#gp"],[fill^="url(#fgp"]').forEach(n => n.remove());
      el.querySelectorAll('*').forEach(n => {
        const cs = getComputedStyle(n);
        for (const a of PDF_ATTRS) { const v = cs.getPropertyValue(a); if (v && v !== 'normal') n.setAttribute(a, v.replace(/px/g, '')); }
        if (n.tagName === 'text') n.setAttribute('font-family', 'helvetica');
      });
      await window.svg2pdf.svg2pdf(el, doc, { x: 0, y: 0, width: 420, height: 297 });
      for (const [x, y, w, h, p] of links) doc.link(x, y, Math.max(w, 2), Math.max(h, 2), { pageNumber: p });
      doc.outline.add(null, `${pageName(pg)}${pg.desc && !pg.report ? '  ' + pg.desc : ''}`, { pageNumber: i + 1 });
    }
    const b64 = doc.output('datauristring').split(',')[1];
    const name = (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
    const p = await host.saveBinary(b64, name, 'PDF document', 'pdf');
    if (p) flash('Exported ' + p);
  } catch (e) { alert('PDF export failed: ' + e.message); }
  finally { box.remove(); PRINTING = false; sel = keep; render(); }
}
