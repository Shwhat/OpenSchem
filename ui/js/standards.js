// ---------- symbol standards: IEC 60617 and NFPA 79 ----------
// Every project has one standard (P.std, chosen when the project is created and fixed after that). It sets the default
// palette and the device letters. Symbols carry std ('IEC' | 'NFPA'), their counterpart in the other standard (pair)
// and both letters (ip: IEC, np: NFPA); prefix returns the letter of the project's standard, so a symbol of either
// standard can be placed in any project. Shared symbols (terminals, boxes, PLC, home and pneumatic) have no std.
// Single-line symbols (role 'sl') are another view of a device: with the same tag as the multi-line symbol they are
// one device, cross-referenced to each other and counted once in the bill of materials.
const STD_NAMES = { IEC: 'IEC 60617', NFPA: 'NFPA 79' };
const projStd = () => (P && P.std === 'NFPA') ? 'NFPA' : 'IEC';
const otherStd = s => (s || projStd()) === 'IEC' ? 'NFPA' : 'IEC';
const isNFPA = () => projStd() === 'NFPA';

// ---------- drawing pieces ----------
// IEC: blade contacts (noC, ncC and cbX come from core.js), actuators on a dashed line to the left
const actNO = '<path d="M-1.8,-0.2H-7" stroke-dasharray="1,0.8"/>', actNC = '<path d="M1.6,-0.4H-7" stroke-dasharray="1,0.8"/>';
const IACT = {
  turn: '<path d="M-7,-2.2H-8.4V2.2H-9.8"/>',
  limit: '<path d="M-7,-2.2L-9.6,0L-7,2.2"/>',
  prox: '<path d="M-7,0L-9,-2L-11,0L-9,2Z M-10,0H-8"/>',
  press: '<rect x="-11" y="-2" width="4" height="4"/>',
  temp: '<rect x="-11" y="-2" width="4" height="4"/>',
  level: '<path d="M-7,0H-8.4"/><circle cx="-10" cy="0" r="1.6"/><path d="M-12,2.6H-8"/>',
  flow: '<rect x="-11" y="-2" width="4" height="4"/><path d="M-10.4,0.9H-7.8M-8.8,0.1L-7.8,0.9L-8.8,1.7"/>',
};
const ITXT = { press: [[-9, 0.85, 'p', 2.4]], temp: [[-9, 0.85, 'θ', 2.4]] };
// parachute (delay) on the blade: on-delay bulges away from the movement, off-delay toward it
const delay = on => `<path d="M-1.4,-1H-4.6M-2,0.6H-4.6M-4.6,-2.2A2.2,2.2 0 0 ${on ? 0 : 1} -4.6,2.2"/>`;
const gang = (x0, x1, y = -0.25) => `<path d="M${x0},${y}H${x1}" stroke-dasharray="1,0.8"/>`;
const slash3 = '<path d="M-1.4,-5.2L1.4,-6.4M-1.4,-6.4L1.4,-7.6M-1.4,-4L1.4,-5.2" stroke-width="0.25"/>';
// IEC transformer windings (form 2): loops between the leads, a two-line core between primary and secondary
const loops = (x0, y, n, up) => { let s = `M${x0},${y}`; for (let i = 0; i < n; i++) s += `a1,1 0 0 ${up ? 1 : 0} 2,0`; return s; };
// NFPA: parallel-line contacts with a slash for NC, terminal circles for pushbuttons, arcs for breakers
const nNO = x => `M${x},-8V-1.6M${x},8V1.6M${x - 2.5},-1.6H${x + 2.5}M${x - 2.5},1.6H${x + 2.5}`;
const nNC = x => nNO(x) + `M${x - 3},3.2L${x + 3},-3.2`;
const nTerm = '<circle cx="0" cy="-3" r="0.8"/><circle cx="0" cy="3" r="0.8"/><path d="M0,-8V-3.8M0,8V3.8"/>';
const nCB = x => `M${x},-8V-3.8M${x},8V3.8M${x},-3A3.4,3.4 0 0 0 ${x},3`;
const nCBt = x => `<circle cx="${x}" cy="-3" r="0.8"/><circle cx="${x}" cy="3" r="0.8"/>`;
const nCurl = x => `M${x},-8V-2.6C${x + 3.2},-2.6 ${x + 3.2},2.6 ${x},2.6V8`;
const nDelay = on => `<path d="M-2.5,0H-4.4M-4.4,-1.8A1.8,1.8 0 0 ${on ? 0 : 1} -4.4,1.8"/>`;
// NFPA limit-switch style blade with a wedge, used by limit, pressure, temperature, level and flow switches
const nBladeNO = 'M0,-8V-3.2M0,8V3L-3.6,-2.8', nBladeNC = 'M0,-8V-3.2H2.8M0,8V3L3.4,-3.8';

// ---------- the symbols ----------
const ISYM = (o) => Object.assign({ std: 'IEC', ind: true }, o);
const NSYM = (o) => Object.assign({ std: 'NFPA', ind: true }, o);
Object.assign(SYM, {
  // ----- IEC 60617 additions -----
  tdon: ISYM({ name: 'Timer coil, on-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'main', mirror: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-11, -8, 5, 8],
    draw: () => '<path d="M0,-8V-3M0,3V8"/><rect x="-5" y="-3" width="10" height="6"/><rect x="-11" y="-3" width="6" height="6"/><path d="M-11,-3L-5,3M-5,-3L-11,3"/>' }),
  tdoff: ISYM({ name: 'Timer coil, off-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'main', mirror: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-11, -8, 5, 8],
    draw: () => '<path d="M0,-8V-3M0,3V8"/><rect x="-5" y="-3" width="10" height="6"/><rect x="-11" y="-3" width="6" height="6" fill="#000"/>' }),
  co: ISYM({ name: 'Changeover contact', cat: 'Coils and contacts', ip: 'K', np: 'CR', role: 'aux', contact: 'CO',
    conns: [[0, 8, '11'], [4, -8, '12'], [-4, -8, '14']], box: [-6, -8, 6, 8],
    draw: () => '<path d="M0,8V3L3.2,-3.8M4,-8V-3H2.2M-4,-8V-3"/>' }),
  tno_on: ISYM({ name: 'NO contact, on-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NO',
    conns: [[0, -8, '17'], [0, 8, '18']], box: [-7, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${delay(true)}` }),
  tnc_on: ISYM({ name: 'NC contact, on-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NC',
    conns: [[0, -8, '15'], [0, 8, '16']], box: [-7, -8, 4, 8], draw: () => `<path d="${ncC(0)}"/>${delay(true)}` }),
  tno_off: ISYM({ name: 'NO contact, off-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NO',
    conns: [[0, -8, '17'], [0, 8, '18']], box: [-7, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${delay(false)}` }),
  tnc_off: ISYM({ name: 'NC contact, off-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NC',
    conns: [[0, -8, '15'], [0, 8, '16']], box: [-7, -8, 4, 8], draw: () => `<path d="${ncC(0)}"/>${delay(false)}` }),
  sel: ISYM({ name: 'Selector switch', cat: 'Command devices', ip: 'S', np: 'SS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-10, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${actNO}${IACT.turn}` }),
  lsno: ISYM({ name: 'Limit switch NO', cat: 'Switches and sensors', ip: 'S', np: 'LS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-10, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${actNO}${IACT.limit}` }),
  lsnc: ISYM({ name: 'Limit switch NC', cat: 'Switches and sensors', ip: 'S', np: 'LS', role: 'main', contact: 'NC',
    conns: [[0, -8, '11'], [0, 8, '12']], box: [-10, -8, 4, 8], draw: () => `<path d="${ncC(0)}"/>${actNC}${IACT.limit}` }),
  prox: ISYM({ name: 'Proximity sensor', cat: 'Switches and sensors', ip: 'B', np: 'PRS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-11, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${actNO}${IACT.prox}` }),
  psw: ISYM({ name: 'Pressure switch', cat: 'Switches and sensors', ip: 'B', np: 'PS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-11, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${actNO}${IACT.press}`, texts: () => ITXT.press }),
  tsw: ISYM({ name: 'Temperature switch', cat: 'Switches and sensors', ip: 'B', np: 'TAS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-11, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${actNO}${IACT.temp}`, texts: () => ITXT.temp }),
  lvl: ISYM({ name: 'Level switch', cat: 'Switches and sensors', ip: 'B', np: 'FS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-12, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${actNO}${IACT.level}` }),
  flow: ISYM({ name: 'Flow switch', cat: 'Switches and sensors', ip: 'B', np: 'FLS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-11, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>${actNO}${IACT.flow}` }),
  cb2: ISYM({ name: 'Circuit breaker 2P', cat: 'Protection', ip: 'Q', np: 'CB', role: 'main', fixed: true,
    conns: [[-4, -8, '1'], [-4, 8, '2'], [4, -8, '3'], [4, 8, '4']], box: [-8, -8, 6, 8],
    draw: () => `<path d="${noC(-4)}${noC(4)}${cbX(-4)}${cbX(4)}"/>${gang(-5.75, 2.25)}` }),
  mpcb: ISYM({ name: 'Motor protective breaker', cat: 'Protection', ip: 'Q', np: 'MCP', role: 'main', fixed: true,
    conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-19, -8, 10, 8],
    draw: () => `<path d="${noC(-8)}${noC(0)}${noC(8)}${cbX(-8)}${cbX(0)}${cbX(8)}"/>${gang(-18, 6.25)}<path d="M-13,-2.4V-0.8H-14.6V0.8H-13V2.4"/><rect x="-18.6" y="-1.8" width="3" height="3.2"/>` }),
  disc3: ISYM({ name: 'Disconnect switch 3P', cat: 'Protection', ip: 'Q', np: 'DISC', role: 'main', fixed: true,
    conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-14, -8, 10, 8],
    draw: () => `<path d="${noC(-8)}${noC(0)}${noC(8)}M-9.4,-3H-6.6M-1.4,-3H1.4M6.6,-3H9.4M-13,-2.4V2"/>${gang(-13, 6.25)}` }),
  xfmr: ISYM({ name: 'Control transformer', cat: 'Loads and sources', ip: 'T', np: 'T', role: 'main', fixed: true,
    conns: [[-4, -12, '1U1'], [4, -12, '1U2'], [-4, 12, '2U1'], [4, 12, '2U2']], box: [-6, -12, 6, 12],
    draw: () => `<path d="M-4,-12V-4M4,-12V-4M-4,12V4M4,12V4${loops(-4, -4, 4, false)}${loops(-4, 4, 4, true)}M-5,-1H5M-5,1H5"/>` }),
  motor1: ISYM({ name: 'Motor 1~', cat: 'Loads and sources', ip: 'M', np: 'MTR', role: 'main', fixed: true,
    conns: [[-4, -12, 'U1'], [4, -12, 'U2'], [12, -12, 'PE']], box: [-9, -12, 12, 13],
    draw: () => '<path d="M-4,-12V-4.06M4,-12V-4.06M12,-12V4H9"/><circle cx="0" cy="4" r="9"/>', texts: () => [[0, 2.6, 'M', 3.4, true], [0, 7, '1~', 2.6]] }),
  motordc: ISYM({ name: 'Motor DC', cat: 'Loads and sources', ip: 'M', np: 'MTR', role: 'main', fixed: true,
    conns: [[-4, -12, 'A1'], [4, -12, 'A2']], box: [-9, -12, 9, 13],
    draw: () => '<path d="M-4,-12V-4.06M4,-12V-4.06M-2.4,7H2.4"/><circle cx="0" cy="4" r="9"/>', texts: () => [[0, 3.6, 'M', 3.4, true]] }),
  horn: ISYM({ name: 'Horn', cat: 'Loads and sources', ip: 'P', np: 'AH', role: 'main', fixed: true,
    conns: [[0, -8, 'X1'], [0, 8, 'X2']], box: [-6, -8, 2, 8],
    draw: () => '<path d="M0,-8V-2M0,2V8M-6,-4L-2,-2H2V2H-2L-6,4Z"/>' }),
  heater: ISYM({ name: 'Heater', cat: 'Loads and sources', ip: 'E', np: 'HTR', role: 'main', fixed: true,
    conns: [[0, -8, '1'], [0, 8, '2']], box: [-2.5, -8, 2.5, 8],
    draw: () => '<path d="M0,-8V-5M0,5V8M-2.5,-2.5H2.5M-2.5,0H2.5M-2.5,2.5H2.5"/><rect x="-2.5" y="-5" width="5" height="10"/>' }),
  vfd: ISYM({ name: 'Variable frequency drive', cat: 'Loads and sources', ip: 'U', np: 'VFD', role: 'main', fixed: true,
    conns: [[-8, -12, 'L1'], [0, -12, 'L2'], [8, -12, 'L3'], [-8, 12, 'U'], [0, 12, 'V'], [8, 12, 'W']], box: [-12, -12, 12, 12],
    draw: () => '<rect x="-12" y="-8" width="24" height="16"/><path d="M-8,-12V-8M0,-12V-8M8,-12V-8M-8,12V8M0,12V8M8,12V8M-12,8L12,-8"/>',
    texts: () => [[-6, -2.4, '3~', 2.6], [6, 5.4, 'f', 2.8]] }),
  solc: ISYM({ name: 'Solenoid valve coil', cat: 'Coils and contacts', ip: 'QM', np: 'SOL', role: 'aux', fixed: true, coilNo: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-5, -8, 5, 8],
    draw: () => '<path d="M0,-8V-3M0,3V8M-3.4,3L-1.4,-3"/><rect x="-5" y="-3" width="10" height="6"/>' }),
  plug: ISYM({ name: 'Plug and socket', cat: 'Connections', ip: 'X', np: 'PLG', role: 'main', fixed: true,
    conns: [[0, -8, '1'], [0, 8, '2']], box: [-3.5, -8, 3.5, 8],
    draw: () => '<path d="M0,-8V-1.6M-3,-1.6A3,3 0 0 0 3,-1.6M0,8V1.8"/><rect x="-1" y="-1.6" width="2" height="3.4" fill="#000"/>' }),
  // ----- IEC single-line -----
  sl_cb: ISYM({ name: 'Circuit breaker (single-line)', cat: 'Single-line', ip: 'Q', np: 'CB', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 2, 8], draw: () => `<path d="${noC(0)}${cbX(0)}"/>${slash3}` }),
  sl_mpcb: ISYM({ name: 'Motor protective breaker (single-line)', cat: 'Single-line', ip: 'Q', np: 'MCP', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-12, -8, 2, 8], draw: () => `<path d="${noC(0)}${cbX(0)}"/>${slash3}${gang(-11, -1.75)}<rect x="-11.6" y="-1.8" width="3" height="3.2"/>` }),
  sl_fuse: ISYM({ name: 'Fuse (single-line)', cat: 'Single-line', ip: 'F', np: 'FU', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-2, -8, 2, 8], draw: () => '<path d="M0,-8V8"/><rect x="-2" y="-5" width="4" height="10"/>' }),
  sl_disc: ISYM({ name: 'Disconnect switch (single-line)', cat: 'Single-line', ip: 'Q', np: 'DISC', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 2, 8], draw: () => `<path d="${noC(0)}M-1.4,-3H1.4"/>${slash3}` }),
  sl_k: ISYM({ name: 'Contactor (single-line)', cat: 'Single-line', ip: 'K', np: 'M', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 2, 8], draw: () => `<path d="${noC(0)}M-1.2,-3A1.2,1.2 0 0 0 1.2,-3"/>${slash3}` }),
  sl_ol: ISYM({ name: 'Overload relay (single-line)', cat: 'Single-line', ip: 'F', np: 'OL', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-3.5, -8, 3.5, 8], draw: () => '<path d="M0,-8V-3H2V0H0V8"/><rect x="-3.5" y="-4.5" width="7" height="9" stroke-width="0.25"/>' }),
  sl_motor: ISYM({ name: 'Motor (single-line)', cat: 'Single-line', ip: 'M', np: 'MTR', role: 'sl', fixed: true,
    conns: [[0, -8, '']], box: [-6, -8, 6, 8], draw: () => `<path d="M0,-8V-4"/><circle cx="0" cy="2" r="6"/>${slash3}`, texts: () => [[0, 1.6, 'M', 3, true], [0, 5.2, '3~', 2.2]] }),
  sl_xfmr: ISYM({ name: 'Transformer (single-line)', cat: 'Single-line', ip: 'T', np: 'T', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 4, 8], draw: () => '<path d="M0,-8V-6M0,6V8"/><circle cx="0" cy="-2.4" r="3.6"/><circle cx="0" cy="2.4" r="3.6"/>' }),
  sl_vfd: ISYM({ name: 'Drive (single-line)', cat: 'Single-line', ip: 'U', np: 'VFD', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 4, 8], draw: () => '<path d="M0,-8V-4M0,4V8M-4,4L4,-4"/><rect x="-4" y="-4" width="8" height="8"/>', texts: () => [[-1.8, -1.2, '~', 2], [1.8, 2.8, 'f', 2]] }),

  // ----- NFPA 79 -----
  n_coil: NSYM({ name: 'Relay coil', cat: 'Coils and contacts', ip: 'K', np: 'CR', role: 'main', mirror: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-4, -8, 4, 8], draw: () => '<path d="M0,-8V-4M0,4V8"/><circle cx="0" cy="0" r="4"/>' }),
  n_mcoil: NSYM({ name: 'Motor starter coil', cat: 'Coils and contacts', ip: 'K', np: 'M', role: 'main', mirror: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-4, -8, 4, 8], draw: () => '<path d="M0,-8V-4M0,4V8"/><circle cx="0" cy="0" r="4"/>', texts: () => [[0, 0.9, 'M', 2.6]] }),
  n_tdon: NSYM({ name: 'Timer coil, on-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'main', mirror: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-4, -8, 4, 8], draw: () => '<path d="M0,-8V-4M0,4V8"/><circle cx="0" cy="0" r="4"/>', texts: () => [[0, 0.8, 'TDE', 1.8]] }),
  n_tdoff: NSYM({ name: 'Timer coil, off-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'main', mirror: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-4, -8, 4, 8], draw: () => '<path d="M0,-8V-4M0,4V8"/><circle cx="0" cy="0" r="4"/>', texts: () => [[0, 0.8, 'TDD', 1.8]] }),
  n_no: NSYM({ name: 'NO contact', cat: 'Coils and contacts', ip: 'K', np: 'CR', role: 'aux', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-3, -8, 3, 8], draw: () => `<path d="${nNO(0)}"/>` }),
  n_nc: NSYM({ name: 'NC contact', cat: 'Coils and contacts', ip: 'K', np: 'CR', role: 'aux', contact: 'NC',
    conns: [[0, -8, '21'], [0, 8, '22']], box: [-3, -8, 3, 8], draw: () => `<path d="${nNC(0)}"/>` }),
  n_co: NSYM({ name: 'Changeover contact', cat: 'Coils and contacts', ip: 'K', np: 'CR', role: 'aux', contact: 'CO',
    conns: [[0, 8, '11'], [4, -8, '12'], [-4, -8, '14']], box: [-7, -8, 7, 8],
    draw: () => '<path d="M0,8V4.4H-4V1.6M0,4.4H4V1.6M-4,-8V-1.6M4,-8V-1.6M-6.5,-1.6H-1.5M-6.5,1.6H-1.5M1.5,-1.6H6.5M1.5,1.6H6.5M1,3.2L7,-3.2"/>' }),
  n_tno_on: NSYM({ name: 'NO contact, on-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NO',
    conns: [[0, -8, '17'], [0, 8, '18']], box: [-7, -8, 3, 8], draw: () => `<path d="${nNO(0)}"/>${nDelay(true)}` }),
  n_tnc_on: NSYM({ name: 'NC contact, on-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NC',
    conns: [[0, -8, '15'], [0, 8, '16']], box: [-7, -8, 3, 8], draw: () => `<path d="${nNC(0)}"/>${nDelay(true)}` }),
  n_tno_off: NSYM({ name: 'NO contact, off-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NO',
    conns: [[0, -8, '17'], [0, 8, '18']], box: [-7, -8, 3, 8], draw: () => `<path d="${nNO(0)}"/>${nDelay(false)}` }),
  n_tnc_off: NSYM({ name: 'NC contact, off-delay', cat: 'Coils and contacts', ip: 'K', np: 'TR', role: 'aux', contact: 'NC',
    conns: [[0, -8, '15'], [0, 8, '16']], box: [-7, -8, 3, 8], draw: () => `<path d="${nNC(0)}"/>${nDelay(false)}` }),
  n_mc3: NSYM({ name: 'Main contacts 3P', cat: 'Coils and contacts', ip: 'K', np: 'M', role: 'aux', fixed: true,
    conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-11, -8, 11, 8],
    draw: () => `<path d="${nNO(-8)}${nNO(0)}${nNO(8)}"/>` }),
  n_pbno: NSYM({ name: 'Pushbutton NO', cat: 'Command devices', ip: 'S', np: 'PB', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-7, -8, 2, 8], draw: () => `${nTerm}<path d="M-2.2,-4.4V4.4M-2.2,0H-6M-6,-1.6V1.6"/>` }),
  n_pbnc: NSYM({ name: 'Pushbutton NC', cat: 'Command devices', ip: 'S', np: 'PB', role: 'main', contact: 'NC',
    conns: [[0, -8, '11'], [0, 8, '12']], box: [-7, -8, 2, 8], draw: () => `${nTerm}<path d="M1,-4.4V4.4M1,0H-6M-6,-1.6V1.6"/>` }),
  n_estop: NSYM({ name: 'Emergency stop', cat: 'Command devices', ip: 'S', np: 'PB', role: 'main', contact: 'NC',
    conns: [[0, -8, '11'], [0, 8, '12']], box: [-10, -8, 2, 8], draw: () => `${nTerm}<path d="M1,-4.4V4.4M1,0H-6M-6,-3.4V3.4M-6,-3.4A3.4,3.4 0 0 0 -6,3.4"/>` }),
  n_sel: NSYM({ name: 'Selector switch', cat: 'Command devices', ip: 'S', np: 'SS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-8, -8, 2, 8], draw: () => `${nTerm}<path d="M-0.6,2.2L-3,-3.4M-6.4,-2.4A3,3 0 0 1 -6.4,2.4M-6.4,2.4L-7.4,1.2M-6.4,2.4L-5,1.8"/>` }),
  n_lsno: NSYM({ name: 'Limit switch NO', cat: 'Switches and sensors', ip: 'S', np: 'LS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-6, -8, 2, 8], draw: () => `<path d="${nBladeNO}"/><path d="M-1.8,0L-4.6,1.2L-2.6,2.6Z" fill="#000"/>` }),
  n_lsnc: NSYM({ name: 'Limit switch NC', cat: 'Switches and sensors', ip: 'S', np: 'LS', role: 'main', contact: 'NC',
    conns: [[0, -8, '11'], [0, 8, '12']], box: [-3, -8, 4, 8], draw: () => `<path d="${nBladeNC}"/><path d="M1.7,0L-1.2,-0.6L0.6,1.6Z" fill="#000"/>` }),
  n_prox: NSYM({ name: 'Proximity switch', cat: 'Switches and sensors', ip: 'B', np: 'PRS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-6, -8, 6, 8], draw: () => `<path d="${nNO(0)}"/><path d="M-6,0L0,-6L6,0L0,6Z" stroke-width="0.25"/>` }),
  n_psw: NSYM({ name: 'Pressure switch', cat: 'Switches and sensors', ip: 'B', np: 'PS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-7, -8, 2, 8], draw: () => `<path d="${nBladeNO}M-1.8,0V4.4M-4.6,4.4A2.8,2.8 0 0 1 1,4.4Z"/>` }),
  n_tsw: NSYM({ name: 'Temperature switch', cat: 'Switches and sensors', ip: 'B', np: 'TAS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-6, -8, 2, 8], draw: () => `<path d="${nBladeNO}M-1.8,0V2L-3.4,3L-0.6,4.2L-3.4,5.4L-1.8,6.4"/>` }),
  n_lvl: NSYM({ name: 'Level (float) switch', cat: 'Switches and sensors', ip: 'B', np: 'FS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-6, -8, 2, 8], draw: () => `<path d="${nBladeNO}M-1.8,0V3.4"/><circle cx="-1.8" cy="5" r="1.6"/>` }),
  n_flow: NSYM({ name: 'Flow switch', cat: 'Switches and sensors', ip: 'B', np: 'FLS', role: 'main', contact: 'NO',
    conns: [[0, -8, '13'], [0, 8, '14']], box: [-6, -8, 2, 8], draw: () => `<path d="${nBladeNO}M-1.8,0V6.4"/><path d="M-1.8,3.4L-5.2,4.9L-1.8,6.4Z" fill="#000"/>` }),
  n_cb1: NSYM({ name: 'Circuit breaker 1P', cat: 'Protection', ip: 'Q', np: 'CB', role: 'main', fixed: true,
    conns: [[0, -8, '1'], [0, 8, '2']], box: [-4, -8, 1, 8], draw: () => `<path d="${nCB(0)}"/>${nCBt(0)}` }),
  n_cb2: NSYM({ name: 'Circuit breaker 2P', cat: 'Protection', ip: 'Q', np: 'CB', role: 'main', fixed: true,
    conns: [[-4, -8, '1'], [-4, 8, '2'], [4, -8, '3'], [4, 8, '4']], box: [-8, -8, 5, 8],
    draw: () => `<path d="${nCB(-4)}${nCB(4)}"/>${nCBt(-4)}${nCBt(4)}${gang(-7.4, 0.6, 0)}` }),
  n_cb3: NSYM({ name: 'Circuit breaker 3P', cat: 'Protection', ip: 'Q', np: 'CB', role: 'main', fixed: true,
    conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-12, -8, 9, 8],
    draw: () => `<path d="${nCB(-8)}${nCB(0)}${nCB(8)}"/>${nCBt(-8)}${nCBt(0)}${nCBt(8)}${gang(-11.4, 4.6, 0)}` }),
  n_mpcb: NSYM({ name: 'Motor circuit protector', cat: 'Protection', ip: 'Q', np: 'MCP', role: 'main', fixed: true,
    conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-17, -8, 9, 8],
    draw: () => `<path d="${nCB(-8)}${nCB(0)}${nCB(8)}"/>${nCBt(-8)}${nCBt(0)}${nCBt(8)}${gang(-16, 4.6, 0)}<rect x="-16.6" y="-1.6" width="3.2" height="3.2"/>` }),
  n_disc3: NSYM({ name: 'Disconnect switch 3P', cat: 'Protection', ip: 'Q', np: 'DISC', role: 'main', fixed: true,
    conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-14, -8, 10, 8],
    draw: () => [-8, 0, 8].map(x => `<path d="M${x},-8V-3.6M${x},8V3L${x - 3},-3"/><circle cx="${x}" cy="-3" r="0.7"/>`).join('') + gang(-13, 5.5, 0) + '<path d="M-13,-2.4V2.4"/>' }),
  n_fuse: NSYM({ name: 'Fuse', cat: 'Protection', ip: 'F', np: 'FU', role: 'main', fixed: true,
    conns: [[0, -8, '1'], [0, 8, '2']], box: [-2.5, -8, 2.5, 8], draw: () => '<path d="M0,-8V-5C3,-2.4 -3,2.4 0,5V8"/><rect x="-2.5" y="-5" width="5" height="10" stroke-width="0.25"/>' }),
  n_ol3: NSYM({ name: 'Overload relay 3P', cat: 'Protection', ip: 'F', np: 'OL', role: 'main', fixed: true,
    conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-10, -8, 11, 8],
    draw: () => `<path d="${nCurl(-8)}${nCurl(0)}${nCurl(8)}"/>` }),
  n_olnc: NSYM({ name: 'Overload contact NC', cat: 'Protection', ip: 'F', np: 'OL', role: 'aux', contact: 'NC', fixed: true,
    conns: [[0, -8, '95'], [0, 8, '96']], box: [-8, -8, 3, 8], draw: () => `<path d="${nNC(0)}M-3.6,-2C-6.6,-2 -6.6,2 -3.6,2"/>` }),
  n_xfmr: NSYM({ name: 'Control transformer', cat: 'Loads and sources', ip: 'T', np: 'T', role: 'main', fixed: true,
    conns: [[-4, -12, 'H1'], [4, -12, 'H2'], [-4, 12, 'X1'], [4, 12, 'X2']], box: [-6, -12, 6, 12],
    draw: () => `<path d="M-4,-12V-4M4,-12V-4M-4,12V4M4,12V4${loops(-4, -4, 4, false)}${loops(-4, 4, 4, true)}"/><path d="M-5,-1H5M-5,1H5" stroke-width="0.6"/>` }),
  n_motor: NSYM({ name: 'Motor 3PH', cat: 'Loads and sources', ip: 'M', np: 'MTR', role: 'main', fixed: true,
    conns: [[-8, -12, 'T1'], [0, -12, 'T2'], [8, -12, 'T3'], [12, -12, 'GND']], box: [-9, -12, 12, 13],
    draw: () => '<path d="M-8,-12V0M0,-12V-5M8,-12V0M12,-12V4H9"/><circle cx="0" cy="4" r="9"/>', texts: () => [[0, 3.2, 'MTR', 3, true], [0, 7.4, '3PH', 2.2]] }),
  n_motor1: NSYM({ name: 'Motor 1PH', cat: 'Loads and sources', ip: 'M', np: 'MTR', role: 'main', fixed: true,
    conns: [[-4, -12, 'T1'], [4, -12, 'T2'], [12, -12, 'GND']], box: [-9, -12, 12, 13],
    draw: () => '<path d="M-4,-12V-4.06M4,-12V-4.06M12,-12V4H9"/><circle cx="0" cy="4" r="9"/>', texts: () => [[0, 3.2, 'MTR', 3, true], [0, 7.4, '1PH', 2.2]] }),
  n_motordc: NSYM({ name: 'Motor DC', cat: 'Loads and sources', ip: 'M', np: 'MTR', role: 'main', fixed: true,
    conns: [[-4, -12, 'A1'], [4, -12, 'A2']], box: [-9, -12, 9, 13],
    draw: () => '<path d="M-4,-12V-4.06M4,-12V-4.06"/><circle cx="0" cy="4" r="9"/>', texts: () => [[0, 3.2, 'MTR', 3, true], [0, 7.4, 'DC', 2.2]] }),
  n_lamp: NSYM({ name: 'Pilot light', cat: 'Loads and sources', ip: 'P', np: 'PL', role: 'main', fixed: true,
    conns: [[0, -8, 'X1'], [0, 8, 'X2']], box: [-6, -8, 6, 8],
    draw: () => '<path d="M0,-8V-4M0,4V8M-4.1,-4.1L-5.6,-5.6M4.1,-4.1L5.6,-5.6M-4.1,4.1L-5.6,5.6M4.1,4.1L5.6,5.6"/><circle cx="0" cy="0" r="4"/>',
    texts: it => [[0, 0.95, it.pc || 'R', 2.8, true]],
    propsHTML: (it, row) => row('it.pc', 'Lens color', '', 'select', [['R', 'Red (R)'], ['G', 'Green (G)'], ['A', 'Amber (A)'], ['Y', 'Yellow (Y)'], ['B', 'Blue (B)'], ['W', 'White (W)'], ['C', 'Clear (C)']].map(([v, l]) => `<option value="${v}" ${(it.pc || 'R') === v ? 'selected' : ''}>${l}</option>`).join('')) }),
  n_horn: NSYM({ name: 'Horn', cat: 'Loads and sources', ip: 'P', np: 'AH', role: 'main', fixed: true,
    conns: [[0, -8, 'X1'], [0, 8, 'X2']], box: [-7, -8, 2, 8],
    draw: () => '<path d="M0,-8V-2M0,2V8M-2,-2H2V2H-2ZM-2,-2L-7,-4.6V4.6L-2,2"/>' }),
  n_heater: NSYM({ name: 'Heater', cat: 'Loads and sources', ip: 'E', np: 'HTR', role: 'main', fixed: true,
    conns: [[0, -8, '1'], [0, 8, '2']], box: [-2.4, -8, 2.4, 8],
    draw: () => '<path d="M0,-8V-5L2.2,-4L-2.2,-2.4L2.2,-0.8L-2.2,0.8L2.2,2.4L-2.2,4L0,5V8"/>' }),
  n_vfd: NSYM({ name: 'Variable frequency drive', cat: 'Loads and sources', ip: 'U', np: 'VFD', role: 'main', fixed: true,
    conns: [[-8, -12, 'L1'], [0, -12, 'L2'], [8, -12, 'L3'], [-8, 12, 'T1'], [0, 12, 'T2'], [8, 12, 'T3']], box: [-12, -12, 12, 12],
    draw: () => '<rect x="-12" y="-8" width="24" height="16"/><path d="M-8,-12V-8M0,-12V-8M8,-12V-8M-8,12V8M0,12V8M8,12V8"/>', texts: () => [[0, 1, 'VFD', 3.2, true]] }),
  n_ps: NSYM({ name: 'Power supply', cat: 'Loads and sources', ip: 'G', np: 'PWR', role: 'main', fixed: true,
    conns: [[-8, -12, 'L1'], [0, -12, 'L2'], [8, -12, 'GND'], [-4, 12, '+'], [4, 12, '-']], box: [-12, -12, 12, 12],
    draw: () => '<rect x="-12" y="-8" width="24" height="16"/><path d="M-8,-12V-8M0,-12V-8M8,-12V-8M-4,12V8M4,12V8"/>', texts: () => [[0, -0.6, 'PWR', 2.4, true], [0, 2.8, 'SUPPLY', 2]] }),
  n_solc: NSYM({ name: 'Solenoid', cat: 'Coils and contacts', ip: 'QM', np: 'SOL', role: 'aux', fixed: true, coilNo: true,
    conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-3, -8, 3, 8],
    draw: () => '<path d="M0,-8V-4a1.33,1.33 0 0 1 0,2.67a1.33,1.33 0 0 1 0,2.67a1.33,1.33 0 0 1 0,2.67V8"/><rect x="-3" y="-5" width="6" height="10" stroke-width="0.25"/>' }),
  n_plug: NSYM({ name: 'Plug and receptacle', cat: 'Connections', ip: 'X', np: 'PLG', role: 'main', fixed: true,
    conns: [[0, -8, '1'], [0, 8, '2']], box: [-2.5, -8, 2.5, 8],
    draw: () => '<path d="M0,-8V-1M-2.4,-3.4L0,-1L2.4,-3.4M0,8V1M-2.4,3.4L0,1L2.4,3.4"/>' }),
  // ----- NFPA single-line -----
  nsl_cb: NSYM({ name: 'Circuit breaker (single-line)', cat: 'Single-line', ip: 'Q', np: 'CB', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 2, 8], draw: () => `<path d="${nCB(0)}"/>${nCBt(0)}${slash3}` }),
  nsl_mpcb: NSYM({ name: 'Motor circuit protector (single-line)', cat: 'Single-line', ip: 'Q', np: 'MCP', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-9, -8, 2, 8], draw: () => `<path d="${nCB(0)}"/>${nCBt(0)}${slash3}${gang(-8, -3.4, 0)}<rect x="-8.6" y="-1.6" width="3.2" height="3.2"/>` }),
  nsl_fuse: NSYM({ name: 'Fuse (single-line)', cat: 'Single-line', ip: 'F', np: 'FU', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-2.5, -8, 2.5, 8], draw: () => '<path d="M0,-8V-5C3,-2.4 -3,2.4 0,5V8"/><rect x="-2.5" y="-5" width="5" height="10" stroke-width="0.25"/>' }),
  nsl_disc: NSYM({ name: 'Disconnect switch (single-line)', cat: 'Single-line', ip: 'Q', np: 'DISC', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 2, 8], draw: () => `<path d="M0,-8V-3.6M0,8V3L-3,-3"/><circle cx="0" cy="-3" r="0.7"/>${slash3}` }),
  nsl_k: NSYM({ name: 'Motor starter (single-line)', cat: 'Single-line', ip: 'K', np: 'M', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-3, -8, 3, 8], draw: () => `<path d="${nNO(0)}"/>${slash3}` }),
  nsl_ol: NSYM({ name: 'Overload relay (single-line)', cat: 'Single-line', ip: 'F', np: 'OL', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-2, -8, 3, 8], draw: () => `<path d="${nCurl(0)}"/>` }),
  nsl_motor: NSYM({ name: 'Motor (single-line)', cat: 'Single-line', ip: 'M', np: 'MTR', role: 'sl', fixed: true,
    conns: [[0, -8, '']], box: [-6, -8, 6, 8], draw: () => `<path d="M0,-8V-4"/><circle cx="0" cy="2" r="6"/>${slash3}`, texts: () => [[0, 2.9, 'MTR', 2.4, true]] }),
  nsl_xfmr: NSYM({ name: 'Transformer (single-line)', cat: 'Single-line', ip: 'T', np: 'T', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-4, -8, 4, 8], draw: () => `<path d="M0,-8V-3M0,3V8${loops(-3, -3, 3, false)}${loops(-3, 3, 3, true)}M-3.6,0H3.6"/>` }),
  nsl_vfd: NSYM({ name: 'Drive (single-line)', cat: 'Single-line', ip: 'U', np: 'VFD', role: 'sl', fixed: true,
    conns: [[0, -8, ''], [0, 8, '']], box: [-5, -8, 5, 8], draw: () => '<path d="M0,-8V-4M0,4V8"/><rect x="-5" y="-4" width="10" height="8"/>', texts: () => [[0, 0.8, 'VFD', 2.2, true]] }),
});
// the original industrial symbols are IEC
const CORE_IEC = { coil: 'CR', no: 'CR', nc: 'CR', mc3: 'M', pbno: 'PB', pbnc: 'PB', estop: 'PB', cb1: 'CB', cb3: 'CB', fuse: 'FU', ol3: 'OL', olnc: 'OL', motor: 'MTR', lamp: 'PL', ps: 'PWR' };
for (const [k, np] of Object.entries(CORE_IEC)) Object.assign(SYM[k], { std: 'IEC', ip: SYM[k].prefix, np });
SYM.pbno.cat = SYM.pbnc.cat = SYM.estop.cat = 'Command devices';

// counterparts in the other standard
const STD_PAIRS = [['coil', 'n_coil'], ['tdon', 'n_tdon'], ['tdoff', 'n_tdoff'], ['no', 'n_no'], ['nc', 'n_nc'], ['co', 'n_co'],
  ['tno_on', 'n_tno_on'], ['tnc_on', 'n_tnc_on'], ['tno_off', 'n_tno_off'], ['tnc_off', 'n_tnc_off'], ['mc3', 'n_mc3'], ['pbno', 'n_pbno'], ['pbnc', 'n_pbnc'], ['estop', 'n_estop'],
  ['sel', 'n_sel'], ['lsno', 'n_lsno'], ['lsnc', 'n_lsnc'], ['prox', 'n_prox'], ['psw', 'n_psw'], ['tsw', 'n_tsw'], ['lvl', 'n_lvl'], ['flow', 'n_flow'],
  ['cb1', 'n_cb1'], ['cb2', 'n_cb2'], ['cb3', 'n_cb3'], ['mpcb', 'n_mpcb'], ['disc3', 'n_disc3'], ['fuse', 'n_fuse'], ['ol3', 'n_ol3'], ['olnc', 'n_olnc'],
  ['xfmr', 'n_xfmr'], ['motor', 'n_motor'], ['motor1', 'n_motor1'], ['motordc', 'n_motordc'], ['lamp', 'n_lamp'], ['horn', 'n_horn'], ['heater', 'n_heater'],
  ['vfd', 'n_vfd'], ['ps', 'n_ps'], ['solc', 'n_solc'], ['plug', 'n_plug'],
  ['sl_cb', 'nsl_cb'], ['sl_mpcb', 'nsl_mpcb'], ['sl_fuse', 'nsl_fuse'], ['sl_disc', 'nsl_disc'], ['sl_k', 'nsl_k'], ['sl_ol', 'nsl_ol'], ['sl_motor', 'nsl_motor'], ['sl_xfmr', 'nsl_xfmr'], ['sl_vfd', 'nsl_vfd']];
for (const [a, b] of STD_PAIRS) { SYM[a].pair = b; SYM[b].pair = a; }
SYM.n_mcoil.pair = 'coil';
// the device letter follows the project's standard
function stdLetters(d) {
  if (!d.ip && !d.np) return;
  Object.defineProperty(d, 'prefix', { get() { return (isNFPA() ? d.np : d.ip) || d.ip || d.np; }, set(v) { d.ip = d.np = v; }, enumerable: true, configurable: true });
}
for (const d of Object.values(SYM)) stdLetters(d);

const STD_ORDER_IEC = ['tdon', 'tdoff', 'co', 'tno_on', 'tnc_on', 'tno_off', 'tnc_off', 'solc', 'sel', 'lsno', 'lsnc', 'prox', 'psw', 'tsw', 'lvl', 'flow', 'cb2', 'mpcb', 'disc3', 'xfmr', 'motor1', 'motordc', 'horn', 'heater', 'vfd', 'plug',
  'sl_cb', 'sl_mpcb', 'sl_fuse', 'sl_disc', 'sl_k', 'sl_ol', 'sl_motor', 'sl_xfmr', 'sl_vfd'];
// IEC symbols in palette order, with the new ones next to their family
const iecOrder = ['coil', 'tdon', 'tdoff', 'no', 'nc', 'co', 'tno_on', 'tnc_on', 'tno_off', 'tnc_off', 'mc3', 'solc', 'pbno', 'pbnc', 'estop', 'sel', 'lsno', 'lsnc', 'prox', 'psw', 'tsw', 'lvl', 'flow',
  'cb1', 'cb2', 'cb3', 'mpcb', 'disc3', 'fuse', 'ol3', 'olnc', 'motor', 'motor1', 'motordc', 'xfmr', 'lamp', 'horn', 'heater', 'vfd', 'ps', 'plug'];
{
  const rest = SYMORDER.filter(k => !iecOrder.includes(k));
  const nfpa = iecOrder.map(k => SYM[k].pair).concat('n_mcoil');
  const sl = STD_ORDER_IEC.filter(k => k.startsWith('sl_'));
  SYMORDER.length = 0; SYMORDER.push(...iecOrder, ...nfpa, ...sl, ...sl.map(k => SYM[k].pair), ...rest);
}

// the symbol of the project's standard for a symbol key (used by the ribbon and the demo)
function stdSym(k, std = projStd()) { const d = SYM[k]; if (!d || !d.std || d.std === std || !d.pair) return k; return d.pair; }
const symStdLabel = d => d && d.std ? STD_NAMES[d.std] : '';

// ---------- converting content between standards ----------
// items whose symbol belongs to the other standard; a device's new letter comes from its main function
// pick(it) can choose another target symbol for an item (the demo uses it for a motor starter coil)
function stdConversions(items, to = projStd(), pick) {
  const out = [], newTag = new Map();
  const letters = k => { const d = SYM[k]; return d ? { from: d.std === 'NFPA' ? d.np : d.ip, to: to === 'NFPA' ? d.np : d.ip } : null; };
  for (const it of items) {
    const d = SYM[it.sym]; if (!d || !d.std || d.std === to || !d.pair) continue;
    out.push({ it, from: it.sym, to: (pick && pick(it)) || d.pair });
  }
  const keyOf = it => `${it.fn || ''}\u0001${it.loc || ''}\u0001${it.tag || ''}`;
  for (const c of out) {
    const k = keyOf(c.it); if (newTag.has(k) || !c.it.tag) continue;
    // a device keeps its tag when its main function stays as it is (for example a black box with a single-line view)
    const mainIt = items.find(i => keyOf(i) === k && i.role === 'main');
    if (mainIt && !out.some(o => o.it === mainIt)) { newTag.set(k, c.it.tag); continue; }
    const main = out.find(o => keyOf(o.it) === k && o.it.role === 'main') || c;
    const L = letters(main.from), L2 = letters(main.to); const m = /^([A-Za-z]+)(\d*)$/.exec(c.it.tag);
    newTag.set(k, m && L && m[1] === L.from && L2 && L2.to ? L2.to + m[2] : c.it.tag);
  }
  for (const c of out) { c.oldTag = c.it.tag || ''; c.newTag = c.it.tag ? newTag.get(keyOf(c.it)) : ''; }
  return out;
}
function applyStdConversions(list) {
  for (const c of list) {
    const it = c.it, od = SYM[c.from], nd = SYM[c.to];
    if (JSON.stringify(it.cl || []) === JSON.stringify(od.conns.map(x => x[2]))) it.cl = nd.conns.map(x => x[2]);
    it.sym = c.to; if (c.newTag) it.tag = c.newTag;
    if (nd.role !== od.role && (nd.role === 'main' || nd.role === 'aux' || nd.role === 'sl') && it.role === od.role) it.role = nd.role;
  }
}
// give every device the letter of a standard, keeping its number (K1 becomes CR1); the main function decides
function retagLetters(items, to) {
  const keyOf = it => `${it.fn || ''}\u0001${it.loc || ''}\u0001${it.tag || ''}`; const devs = new Map();
  for (const it of items) { if (!it.tag || it.sym === 'term') continue; const k = keyOf(it); if (!devs.has(k)) devs.set(k, []); devs.get(k).push(it); }
  for (const list of devs.values()) {
    const main = list.find(i => i.role === 'main') || list[0]; const d = SYM[main.sym]; if (!d || !d.ip || !d.np) continue;
    const m = /^([A-Za-z]+)(\d*)$/.exec(main.tag); const fromL = to === 'NFPA' ? d.ip : d.np, toL = to === 'NFPA' ? d.np : d.ip;
    if (!m || m[1] !== fromL) continue;
    for (const it of list) it.tag = toL + m[2];
  }
}
// ask before inserting content that uses the other standard. Resolves with the content to insert (converted or as
// it was), or null when cancelled.
function stdCheck(src, what = 'This content') {
  const items = (src.items || []); const to = projStd(); const list = stdConversions(items, to);
  if (!list.length) return Promise.resolve(src);
  const rows = list.map(c => `<tr><td>${esc(c.oldTag || '')}</td><td>${esc(SYM[c.from].name)} <span class="note">(${esc(SYM[c.from].std)})</span></td><td>→</td><td>${esc(SYM[c.to].name)} <span class="note">(${esc(SYM[c.to].std)})</span></td><td>${c.newTag && c.newTag !== c.oldTag ? esc(c.newTag) : ''}</td></tr>`).join('');
  return new Promise(res => {
    let v = '';
    dialog('Symbols from the other standard', [], () => {}, 'OK', `<div class="note" style="margin-bottom:6px">${esc(what)} uses ${list.length} symbol(s) of ${esc(STD_NAMES[otherStd(to)])}. This project uses ${esc(STD_NAMES[to])}.</div>
      <div class="pmwrap" style="max-height:50vh"><table class="pmtab stdconv"><tr><th>Tag</th><th>Symbol now</th><th></th><th>Changes to</th><th>New tag</th></tr>${rows}</table></div>`);
    $('#dlg').style.width = '720px';
    $('#dlgbtns').innerHTML = '<button type="button" class="btn" data-v="">Cancel</button><button type="button" class="btn" data-v="keep">Keep as is</button><button type="button" class="btn primary" data-v="convert">Convert to project standard</button>';
    const dlg = $('#dlg');
    $('#dlgbtns').onclick = e => { const b = e.target.closest('button'); if (!b) return; v = b.dataset.v; dlg.close('cancel'); };
    dlg.onclose = () => {
      $('#dlgbtns').onclick = null;
      if (v === 'keep') return res(src);
      if (v !== 'convert') return res(null);
      const c = clone(src); applyStdConversions(stdConversions(c.items || [], to)); res(c);
    };
    $('#dlgbtns .primary').focus();
  });
}
