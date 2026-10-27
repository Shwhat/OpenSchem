// ---------- revisions ----------
function activeRev() { const r = (P.revs || []).slice(-1)[0]; return r && !r.closed ? r.rev : null; }
function revisionsDlg() {
  const revs = P.revs || [];
  const nextL = String.fromCharCode(65 + revs.length);
  const rows = revs.length ? revs.map(r => `<div class="msg" style="cursor:default"><span class="lv">${esc(r.rev)}</span><span style="flex:1">${esc(r.date)} · ${esc(r.desc || '')} <span class="note">${esc(r.by || '')}</span></span><span class="note">${r.closed ? 'closed' : '<b>open</b>, changes are being marked'}</span></div>`).join('') : '<div class="note">No revisions yet.</div>';
  const open = activeRev();
  dialog('Revisions', [], null, 'OK', `<div class="sub">While a revision is open, every page you change is marked with its letter in the title block, the table of contents and the revision overview report.</div>${rows}
    <div class="btnrow" style="margin-top:10px">${open ? `<button type="button" class="btn small primary" data-rev="close">Close revision ${esc(open)}</button>` : `<button type="button" class="btn small primary" data-rev="new">Start revision ${nextL}</button>`}</div>`);
  $('#dlgbody').onclick = e => {
    const b = e.target.closest('[data-rev]'); if (!b) return;
    if (b.dataset.rev === 'close') { commit(() => { P.revs[P.revs.length - 1].closed = true; }); $('#dlg').close(); flash('Revision closed'); return; }
    $('#dlg').close();
    dialog(`Start revision ${nextL}`, [['desc', 'Description', ''], ['by', 'Changed by', P.author || '']], v => {
      commit(() => { P.revs = P.revs || []; P.revs.push({ rev: nextL, date: today(), desc: v.desc, by: v.by, closed: false }); });
      flash(`Revision ${nextL} started`);
    }, 'Start');
  };
}
