// ---------- tabbed ribbon ----------
const RI = {
  newp: '<svg viewBox="0 0 20 20"><path d="M5 2h7l4 4v12H5z" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M12 2v4h4" fill="none" stroke="#556" stroke-width="1.2"/></svg>',
  open: '<svg viewBox="0 0 20 20"><path d="M2 5h6l2 2h8v9H2z" fill="#f4d58d" stroke="#8a6d1d" stroke-width="1.1"/></svg>',
  save: '<svg viewBox="0 0 20 20"><path d="M3 3h12l2 2v12H3z" fill="#4a77c9" stroke="#2b4f91" stroke-width="1.1"/><rect x="6" y="4" width="7" height="4" fill="#fff"/><rect x="5.5" y="11" width="9" height="5" fill="#dbe6f7"/></svg>',
  undo: '<svg viewBox="0 0 20 20"><path d="M7 5L3 9l4 4M3 9h9a4 4 0 010 8H9" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  redo: '<svg viewBox="0 0 20 20"><path d="M13 5l4 4-4 4M17 9H8a4 4 0 000 8h3" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  cut: '<svg viewBox="0 0 20 20"><circle cx="6" cy="15" r="2.5" fill="none" stroke="#2b3442" stroke-width="1.4"/><circle cx="14" cy="15" r="2.5" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M7.5 13L14 3M12.5 13L6 3" stroke="#2b3442" stroke-width="1.4"/></svg>',
  copy: '<svg viewBox="0 0 20 20"><rect x="6" y="6" width="10" height="11" fill="#fff" stroke="#2b3442" stroke-width="1.3"/><path d="M4 13V3h9" fill="none" stroke="#2b3442" stroke-width="1.3"/></svg>',
  paste: '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="14" rx="1" fill="#e9d9b6" stroke="#7a6230" stroke-width="1.2"/><rect x="7" y="2.5" width="6" height="3" fill="#fff" stroke="#7a6230"/><rect x="7" y="8" width="8" height="9" fill="#fff" stroke="#2b3442"/></svg>',
  select: '<svg viewBox="0 0 20 20"><path d="M5 3l10 7-4.5 1 2.5 5-2 1-2.5-5L5 15z" fill="#2b3442"/></svg>',
  wire: '<svg viewBox="0 0 20 20"><path d="M3 15h6V5h8" fill="none" stroke="#0b2e8f" stroke-width="1.6"/><circle cx="3" cy="15" r="1.6" fill="#0b2e8f"/><circle cx="17" cy="5" r="1.6" fill="#0b2e8f"/></svg>',
  text: '<svg viewBox="0 0 20 20"><text x="10" y="15" font-size="13" text-anchor="middle" font-family="Georgia,serif" fill="#2b3442">T</text></svg>',
  rotate: '<svg viewBox="0 0 20 20"><path d="M15 10a5 5 0 11-2-4" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M14 2v5h-5" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  mirror: '<svg viewBox="0 0 20 20"><path d="M10 2v16" stroke="#2b3442" stroke-dasharray="2 1.5"/><path d="M8 5L3 15h5z" fill="#2b3442"/><path d="M12 5l5 10h-5z" fill="none" stroke="#2b3442" stroke-width="1.2"/></svg>',
  del: '<svg viewBox="0 0 20 20"><path d="M5 6h10l-1 11H6zM3 6h14M8 6V3h4v3" fill="none" stroke="#a33" stroke-width="1.4"/></svg>',
  snap: '<svg viewBox="0 0 20 20"><g fill="#7a8899"><circle cx="4" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="16" cy="4" r="1"/><circle cx="4" cy="10" r="1"/><circle cx="16" cy="10" r="1"/><circle cx="4" cy="16" r="1"/><circle cx="10" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></g><circle cx="10" cy="10" r="2.6" fill="none" stroke="#e0332b" stroke-width="1.6"/></svg>',
  grid: '<svg viewBox="0 0 20 20"><path d="M3 3h14v14H3zM8 3v14M13 3v14M3 8h14M3 13h14" fill="none" stroke="#2b3442" stroke-width="1"/></svg>',
  check: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#2f7d32" stroke-width="1.6"/><path d="M6.5 10l2.5 2.5 4.5-5" fill="none" stroke="#2f7d32" stroke-width="1.8"/></svg>',
  fit: '<svg viewBox="0 0 20 20"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  zin: '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="#2b3442" stroke-width="1.5"/><path d="M12 12l5 5M6 8.5h5M8.5 6v5" stroke="#2b3442" stroke-width="1.5"/></svg>',
  zout: '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="#2b3442" stroke-width="1.5"/><path d="M12 12l5 5M6 8.5h5" stroke="#2b3442" stroke-width="1.5"/></svg>',
  prev: '<svg viewBox="0 0 20 20"><path d="M12 4l-6 6 6 6" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  next: '<svg viewBox="0 0 20 20"><path d="M8 4l6 6-6 6" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  page: '<svg viewBox="0 0 20 20"><rect x="4" y="2" width="12" height="16" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M14 13v5M11.5 15.5h5" stroke="#2f7d32" stroke-width="1.6"/></svg>',
  fpage: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M2 10h8V3M10 13v4" fill="none" stroke="#556" stroke-width="1.2"/></svg>',
  props: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="1.5" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M6 7h8M6 10h8M6 13h5" stroke="#556" stroke-width="1.2"/></svg>',
  dup: '<svg viewBox="0 0 20 20"><rect x="7" y="6" width="10" height="12" fill="#fff" stroke="#556" stroke-width="1.2"/><rect x="3" y="2" width="10" height="12" fill="#fff" stroke="#556" stroke-width="1.2"/></svg>',
  num: '<svg viewBox="0 0 20 20"><text x="10" y="14" font-size="10" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#2b3442">123</text></svg>',
  lock: '<svg viewBox="0 0 20 20"><rect x="4" y="9" width="12" height="9" rx="1" fill="#2b3442"/><path d="M7 9V6a3 3 0 016 0v3" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  report: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M6 6h8M6 9h8M6 12h8M6 15h5" stroke="#556"/></svg>',
  csv: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#e8f3ea" stroke="#2f7d32" stroke-width="1.2"/><text x="10" y="13" font-size="6" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#2f7d32">CSV</text></svg>',
  settings: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.1 2.1M13.6 13.6l2.1 2.1M4.3 15.7l2.1-2.1M13.6 6.4l2.1-2.1" stroke="#2b3442" stroke-width="1.6"/></svg>',
  ribbon: '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="4" fill="#dbe6f7" stroke="#2b4f91"/><rect x="2" y="9" width="16" height="7" fill="#fff" stroke="#556"/><path d="M5 12h3M10 12h3" stroke="#556" stroke-width="1.5"/></svg>',
  library: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="4" height="14" fill="#dbe6f7" stroke="#2b4f91"/><rect x="8" y="3" width="4" height="14" fill="#f4e2c2" stroke="#8a6d1d"/><path d="M13 4l3.5-.8 2.5 13-3.5.8z" fill="#e3f0e3" stroke="#2f7d32"/></svg>',
  newsym: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="11" height="11" fill="none" stroke="#2b3442" stroke-width="1.3" stroke-dasharray="2 1.5"/><path d="M15 12v6M12 15h6" stroke="#2f7d32" stroke-width="1.8"/></svg>',
  room: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  roomoval: '<svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8" ry="5.5" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  roomcirc: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  roompoly: '<svg viewBox="0 0 20 20"><path d="M3 4h9v5h5v7H3z" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  image: '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M4 14l4-5 3 3 2-2 3 4z" fill="#7a8899"/></svg>',
  cable: '<svg viewBox="0 0 20 20"><path d="M2 10h16" stroke="#444" stroke-width="1.3" stroke-dasharray="4 1.5 1 1.5"/><path d="M6 4v12M10 4v12M14 4v12" stroke="#0b2e8f" stroke-width="1.1"/></svg>',
  macro: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" rx="1.5" fill="#eef3fb" stroke="#2b4f91" stroke-width="1.2"/><path d="M6 6v8M6 10h4M10 7v6" stroke="#0b2e8f" stroke-width="1.2"/><circle cx="14" cy="10" r="2" fill="none" stroke="#000"/></svg>',
  macrosave: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="13" height="12" rx="1.5" fill="#eef3fb" stroke="#2b4f91" stroke-width="1.2"/><path d="M16 9v8M12 13h8" stroke="#2f7d32" stroke-width="1.8"/></svg>',
  todo: '<svg viewBox="0 0 20 20"><path d="M5 17V3" stroke="#b45309" stroke-width="1.5"/><path d="M5 3l10 3-10 3z" fill="#f59e0b"/></svg>',
  todolist: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="3" height="3" fill="none" stroke="#2b3442"/><path d="M3.6 5.5l.9.9 1.5-2" stroke="#2f7d32" fill="none"/><rect x="3" y="9" width="3" height="3" fill="none" stroke="#2b3442"/><rect x="3" y="14" width="3" height="3" fill="none" stroke="#2b3442"/><path d="M8 5.5h9M8 10.5h9M8 15.5h9" stroke="#2b3442" stroke-width="1.3"/></svg>',
  rev: '<svg viewBox="0 0 20 20"><path d="M10 3l7 13H3z" fill="#fff3d6" stroke="#b07a10" stroke-width="1.3"/><text x="10" y="14.5" font-size="7" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#7a5200">A</text></svg>',
  pdf: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fdecec" stroke="#b3261e" stroke-width="1.2"/><text x="10" y="13" font-size="6" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#b3261e">PDF</text></svg>',
  theme: '<svg viewBox="0 0 20 20"><path d="M14.5 13.5A6.5 6.5 0 017 4a6.5 6.5 0 107.5 9.5z" fill="#2b3442"/></svg>',
  sheetd: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" fill="#1e2228" stroke="#556"/><path d="M6 13h8M10 6v7" stroke="#cfd3d8" stroke-width="1.2"/></svg>',
  zwin: '<svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="10" height="8" fill="none" stroke="#2b3442" stroke-width="1.2" stroke-dasharray="2 1.3"/><circle cx="12" cy="12" r="3.6" fill="#fff" stroke="#2b3442" stroke-width="1.5"/><path d="M14.6 14.6l3.6 3.6" stroke="#2b3442" stroke-width="1.8"/></svg>',
  zprev: '<svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5" fill="none" stroke="#2b3442" stroke-width="1.5"/><path d="M12.6 12.6l4.6 4.6" stroke="#2b3442" stroke-width="1.8"/><path d="M10.5 6.5L8 9l2.5 2.5" fill="none" stroke="#1f5fbf" stroke-width="1.5"/></svg>',
  layers: '<svg viewBox="0 0 20 20"><path d="M10 3l8 4-8 4-8-4z" fill="#dbe6f7" stroke="#2b4f91" stroke-width="1.1"/><path d="M2 10.5l8 4 8-4M2 14l8 4 8-4" fill="none" stroke="#2b4f91" stroke-width="1.1"/></svg>',
  gline: '<svg viewBox="0 0 20 20"><path d="M3 16L17 4" stroke="#2b3442" stroke-width="1.6"/></svg>',
  gpoly: '<svg viewBox="0 0 20 20"><path d="M3 16L7 6l6 7 4-9" fill="none" stroke="#2b3442" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  grect: '<svg viewBox="0 0 20 20"><rect x="3" y="5" width="14" height="10" fill="none" stroke="#2b3442" stroke-width="1.5"/></svg>',
  gcircle: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#2b3442" stroke-width="1.5"/></svg>',
  gdim: '<svg viewBox="0 0 20 20"><path d="M3 13h14M3 10v6M17 10v6" stroke="#2b3442" stroke-width="1.2"/><text x="10" y="9" font-size="6" text-anchor="middle" font-family="Arial" fill="#2b3442">50</text></svg>',
  xlsx: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#e6f4ea" stroke="#1e7a3c" stroke-width="1.2"/><path d="M7 7l6 7M13 7l-6 7" stroke="#1e7a3c" stroke-width="1.6"/></svg>',
  xlsxin: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#e6f4ea" stroke="#1e7a3c" stroke-width="1.2"/><path d="M10 5v9M6.5 10.5L10 14l3.5-3.5" fill="none" stroke="#1e7a3c" stroke-width="1.6"/></svg>',
  find: '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M12.2 12.2l5 5" stroke="#2b3442" stroke-width="2"/></svg>',
  tstrip: '<svg viewBox="0 0 20 20"><rect x="3" y="6" width="14" height="8" fill="#fff" stroke="#2b3442" stroke-width="1.2"/><path d="M6.5 6v8M10 6v8M13.5 6v8" stroke="#2b3442"/><circle cx="4.8" cy="10" r=".8"/><circle cx="8.2" cy="10" r=".8"/><circle cx="11.8" cy="10" r=".8"/><circle cx="15.2" cy="10" r=".8"/></svg>',
  layout: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M5 6h10M5 12h10" stroke="#888" stroke-width="1.6"/><rect x="6" y="7" width="3" height="4" fill="#7a8899"/><rect x="10.5" y="7" width="3.5" height="4" fill="#7a8899"/></svg>',
  align: '<svg viewBox="0 0 20 20"><g fill="#7a8899"><circle cx="4" cy="4" r="1"/><circle cx="16" cy="4" r="1"/><circle cx="4" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></g><rect x="6.5" y="6.5" width="7" height="7" fill="#dbe6f7" stroke="#2b4f91" stroke-width="1.2"/><path d="M4 4l2.5 2.5" stroke="#e0332b" stroke-width="1.3"/></svg>',
  autoconn: '<svg viewBox="0 0 20 20"><rect x="7" y="2" width="6" height="4" fill="none" stroke="#2b3442" stroke-width="1.2"/><rect x="7" y="14" width="6" height="4" fill="none" stroke="#2b3442" stroke-width="1.2"/><path d="M10 6v8" stroke="#0b2e8f" stroke-width="1.6"/><path d="M14.5 8.5l2 1.5-2 1.5" fill="none" stroke="#e0332b" stroke-width="1.2"/></svg>',
  parts: '<svg viewBox="0 0 20 20"><path d="M10 2l7 3.5v9L10 18l-7-3.5v-9z" fill="#f4e2c2" stroke="#8a6d1d" stroke-width="1.1"/><path d="M3 5.5l7 3.5 7-3.5M10 9v9" fill="none" stroke="#8a6d1d" stroke-width="1.1"/></svg>',
  label: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M10 2v16M3 6h14M3 10h14M3 14h14" stroke="#556" stroke-width=".8"/></svg>',
  load: '<svg viewBox="0 0 20 20"><path d="M11 2L5 11h4l-1 7 6-9h-4z" fill="#f5c542" stroke="#8a6d1d" stroke-width="1"/></svg>',
  osnap: '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" fill="none" stroke="#2b3442" stroke-width="1.2"/><rect x="2.5" y="2.5" width="3" height="3" fill="#fff" stroke="#c0392b" stroke-width="1.2"/><path d="M10 4v12M4 10h12" stroke="#c0392b" stroke-width=".8" stroke-dasharray="1.5 1.5"/></svg>',
  ortho: '<svg viewBox="0 0 20 20"><path d="M4 16V4M4 16h12" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M4 4l-1.5 2.5M4 4l1.5 2.5M16 16l-2.5-1.5M16 16l-2.5 1.5" stroke="#2b3442" stroke-width="1.2"/></svg>',
  polar: '<svg viewBox="0 0 20 20"><path d="M3 16h14M3 16L14 5" stroke="#2b3442" stroke-width="1.5"/><path d="M9 16a6 6 0 0 0-1.8-4.2" fill="none" stroke="#c0392b" stroke-width="1.3"/></svg>',
  cmdline: '<svg viewBox="0 0 20 20"><rect x="2" y="5" width="16" height="10" rx="1.5" fill="#1d232c" stroke="#2b3442"/><path d="M5 8.5l2.5 1.5L5 11.5M9.5 12h4" fill="none" stroke="#8fd18f" stroke-width="1.3"/></svg>',
  scale: '<svg viewBox="0 0 20 20"><path d="M2 14h16M2 11v6M6 12.5v3M10 11v6M14 12.5v3M18 11v6" stroke="#2b3442" stroke-width="1.2" fill="none"/><path d="M4 7h5M6.5 4.5v5" stroke="#1f5fbf" stroke-width="1.2"/></svg>',
  darc: '<svg viewBox="0 0 20 20"><path d="M3 15A8 8 0 0 1 17 9" fill="none" stroke="#2b3442" stroke-width="1.6"/><rect x="1.8" y="13.8" width="2.4" height="2.4" fill="#1f5fbf"/><rect x="15.8" y="7.8" width="2.4" height="2.4" fill="#1f5fbf"/></svg>',
  dcircle2: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#2b3442" stroke-width="1.5"/><path d="M3.5 10h13" stroke="#1f5fbf" stroke-width="1.1"/><circle cx="3.5" cy="10" r="1.2" fill="#1f5fbf"/><circle cx="16.5" cy="10" r="1.2" fill="#1f5fbf"/></svg>',
  dcircle3: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#2b3442" stroke-width="1.5"/><circle cx="10" cy="3.5" r="1.2" fill="#1f5fbf"/><circle cx="4.4" cy="13.3" r="1.2" fill="#1f5fbf"/><circle cx="15.6" cy="13.3" r="1.2" fill="#1f5fbf"/></svg>',
  dellipse: '<svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7.5" ry="4.5" fill="none" stroke="#2b3442" stroke-width="1.5" transform="rotate(-20 10 10)"/></svg>',
  dpolygon: '<svg viewBox="0 0 20 20"><path d="M10 2.5l6.5 3.75v7.5L10 17.5l-6.5-3.75v-7.5z" fill="none" stroke="#2b3442" stroke-width="1.5"/></svg>',
  drect: '<svg viewBox="0 0 20 20"><rect x="3" y="5" width="14" height="10" rx="3" fill="none" stroke="#2b3442" stroke-width="1.5"/></svg>',
  dspline: '<svg viewBox="0 0 20 20"><path d="M2 14C5 2 9 18 12 8S17 5 18 7" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  dtext: '<svg viewBox="0 0 20 20"><path d="M4 4h12M10 4v13" stroke="#2b3442" stroke-width="2"/><path d="M3 18h6" stroke="#1f5fbf" stroke-width="1.2"/></svg>',
  dmkroom: '<svg viewBox="0 0 20 20"><path d="M3 6c0-2 2-3 4-3h6c2 0 4 1 4 3v8c0 2-2 3-4 3H7c-2 0-4-1-4-3z" fill="#eef3fb" stroke="#2b3442" stroke-width="1.3" stroke-dasharray="2 1.5"/><path d="M7 10h6M10 7v6" stroke="#1e7a3c" stroke-width="1.6"/></svg>',
  emove: '<svg viewBox="0 0 20 20"><path d="M10 2v16M2 10h16M10 2l-2.5 2.5M10 2l2.5 2.5M10 18l-2.5-2.5M10 18l2.5-2.5M2 10l2.5-2.5M2 10l2.5 2.5M18 10l-2.5-2.5M18 10l-2.5 2.5" fill="none" stroke="#2b3442" stroke-width="1.4"/></svg>',
  ecopy: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="9" height="9" fill="none" stroke="#2b3442" stroke-width="1.4"/><rect x="8" y="8" width="9" height="9" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  erotate: '<svg viewBox="0 0 20 20"><path d="M15.5 7A6.5 6.5 0 1 0 16 12" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M16 3v4.5h-4.5" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  escale: '<svg viewBox="0 0 20 20"><rect x="3" y="9" width="8" height="8" fill="none" stroke="#2b3442" stroke-width="1.4"/><rect x="3" y="3" width="14" height="14" fill="none" stroke="#1f5fbf" stroke-width="1.4" stroke-dasharray="2 1.5"/><path d="M11 9l5-5" fill="none" stroke="#2b3442" stroke-width="1.4"/></svg>',
  emirror: '<svg viewBox="0 0 20 20"><path d="M10 2v16" stroke="#c0392b" stroke-width="1.2" stroke-dasharray="2 1.5"/><path d="M8 5L3 15h5z" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M12 5l5 10h-5z" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  eoffset: '<svg viewBox="0 0 20 20"><path d="M3 16V8a5 5 0 0 1 5-5h9" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M7 17V9a2 2 0 0 1 2-2h8" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  etrim: '<svg viewBox="0 0 20 20"><path d="M10 2v16" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M2 10h8" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><path d="M10 10h8" stroke="#c0392b" stroke-width="1.4" stroke-dasharray="2 1.5"/></svg>',
  eextend: '<svg viewBox="0 0 20 20"><path d="M17 2v16" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M2 10h9" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><path d="M11 10h6" fill="none" stroke="#1f5fbf" stroke-width="1.4" stroke-dasharray="2 1.5"/><path d="M14 7.5l2.5 2.5-2.5 2.5" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  efillet: '<svg viewBox="0 0 20 20"><path d="M3 17V10a7 7 0 0 1 7-7h7" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M3 3v14M3 3h14" stroke="#9aa5b3" stroke-width=".8" stroke-dasharray="1.5 1.5" fill="none"/></svg>',
  echamfer: '<svg viewBox="0 0 20 20"><path d="M3 17V9l6-6h8" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M3 3v6M3 3h6" stroke="#9aa5b3" stroke-width=".8" stroke-dasharray="1.5 1.5" fill="none"/></svg>',
  ebreak: '<svg viewBox="0 0 20 20"><path d="M2 10h6M12 10h6" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M8 7v6M12 7v6" stroke="#c0392b" stroke-width="1.2"/></svg>',
  ejoin: '<svg viewBox="0 0 20 20"><path d="M2 14l6-6M12 8l6 6" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M8 8h4" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  eexplode: '<svg viewBox="0 0 20 20"><path d="M4 4l3 3M16 4l-3 3M4 16l3-3M16 16l-3-3M10 2v4M10 14v4M2 10h4M14 10h4" fill="none" stroke="#2b3442" stroke-width="1.4"/></svg>',
  earect: '<svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="4" height="4" fill="none" stroke="#2b3442" stroke-width="1.4"/><rect x="8" y="2.5" width="4" height="4" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><rect x="13.5" y="2.5" width="4" height="4" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><rect x="2.5" y="8" width="4" height="4" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><rect x="8" y="8" width="4" height="4" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><rect x="13.5" y="8" width="4" height="4" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  eapolar: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="1.2" fill="#2b3442"/><circle cx="10" cy="3.5" r="2" fill="none" stroke="#2b3442" stroke-width="1.4"/><circle cx="16" cy="12" r="2" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><circle cx="4" cy="12" r="2" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><circle cx="10" cy="16.5" r="2" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  eapath: '<svg viewBox="0 0 20 20"><path d="M2 16C6 4 14 4 18 16" fill="none" stroke="#9aa5b3" stroke-width="1"/><circle cx="3.5" cy="13" r="1.6" fill="none" stroke="#2b3442" stroke-width="1.4"/><circle cx="10" cy="7" r="1.6" fill="none" stroke="#1f5fbf" stroke-width="1.4"/><circle cx="16.5" cy="13" r="1.6" fill="none" stroke="#1f5fbf" stroke-width="1.4"/></svg>',
  efront: '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="10" height="10" fill="#dbe3ee" stroke="#9aa5b3"/><rect x="7" y="7" width="11" height="11" fill="#1f5fbf" stroke="#2b3442"/></svg>',
  eback: '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="11" height="11" fill="#1f5fbf" stroke="#2b3442"/><rect x="2" y="2" width="10" height="10" fill="#dbe3ee" stroke="#9aa5b3"/></svg>',
  wwall: '<svg viewBox="0 0 20 20"><path d="M2 6h16v4H2z" fill="#c9ced5" stroke="#2b3442" stroke-width="1.2"/><path d="M14 10v8h4v-8" fill="#c9ced5" stroke="#2b3442" stroke-width="1.2"/></svg>',
  wset: '<svg viewBox="0 0 20 20"><path d="M2 8h16v4H2z" fill="#c9ced5" stroke="#2b3442" stroke-width="1.1"/><path d="M6 4v12M14 4v12" stroke="#1f5fbf" stroke-width="1"/><path d="M4 4h4M12 4h4" stroke="#1f5fbf"/></svg>',
  wdoor: '<svg viewBox="0 0 20 20"><path d="M2 16h3M15 16h3" stroke="#2b3442" stroke-width="2.4"/><path d="M5 16V6" stroke="#2b3442" stroke-width="1.5"/><path d="M5 6a10 10 0 0 1 10 10" fill="none" stroke="#1f5fbf" stroke-width="1"/></svg>',
  wdouble: '<svg viewBox="0 0 20 20"><path d="M1 16h2M17 16h2" stroke="#2b3442" stroke-width="2.4"/><path d="M3 16V9M17 16V9" stroke="#2b3442" stroke-width="1.5"/><path d="M3 9a7 7 0 0 1 7 7M17 9a7 7 0 0 0-7 7" fill="none" stroke="#1f5fbf" stroke-width="1"/></svg>',
  wpocket: '<svg viewBox="0 0 20 20"><path d="M1 14h18v3H1z" fill="#c9ced5" stroke="#2b3442" stroke-width="1"/><path d="M8 15.5h-6" stroke="#1f5fbf" stroke-width="1.4" stroke-dasharray="1.5 1"/><path d="M8 13v5M17 13v5" stroke="#2b3442"/></svg>',
  wbifold: '<svg viewBox="0 0 20 20"><path d="M1 16h3M16 16h3" stroke="#2b3442" stroke-width="2.4"/><path d="M4 16l3-6 3 6 3-6 3 6" fill="none" stroke="#1f5fbf" stroke-width="1.3"/></svg>',
  wslide: '<svg viewBox="0 0 20 20"><path d="M1 12h2M17 12h2" stroke="#2b3442" stroke-width="5"/><path d="M3 10.5h8M9 13.5h8" stroke="#1f5fbf" stroke-width="1.6"/></svg>',
  wgarage: '<svg viewBox="0 0 20 20"><path d="M1 16h2M17 16h2" stroke="#2b3442" stroke-width="2.4"/><path d="M3 16h14" stroke="#2b3442" stroke-width="1.4"/><path d="M3 16V4h14v12" fill="none" stroke="#1f5fbf" stroke-width="1" stroke-dasharray="2 1.2"/></svg>',
  wwindow: '<svg viewBox="0 0 20 20"><path d="M1 8h3v4H1zM16 8h3v4h-3z" fill="#c9ced5" stroke="#2b3442"/><path d="M4 8h12M4 12h12M4 9.5h12M4 10.5h12" stroke="#1f5fbf" stroke-width=".7"/></svg>',
  wopen: '<svg viewBox="0 0 20 20"><path d="M1 8h4v4H1zM15 8h4v4h-4z" fill="#c9ced5" stroke="#2b3442"/><path d="M5 8h10M5 12h10" stroke="#1f5fbf" stroke-width=".8" stroke-dasharray="1.5 1"/></svg>',
  wroom: '<svg viewBox="0 0 20 20"><path d="M2 2h16v16H2z" fill="none" stroke="#2b3442" stroke-width="2.4"/><path d="M4 4h12v12H4z" fill="#dce8fb"/><circle cx="10" cy="10" r="1.6" fill="#1e7a3c"/></svg>',
  vsheet: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" fill="#fff" stroke="#556" stroke-width="1.1"/><rect x="4" y="5" width="7" height="6" fill="#dce8fb" stroke="#1f5fbf" stroke-width=".8"/><rect x="12.5" y="5" width="4" height="4" fill="#dce8fb" stroke="#1f5fbf" stroke-width=".8"/><path d="M4 13h5M12.5 11h3" stroke="#556" stroke-width=".8"/></svg>',
  vadd: '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="12" height="10" fill="#dce8fb" stroke="#1f5fbf" stroke-width="1" stroke-dasharray="2 1"/><path d="M15 12v6M12 15h6" stroke="#1e7a3c" stroke-width="1.8"/></svg>',
  adlin: '<svg viewBox="0 0 20 20"><path d="M3 4v10M17 4v10" stroke="#2b3442" stroke-width="1"/><path d="M3 11h14" stroke="#1f5fbf" stroke-width="1.2"/><path d="M2 12l2-2M16 12l2-2" stroke="#1f5fbf" stroke-width="1.2"/><text x="10" y="9" font-size="5" text-anchor="middle" font-family="Arial" fill="#2b3442">12</text></svg>',
  adali: '<svg viewBox="0 0 20 20"><path d="M3 15l10-10" stroke="#2b3442" stroke-width="1"/><path d="M6 17l10-10" stroke="#1f5fbf" stroke-width="1.2"/><path d="M3 15l3 2M13 5l3 2" stroke="#9aa5b3" stroke-width=".8"/></svg>',
  adang: '<svg viewBox="0 0 20 20"><path d="M3 17h14M3 17l9-12" stroke="#2b3442" stroke-width="1.1"/><path d="M12 17a9 9 0 0 0-3.5-7" fill="none" stroke="#1f5fbf" stroke-width="1.2"/></svg>',
  adrad: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#2b3442" stroke-width="1.1"/><path d="M10 10l5-5" stroke="#1f5fbf" stroke-width="1.2"/><circle cx="10" cy="10" r=".9" fill="#1f5fbf"/></svg>',
  addia: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#2b3442" stroke-width="1.1"/><path d="M5 15l10-10" stroke="#1f5fbf" stroke-width="1.2"/></svg>',
  adstyle: '<svg viewBox="0 0 20 20"><path d="M3 14h14" stroke="#1f5fbf" stroke-width="1.2"/><path d="M3 10v6M17 10v6" stroke="#2b3442"/><path d="M2 15l2-2M16 15l2-2" stroke="#1f5fbf"/><path d="M5 3h10v5H5z" fill="#eef3fb" stroke="#2b3442" stroke-width=".8"/></svg>',
  adarrow: '<svg viewBox="0 0 20 20"><path d="M2 7h7M11 13h7" stroke="#2b3442" stroke-width="1.1"/><path d="M2 7l3-1.5v3z" fill="#1f5fbf"/><path d="M17 12l2 2M10 12l2 2" stroke="#1f5fbf" stroke-width="1.3"/></svg>',
  aleader: '<svg viewBox="0 0 20 20"><path d="M3 16l7-7h7" fill="none" stroke="#2b3442" stroke-width="1.2"/><path d="M3 16l1-3.5 2.5 2.5z" fill="#2b3442"/><path d="M11 6h6" stroke="#1f5fbf" stroke-width="1.2"/></svg>',
  ahatch: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" fill="none" stroke="#2b3442" stroke-width="1.2"/><path d="M3 9l6-6M3 15l12-12M7 17l10-10M13 17l4-4" stroke="#1f5fbf" stroke-width=".9"/></svg>',
  ahset: '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="9" height="9" fill="none" stroke="#2b3442"/><path d="M2 7l5-5M5 11l6-6" stroke="#1f5fbf" stroke-width=".8"/><circle cx="14.5" cy="14.5" r="3.5" fill="none" stroke="#2b3442" stroke-width="1.2"/><circle cx="14.5" cy="14.5" r="1" fill="#2b3442"/></svg>',
  ablock: '<svg viewBox="0 0 20 20"><rect x="2" y="5" width="9" height="11" fill="#eef3fb" stroke="#2b3442"/><rect x="9" y="3" width="9" height="7" rx="1.5" fill="#dce8fb" stroke="#1f5fbf"/><circle cx="6" cy="10" r="2" fill="none" stroke="#2b3442"/></svg>',
  ainsert: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="10" height="8" rx="1.5" fill="#dce8fb" stroke="#1f5fbf"/><path d="M14 10v7M10.5 13.5h7" stroke="#1e7a3c" stroke-width="1.8"/><path d="M5 6h6" stroke="#2b3442"/></svg>',
  xdxfin: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.1"/><text x="10" y="9" font-size="4.6" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#b3261e">DXF</text><path d="M10 11v6M7 14l3 3 3-3" fill="none" stroke="#1e7a3c" stroke-width="1.5"/></svg>',
  xdxfout: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.1"/><text x="10" y="9" font-size="4.6" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#b3261e">DXF</text><path d="M10 17v-6M7 14l3-3 3 3" fill="none" stroke="#1f5fbf" stroke-width="1.5"/></svg>',
  xsvg: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.1"/><text x="10" y="12" font-size="4.6" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#c06000">SVG</text></svg>',
  xpng: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.1"/><path d="M5 15l3-4 2 2 3-4 2 6z" fill="#7fb3e6"/><circle cx="7" cy="6" r="1.4" fill="#f5c542"/></svg>',
  cl: '<svg viewBox="0 0 20 20"><path d="M10 2v16" stroke="#2b3442" stroke-width="1.4"/><text x="12" y="8" font-size="6" font-family="Arial" fill="#2b3442">13</text><text x="12" y="16" font-size="6" font-family="Arial" fill="#2b3442">14</text></svg>',
};

// command registry: id -> [label, icon, action, active?]
const CMDS = {
  importDXF: ['Import DXF', 'xdxfin', 'importDXF'], exportDXF: ['Export DXF', 'xdxfout', 'exportDXF'], exportSVG: ['SVG', 'xsvg', 'exportSVG'], exportPNG: ['PNG', 'xpng', 'exportPNG'],
  dDimLin: ['Linear', 'adlin', 'dDimLin', () => mode === 'd:dimlin'], dDimAli: ['Aligned', 'adali', 'dDimAli', () => mode === 'd:dimali'], dDimAng: ['Angular', 'adang', 'dDimAng', () => mode === 'd:dimang'],
  dDimRad: ['Radius', 'adrad', 'dDimRad', () => mode === 'd:dimrad'], dDimDia: ['Diameter', 'addia', 'dDimDia', () => mode === 'd:dimdia'], dimStyleDlg: ['Dim styles', 'adstyle', 'dimStyleDlg'],
  toggleDimArrows: ['Ticks / arrows', 'adarrow', 'toggleDimArrows', () => isFloor(page()) && curDimStyle().arrow === 'arrow'], dLeader: ['Leader', 'aleader', 'dLeader', () => mode === 'd:leader'],
  dHatch: ['Hatch', 'ahatch', 'dHatch', () => mode === 'd:hatch'], hatchSettingsDlg: ['Hatch settings', 'ahset', 'hatchSettingsDlg'], insertDlg: ['Insert block', 'ainsert', 'insertDlg', () => mode === 'd:insert'], dBlock: ['Create block', 'ablock', 'dBlock', () => mode === 'd:block'],
  newViewSheet: ['View sheet', 'vsheet', 'newViewSheet'], addView: ['Add view', 'vadd', 'addView', () => mode === 'vpadd'],
  dWall: ['Wall', 'wwall', 'dWall', () => mode === 'd:wall'], wallSettingsDlg: ['Wall settings', 'wset', 'wallSettingsDlg'],
  dDoor: ['Door', 'wdoor', 'dDoor', () => mode === 'd:door:single' || mode === 'd:door'], dDoorDouble: ['Double door', 'wdouble', 'dDoorDouble', () => mode === 'd:door:double'], dDoorPocket: ['Pocket door', 'wpocket', 'dDoorPocket', () => mode === 'd:door:pocket'],
  dDoorBifold: ['Bifold door', 'wbifold', 'dDoorBifold', () => mode === 'd:door:bifold'], dDoorSliding: ['Sliding door', 'wslide', 'dDoorSliding', () => mode === 'd:door:sliding'], dDoorGarage: ['Garage door', 'wgarage', 'dDoorGarage', () => mode === 'd:door:garage'],
  dWindow: ['Window', 'wwindow', 'dWindow', () => mode === 'd:window'], dOpening: ['Opening', 'wopen', 'dOpening', () => mode === 'd:opening'], dRoomPick: ['Room from walls', 'wroom', 'dRoomPick', () => mode === 'd:roompick'],
  eMove: ['Move', 'emove', 'eMove', () => mode === 'd:move'], eCopy: ['Copy', 'ecopy', 'eCopy', () => mode === 'd:copy'], eRotate: ['Rotate', 'erotate', 'eRotate', () => mode === 'd:rotate'],
  eScale: ['Scale', 'escale', 'eScale', () => mode === 'd:scale'], eMirror: ['Mirror', 'emirror', 'eMirror', () => mode === 'd:mirror'], eOffset: ['Offset', 'eoffset', 'eOffset', () => mode === 'd:offset'],
  eTrim: ['Trim', 'etrim', 'eTrim', () => mode === 'd:trim'], eExtend: ['Extend', 'eextend', 'eExtend', () => mode === 'd:extend'], eFillet: ['Fillet', 'efillet', 'eFillet', () => mode === 'd:fillet'],
  eChamfer: ['Chamfer', 'echamfer', 'eChamfer', () => mode === 'd:chamfer'], eBreak: ['Break', 'ebreak', 'eBreak', () => mode === 'd:break'], eBreakAt: ['Break at point', 'ebreak', 'eBreakAt', () => mode === 'd:breakat'],
  eJoin: ['Join', 'ejoin', 'eJoin'], eExplode: ['Explode', 'eexplode', 'eExplode'], eArrayRect: ['Array', 'earect', 'eArrayRect', () => mode === 'd:arrayrect'],
  eArrayPolar: ['Polar array', 'eapolar', 'eArrayPolar', () => mode === 'd:arraypolar'], eArrayPath: ['Path array', 'eapath', 'eArrayPath', () => mode === 'd:arraypath'],
  eFront: ['Bring to front', 'efront', 'eFront'], eBack: ['Send to back', 'eback', 'eBack'],
  dLine: ['Line', 'gline', 'dLine', () => mode === 'd:line'], dPline: ['Polyline', 'gpoly', 'dPline', () => mode === 'd:pline'], dArc: ['Arc', 'darc', 'dArc', () => mode === 'd:arc'],
  dCircle: ['Circle', 'gcircle', 'dCircle', () => mode === 'd:circle'], dCircle2p: ['Circle 2 pt', 'dcircle2', 'dCircle2p', () => mode === 'd:circle:2p'], dCircle3p: ['Circle 3 pt', 'dcircle3', 'dCircle3p', () => mode === 'd:circle:3p'],
  dEllipse: ['Ellipse', 'dellipse', 'dEllipse', () => mode === 'd:ellipse'], dPolygon: ['Polygon', 'dpolygon', 'dPolygon', () => mode === 'd:polygon'], dRect: ['Rectangle', 'drect', 'dRect', () => mode === 'd:rect'],
  dSpline: ['Spline', 'dspline', 'dSpline', () => mode === 'd:spline'], dText: ['Text', 'dtext', 'dText', () => mode === 'd:text'], shapeToRoom: ['Make room', 'dmkroom', 'shapeToRoom'],
  toggleOsnap: ['Object snap', 'osnap', 'toggleOsnap', () => osnapMaster()], toggleOrtho: ['Ortho', 'ortho', 'toggleOrtho', () => PREFS.ortho], togglePolar: ['Polar', 'polar', 'togglePolar', () => PREFS.polar],
  osnapDlg: ['Snap settings', 'settings', 'osnapDlg'], toggleCmdline: ['Command line', 'cmdline', 'toggleCmdline', () => PREFS.cmdline], scaleDlg: ['Drawing scale', 'scale', 'scaleDlg'],
  fileNew: ['New', 'newp', 'fileNew'], openFile: ['Open', 'open', 'openFile'], save: ['Save', 'save', 'save'],
  paste: ['Paste', 'paste', 'paste'], cut: ['Cut', 'cut', 'cut'], copySel: ['Copy', 'copy', 'copySel'],
  undo: ['Undo', 'undo', 'undo'], redo: ['Redo', 'redo', 'redo'],
  selectMode: ['Select', 'select', 'selectMode', () => mode === 'select'], wireMode: ['Connection', 'wire', 'wireMode', () => mode === 'wire'], textMode: ['Text', 'text', 'textMode', () => mode === 'text'],
  rotateSel: ['Rotate', 'rotate', 'rotateSel'], mirrorSel: ['Mirror', 'mirror', 'mirrorSel'], delSel: ['Delete', 'del', 'delSel'],
  toggleSnap: ['Snap', 'snap', 'toggleSnap', () => PREFS.snap], toggleGrid: ['Grid', 'grid', 'toggleGrid', () => opts.grid], toggleCl: ['Point labels', 'cl', 'toggleCl', () => S().connLabels],
  checkProject: ['Check', 'check', 'checkProject'],
  zoomFit: ['Fit page', 'fit', 'zoomFit'], zoomWindow: ['Zoom window', 'zwin', 'zoomWindow', () => mode === 'zoomwin'], zoomPrev: ['Previous view', 'zprev', 'zoomPrev'], layersDlg: ['Layers', 'layers', 'layersDlg'], zoomIn: ['Zoom in', 'zin', 'zoomIn'], zoomOut: ['Zoom out', 'zout', 'zoomOut'],
  prevPage: ['Previous', 'prev', 'prevPage'], nextPage: ['Next', 'next', 'nextPage'],
  addPage: ['New page', 'page', 'addPage'], addFloorPage: ['Floor plan page', 'fpage', 'addFloorPage'], pageProps: ['Page props', 'props', 'pageProps'], dupPage: ['Duplicate', 'dup', 'dupPage'], delPage: ['Delete page', 'del', 'delPage'],
  renumberDlg: ['Renumber', 'num', 'renumberDlg'], wireDlg: ['Wire numbers', 'num', 'wireDlg'], lockWires: ['Lock wires', 'lock', 'lockWires'],
  goPanel: ['Panel schedule', 'report', 'goPanel'], goBOM: ['BOM', 'report', 'goBOM'], goTerms: ['Terminals', 'report', 'goTerms'], partsDlg: ['Parts', 'parts', 'partsDlg'], toggleAutoConnect: ['Auto connect', 'autoconn', 'toggleAutoConnect', () => PREFS.autoConnect], alignToGrid: ['Align to grid', 'align', 'alignToGrid'], newLayoutPage: ['Panel layout', 'layout', 'newLayoutPage'], findDlg: ['Find', 'find', 'findDlg'], terminalEditor: ['Terminal strip', 'tstrip', 'terminalEditor'], exportDevicesXlsx: ['Excel export', 'xlsx', 'exportDevicesXlsx'], importDevicesXlsx: ['Excel import', 'xlsxin', 'importDevicesXlsx'], exportBOMXlsx: ['BOM Excel', 'xlsx', 'exportBOMXlsx'], gLine: ['Line', 'gline', 'gLine', () => mode === 'g:line'], gPoly: ['Polyline', 'gpoly', 'gPoly', () => mode === 'g:poly'], gRect: ['Rectangle', 'grect', 'gRect', () => mode === 'g:rect'], gCircle: ['Circle', 'gcircle', 'gCircle', () => mode === 'g:circle'], gDim: ['Dimension', 'gdim', 'gDim', () => mode === 'g:dim'], gfxImage: ['Image', 'image', 'gfxImage'], panelDirectoryDlg: ['Breaker labels', 'label', 'panelDirectoryDlg'], loadDefaultsDlg: ['Load defaults', 'load', 'loadDefaultsDlg'],
  exportPanel: ['Panel CSV', 'csv', 'exportPanel'], exportBOM: ['BOM CSV', 'csv', 'exportBOM'], exportTerminals: ['Terminals CSV', 'csv', 'exportTerminals'],
  settingsDlg: ['Settings', 'settings', 'settingsDlg'], customizeRibbon: ['Customize', 'ribbon', 'customizeRibbon'],
  symbolLibrary: ['Symbol library', 'library', 'symbolLibrary'], newSymbol: ['New symbol', 'newsym', 'newSymbol'],
  cableMode: ['Cable', 'cable', 'cableMode', () => mode === 'cable'], insertMacroDlg: ['Insert macro', 'macro', 'insertMacroDlg', () => mode === 'macro'], saveMacro: ['Save macro', 'macrosave', 'saveMacro'],
  goToc: ['Contents', 'report', 'goToc'], goConn: ['Connection list', 'report', 'goConn'], goCables: ['Cables', 'report', 'goCables'],
  addTodoForSelection: ['Add to-do', 'todo', 'addTodoForSelection'], showTodo: ['To-do list', 'todolist', 'showTodo'],
  revisionsDlg: ['Revisions', 'rev', 'revisionsDlg'], exportPDF: ['PDF', 'pdf', 'exportPDF'],
  toggleTheme: ['Dark theme', 'theme', 'toggleTheme', () => document.documentElement.dataset.theme === 'dark'], toggleSheet: ['Dark sheet', 'sheetd', 'toggleSheet', () => PREFS.sheet === 'dark'],
  roomMode: ['Room', 'room', 'roomMode', () => mode === 'room'], roomPolyMode: ['Room shape', 'roompoly', 'roomPolyMode', () => mode === 'roompoly'], roomOvalMode: ['Oval room', 'roomoval', 'roomOvalMode', () => mode === 'roomoval'], roomCircMode: ['Round room', 'roomcirc', 'roomCircMode', () => mode === 'roomcirc'], importImage: ['Image', 'image', 'importImage'],
};
const DEFAULT_RIBBON = [
  { id: 'home', name: 'Home', groups: [
    { name: 'Clipboard', items: ['paste', 'cut', 'copySel'] },
    { name: 'History', items: ['undo', 'redo'] },
    { name: 'Tools', items: ['selectMode', 'wireMode', 'textMode'] },
    { name: 'Modify', items: ['rotateSel', 'mirrorSel', 'delSel', 'findDlg'] },
    { name: 'Snap', items: ['toggleSnap', 'alignToGrid', 'toggleGrid', 'toggleAutoConnect'] },
    { name: 'Macros', items: ['insertMacroDlg', 'saveMacro'] },
    { name: 'To-do', items: ['addTodoForSelection', 'showTodo'] },
    { name: 'Project', items: ['checkProject', 'revisionsDlg'] },
  ] },
  { id: 'insert', name: 'Insert', groups: [
    { name: 'Coils and contacts', items: ['sym:coil', 'sym:no', 'sym:nc', 'sym:mc3'] },
    { name: 'Command and protection', items: ['sym:pbno', 'sym:pbnc', 'sym:estop', 'sym:cb3', 'sym:fuse', 'sym:ol3'] },
    { name: 'Loads', items: ['sym:motor', 'sym:lamp', 'sym:ps'] },
    { name: 'Connections', items: ['wireMode', 'cableMode', 'sym:term', 'sym:ip', 'sym:pe'] },
    { name: 'Boxes and PLC', items: ['sym:bbox', 'sym:dbox', 'sym:plccard', 'sym:plcin', 'sym:plcout'] },
    { name: 'Graphics', items: ['gLine', 'gPoly', 'gRect', 'gCircle', 'gDim', 'gfxImage', 'textMode'] },
    { name: 'Home', items: ['sym:rbrk1', 'sym:rbrkgf', 'sym:rswt', 'sym:rsw3', 'sym:rdim', 'sym:rout', 'sym:routgf', 'sym:rlgt', 'sym:rfan', 'sym:rsmk', 'sym:rjbx', 'sym:rnbar'] },
  ] },
  { id: 'floor', name: 'Floor plan', contextual: true, groups: [
    { name: 'Walls', items: ['selectMode', 'dWall', 'wallSettingsDlg', 'dDoor', 'dDoorDouble', 'dDoorPocket', 'dDoorBifold', 'dDoorSliding', 'dDoorGarage', 'dWindow', 'dOpening'] },
    { name: 'Rooms', items: ['dRoomPick', 'roomMode', 'roomPolyMode', 'roomCircMode', 'roomOvalMode', 'importImage'] },
    { name: 'Draw', items: ['dLine', 'dPline', 'dArc', 'dCircle', 'dCircle2p', 'dCircle3p', 'dEllipse', 'dPolygon', 'dRect', 'dSpline', 'dText', 'shapeToRoom'] },
    { name: 'Outlets', items: ['sym:rout', 'sym:routgf', 'sym:routsw', 'sym:rout240'] },
    { name: 'Lights and switches', items: ['sym:rlgt', 'sym:rfan', 'sym:rswt', 'sym:rsw3', 'sym:rsw4', 'sym:rdim'] },
    { name: 'Other', items: ['sym:rsmk', 'sym:rjbx', 'sym:rapp', 'sym:rpnl'] },
    { name: 'Modify', items: ['rotateSel', 'delSel', 'toggleSnap', 'alignToGrid'] },
    { name: 'Sheets', items: ['newViewSheet', 'addView'] },
    { name: 'Exchange', items: ['importDXF', 'exportDXF', 'exportSVG', 'exportPNG'] },
    { name: 'Precision', items: ['toggleOsnap', 'toggleOrtho', 'togglePolar', 'osnapDlg', 'scaleDlg', 'toggleCmdline'] },
  ] },
  { id: 'fmodify', name: 'Modify', contextual: true, groups: [
    { name: 'Move and copy', items: ['selectMode', 'eMove', 'eCopy', 'eRotate', 'eScale', 'eMirror'] },
    { name: 'Edit', items: ['eOffset', 'eTrim', 'eExtend', 'eFillet', 'eChamfer', 'eBreak', 'eBreakAt', 'eJoin', 'eExplode', 'delSel'] },
    { name: 'Arrays', items: ['eArrayRect', 'eArrayPolar', 'eArrayPath'] },
    { name: 'Order', items: ['eFront', 'eBack'] },
    { name: 'Undo', items: ['undo', 'redo'] },
  ] },
  { id: 'fannot', name: 'Annotate', contextual: true, groups: [
    { name: 'Dimensions', items: ['dDimLin', 'dDimAli', 'dDimAng', 'dDimRad', 'dDimDia', 'dimStyleDlg', 'toggleDimArrows'] },
    { name: 'Text', items: ['dText', 'dLeader'] },
    { name: 'Hatch', items: ['dHatch', 'hatchSettingsDlg'] },
    { name: 'Blocks', items: ['insertDlg', 'dBlock'] },
  ] },
  { id: 'view', name: 'View', groups: [
    { name: 'Zoom', items: ['zoomFit', 'zoomWindow', 'zoomPrev', 'zoomIn', 'zoomOut'] },
    { name: 'Show', items: ['layersDlg', 'toggleGrid', 'toggleSnap', 'toggleCl'] },
    { name: 'Pages', items: ['prevPage', 'nextPage'] },
    { name: 'Theme', items: ['toggleTheme', 'toggleSheet'] },
    { name: 'Options', items: ['settingsDlg', 'customizeRibbon'] },
  ] },
  { id: 'project', name: 'Project', groups: [
    { name: 'Pages', items: ['addPage', 'addFloorPage', 'newLayoutPage', 'pageProps', 'dupPage', 'delPage'] },
    { name: 'Numbering', items: ['renumberDlg', 'wireDlg', 'lockWires', 'terminalEditor'] },
    { name: 'Reports', items: ['goToc', 'goPanel', 'goBOM', 'goConn', 'goCables', 'goTerms'] },
    { name: 'Revisions', items: ['revisionsDlg'] },
    { name: 'Export', items: ['exportPDF', 'exportSVG', 'exportPNG', 'exportPanel', 'exportBOM', 'exportTerminals'] },
    { name: 'Excel', items: ['exportDevicesXlsx', 'importDevicesXlsx', 'exportBOMXlsx'] },
    { name: 'Symbols and parts', items: ['symbolLibrary', 'newSymbol', 'partsDlg'] },
    { name: 'Home', items: ['loadDefaultsDlg', 'panelDirectoryDlg'] },
  ] },
];
let ribbonTab = 'home', lastPageKind = null;
function ribbonDef() {
  if (!PREFS.ribbon) return DEFAULT_RIBBON;
  const have = new Set(PREFS.ribbon.map(t => t.id)); const add = DEFAULT_RIBBON.filter(t => t.contextual && !have.has(t.id));
  return add.length ? PREFS.ribbon.concat(add) : PREFS.ribbon;
}
function cmdInfo(id) {
  if (id.startsWith('sym:')) {
    const k = id.slice(4); const d = SYM[k]; if (!d) return null;
    return { label: d.name, sym: k };
  }
  const c = CMDS[id]; if (!c) return null;
  return { label: c[0], icon: RI[c[1]] || '', act: c[2], on: c[3] };
}
function renderToolbar() {
  const el = $('#toolbar'); if (!P) return;
  const fp = isFloor(page()); const kind = fp ? 'floor' : 'sch';
  const def = ribbonDef();
  if (kind !== lastPageKind) {
    if (fp && def.some(t => t.id === 'floor')) ribbonTab = 'floor';
    else if (!fp && ribbonTab === 'floor') ribbonTab = 'home';
    lastPageKind = kind;
  }
  const tabs = def.filter(t => !t.contextual || fp);
  if (!tabs.some(t => t.id === ribbonTab)) ribbonTab = (tabs[0] || {}).id;
  const tab = tabs.find(t => t.id === ribbonTab);
  let s = '<div class="rtabs">' + tabs.map(t => `<div class="rtab${t.id === ribbonTab ? ' active' : ''}${t.contextual ? ' ctx' : ''}" data-rtab="${esc(t.id)}">${esc(t.name)}</div>`).join('') + (typeof workspaceSelectHTML === 'function' ? workspaceSelectHTML() : '') + '</div><div class="rpanel">';
  for (const g of (tab ? tab.groups : [])) {
    const items = g.items.map(id => {
      const ci = cmdInfo(id); if (!ci) return '';
      if (ci.sym) {
        const d = SYM[ci.sym];
        if (!fp && d.ind && !S().industrial && tab.id !== 'floor') return '';
        const on = (mode === 'place' || mode === 'fpplace') && placeSym === ci.sym;
        const icon = fp ? (d.fp ? fpIcon(ci.sym) : '') : symPreview(ci.sym).replace('<svg ', '<svg style="width:22px;height:22px" ');
        if (!icon) return '';
        return `<button class="rb${on ? ' on' : ''}" data-place="${ci.sym}" title="${esc(d.name)}">${icon.replace('width:20px;height:20px', 'width:22px;height:22px')}<span>${esc(d.name)}</span></button>`;
      }
      const on = ci.on && ci.on();
      return `<button class="rb${on ? ' on' : ''}" data-act="${ci.act}" title="${esc(ci.label)}">${ci.icon}<span>${esc(ci.label)}</span></button>`;
    }).join('');
    if (items) s += `<div class="rgroup"><div class="ritems">${items}</div><div class="rgname">${esc(g.name)}</div></div>`;
  }
  el.innerHTML = s + '</div>';
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-rtab]'); if (t) { ribbonTab = t.dataset.rtab; renderToolbar(); }
});
// right-click menu on the ribbon (more entries can be added to RIBBON_MENU later)
const RIBBON_MENU = [
  [() => S().terms === 'home' ? 'Switch to engineering view' : 'Switch to homeowner view', 'toggleViewMode'],
  [() => document.documentElement.dataset.theme === 'dark' ? 'Light theme' : 'Dark theme', 'toggleTheme'],
  [() => PREFS.sheet === 'dark' ? 'White sheet' : 'Dark sheet', 'toggleSheet'],
  '-',
  ['Customize ribbon...', 'customizeRibbon'],
];
// one-click switch between the engineering and homeowner presets (labels, tag display, report columns)
function toggleViewMode() {
  const toHome = S().terms !== 'home'; const v = toHome ? 'home' : 'eng';
  commit(() => Object.assign(S(), { terms: v, tagStyle: v, reportCols: toHome ? 'plain' : 'eng' }));
  flash(toHome ? 'Homeowner view' : 'Engineering view');
}
$('#toolbar').addEventListener('contextmenu', e => {
  e.preventDefault();
  const dd = $('#dropdown');
  dd.innerHTML = RIBBON_MENU.map(m => m === '-' ? '<div class="ddsep"></div>' : `<div class="dd" data-act="${m[1]}"><span>${typeof m[0] === 'function' ? m[0]() : m[0]}</span></div>`).join('');
  dd.style.left = e.clientX + 'px'; dd.style.top = e.clientY + 'px'; dd.classList.remove('hidden');
});

// ---------- customize ribbon ----------
function customizeRibbon() {
  let W = clone(ribbonDef()); let ti = 0, gi = 0, ii = -1, q = '';
  const allCmds = () => Object.keys(CMDS).map(id => [id, CMDS[id][0]]).concat(Object.keys(SYM).map(k => ['sym:' + k, 'Symbol: ' + SYM[k].name]));
  const draw = () => {
    const t = W[ti] || { groups: [] }; const g = t.groups[gi] || { items: [] };
    const list = (rows, cur, kind) => `<div class="cz-list">${rows.map((r, i) => `<div class="cz-row${i === cur ? ' on' : ''}" data-cz="${kind}" data-i="${i}">${esc(r)}</div>`).join('') || '<div class="note" style="padding:6px">(empty)</div>'}</div>`;
    const btns = kind => `<div class="cz-btns"><button type="button" class="btn small" data-czb="${kind}:add">Add</button><button type="button" class="btn small" data-czb="${kind}:ren">Rename</button><button type="button" class="btn small" data-czb="${kind}:del">Remove</button><button type="button" class="btn small" data-czb="${kind}:up">▲</button><button type="button" class="btn small" data-czb="${kind}:dn">▼</button></div>`;
    const avail = allCmds().filter(([id, l]) => !q || (l + ' ' + id).toLowerCase().includes(q.toLowerCase()));
    $('#dlgbody').innerHTML = `<div class="cz">
      <div><h4>Tabs</h4>${list(W.map(x => x.name + (x.contextual ? ' (floor plans)' : '')), ti, 't')}${btns('t')}</div>
      <div><h4>Groups in ${esc(t.name || '')}</h4>${list(t.groups.map(x => x.name), gi, 'g')}${btns('g')}</div>
      <div><h4>Buttons in ${esc(g.name || '')}</h4>${list(g.items.map(id => (cmdInfo(id) || { label: id }).label), ii, 'i')}<div class="cz-btns"><button type="button" class="btn small" data-czb="i:del">Remove</button><button type="button" class="btn small" data-czb="i:up">▲</button><button type="button" class="btn small" data-czb="i:dn">▼</button></div></div>
      <div><h4>Available commands</h4><input class="search" id="czq" placeholder="Search commands and symbols" value="${esc(q)}" style="margin:0 0 6px;width:100%"><div class="cz-list">${avail.map(([id, l]) => `<div class="cz-row" data-czadd="${esc(id)}" title="Add to the selected group">${esc(l)}</div>`).join('')}</div><div class="note">Click a command to add it to the selected group.</div></div>
    </div><div class="btnrow"><button type="button" class="btn small" data-czb="x:reset">Reset to default</button></div>`;
    const qi = $('#czq'); qi.oninput = () => { q = qi.value; draw(); const n = $('#czq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  };
  dialog('Customize ribbon', [], () => { PREFS.ribbon = W; savePrefs(); renderToolbar(); }, 'Save');
  $('#dlg').style.width = '980px'; $('#dlg').style.maxWidth = '96vw';
  draw();
  $('#dlgbody').onclick = e => {
    const r = e.target.closest('[data-cz]');
    if (r) { const i = +r.dataset.i; if (r.dataset.cz === 't') { ti = i; gi = 0; ii = -1; } else if (r.dataset.cz === 'g') { gi = i; ii = -1; } else ii = i; draw(); return; }
    const a = e.target.closest('[data-czadd]');
    if (a) { const g = (W[ti] || {}).groups && W[ti].groups[gi]; if (!g) { alert('Select or add a group first.'); return; } g.items.push(a.dataset.czadd); ii = g.items.length - 1; draw(); return; }
    const b = e.target.closest('[data-czb]'); if (!b) return;
    const [kind, op] = b.dataset.czb.split(':');
    if (kind === 'x') { if (confirm('Reset the ribbon to the default layout?')) { W = clone(DEFAULT_RIBBON); ti = 0; gi = 0; ii = -1; draw(); } return; }
    const t = W[ti];
    const arr = kind === 't' ? W : kind === 'g' ? (t && t.groups) : (t && t.groups[gi] && t.groups[gi].items);
    let idx = kind === 't' ? ti : kind === 'g' ? gi : ii;
    if (!arr) return;
    if (op === 'add') {
      const name = prompt(kind === 't' ? 'Tab name:' : 'Group name:', kind === 't' ? 'My tab' : 'My group'); if (!name) return;
      if (kind === 't') { W.push({ id: 'u' + uid(), name, groups: [] }); ti = W.length - 1; gi = 0; }
      else { t.groups.push({ name, items: [] }); gi = t.groups.length - 1; }
    } else if (op === 'ren' && arr[idx]) { const n = prompt('New name:', arr[idx].name); if (n) arr[idx].name = n; }
    else if (op === 'del' && arr[idx] != null) { arr.splice(idx, 1); if (kind === 't') ti = Math.max(0, ti - 1); else if (kind === 'g') gi = Math.max(0, gi - 1); else ii = -1; }
    else if ((op === 'up' || op === 'dn') && arr[idx] != null) {
      const j = idx + (op === 'up' ? -1 : 1); if (j < 0 || j >= arr.length) return;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      if (kind === 't') ti = j; else if (kind === 'g') gi = j; else ii = j;
    }
    draw();
  };
}

// ---------- preferences in the portable data folder ----------
async function loadPrefs() {
  try { const t = await host.readData('prefs.json'); if (t) Object.assign(PREFS, JSON.parse(t)); } catch (e) {}
}
function savePrefs() { host.writeData('prefs.json', JSON.stringify(PREFS)); }
function toggleSnap() { PREFS.snap = !PREFS.snap; savePrefs(); renderToolbar(); renderStatus(); flash('Snap to grid ' + (PREFS.snap ? 'on' : 'off')); }
