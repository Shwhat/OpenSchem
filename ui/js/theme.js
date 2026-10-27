// ---------- theme (dark mode) ----------
let PRINTING = false;
const sheetDark = () => PREFS.sheet === 'dark' && !PRINTING;
const WIRECOL_DARK = { BK: '#cfd3d8', WH: '#e8ebef', GN: '#3cc760', RD: '#ff5c5c', BL: '#5b9bff', YL: '#f2d23c', BARE: '#e09a5c' };
const wireColor = c => (sheetDark() ? WIRECOL_DARK : WIRECOL)[c];
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const dark = PREFS.theme === 'dark' || (PREFS.theme === 'system' && mq && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.sheet = PREFS.sheet === 'dark' ? 'dark' : 'white';
}
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (PREFS.theme === 'system') applyTheme(); });
function toggleTheme() { PREFS.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; savePrefs(); applyTheme(); flash(PREFS.theme === 'dark' ? 'Dark theme' : 'Light theme'); }
function toggleSheet() { PREFS.sheet = PREFS.sheet === 'dark' ? 'white' : 'dark'; savePrefs(); applyTheme(); render(); flash(PREFS.sheet === 'dark' ? 'Dark sheet' : 'White sheet'); }
