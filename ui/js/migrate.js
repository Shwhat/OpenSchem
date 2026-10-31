// ---------- project file format versions ----------
// FORMAT_VERSION is stored in every saved .osp file as "ver". When the stored data layout changes,
// bump FORMAT_VERSION and add a step to MIGRATIONS that upgrades a file from the previous version.
// Files are upgraded one step at a time on open, so any older file can be read.
const APP_VERSION = '1.16.0';
const FORMAT_VERSION = 4;

const MIGRATIONS = {
  // 1 -> 2: files written by 1.0 to 1.3 (fields were added over time without a version bump).
  1(p) {
    p.settings = p.settings || {};
    p.levels = p.levels || []; p.pool = p.pool || []; p.circuits = p.circuits || {}; p.assets = p.assets || {};
    p.revs = p.revs || []; p.todos = p.todos || []; p.userSyms = p.userSyms || {};
    for (const pg of p.pages) {
      pg.items = pg.items || []; pg.wires = pg.wires || []; pg.cables = pg.cables || [];
      if (pg.kind === 'floor' && !pg.view) pg.view = 'level';
      for (const it of pg.items) if (it.rot == null && it.sym !== 'text') it.rot = 0;
      pg.wires = pg.wires.filter(w => Array.isArray(w.pts) && w.pts.length >= 2);
    }
  },
  // 2 -> 3: floor plans get units (feet and inches by default) and a drawing scale per level (1/4" = 1' for existing plans).
  2(p) {
    p.units = p.units === 'metric' ? 'metric' : 'imperial';
    for (const lv of p.levels || []) if (!(lv.scale > 0)) lv.scale = 48;
  },
  // 3 -> 4: reports can each be turned off (repOff), pages and reports have an order, and custom reports exist.
  3(p) {
    p.repOff = p.repOff || {};
    if (p.cover === false) p.repOff.cover = true;
    if (p.toc === false) p.repOff.toc = true;
    delete p.cover; delete p.toc;
    p.order = p.order || {}; p.customs = p.customs || [];
  },
};

// Returns the upgraded project, or null if it should not be opened.
function migrateProject(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.pages) || !p.pages.length) { alert('This file is not a valid OpenSchem project.'); return null; }
  let v = Number(p.ver) || 1;
  if (v > FORMAT_VERSION && !confirm(`This project was saved by a newer version of OpenSchem${p.appVersion ? ' (' + p.appVersion + ')' : ''}.\n\nIt may contain things this version does not understand, and saving it here could lose them. Open anyway?`)) return null;
  const from = v;
  while (v < FORMAT_VERSION) { if (MIGRATIONS[v]) MIGRATIONS[v](p); v++; }
  if (from < FORMAT_VERSION) p._upgradedFrom = from;
  p.ver = Math.max(v, Number(p.ver) || 1);
  return p;
}
function stampVersion(p) { p.ver = Math.max(FORMAT_VERSION, Number(p.ver) || 1); p.appVersion = APP_VERSION; delete p._upgradedFrom; return p; }
