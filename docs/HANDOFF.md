# OpenSchem: handoff for a new chat

## The project

OpenSchem is my electrical schematic editor with structured device tagging (=Function +Location -Device). It covers both industrial controls and documenting my home's 120 V wiring. It is a server version (Go web server in Docker) on the `main` branch of one repository.

- Repository: https://github.com/Shwhat/OpenSchem (public, GPL-3.0; the old lowercase address still redirects). Clone it and work in it. All work goes on `main`.
- Interface: plain HTML and JavaScript in `ui/`. The load order is in `ui/manifest.txt`, and `files.js` must stay last.
- Tests: `npm test` runs every suite in `tests/suites/` in headless Chromium. `npm test -- name` runs one suite. Every change gets tests, and all tests must pass before a build. A page error during a test fails it. The DXF tests read files in `tests/fixtures/` (made by `make_dxf.py` with ezdxf). In the cloud workspace Playwright is found at `/opt/npm-tools/node_modules/playwright` with browsers in `/opt/pw-browsers`; do not run `npx playwright install`. The full run takes about 25 minutes, so run it in the background.
- Bump `APP_VERSION` in `ui/js/migrate.js`, `package.json` and `package-lock.json` with each delivered build. A new `APP_VERSION` resets the saved ribbon layout so new buttons always appear.

### Server

- Go web server, standard library only: `main.go` (routes, pages, sign-in), `store.go` (data folder, accounts, sessions, projects, sharing, edit lock), `auth.go` (PBKDF2 hashing, sign-in rate limits), `web/login.html` (sign-in page). `ui/js/host.js` is the browser side: server calls, project list, sharing, account menu.
- Data files the interface may read and write are listed in `dataFiles` in `store.go` (prefs.json per user; library.json, parts.json, blocks.json, manufacturers.json shared). Add new ones there.
- Build and run: `docker compose up -d --build`, or `CGO_ENABLED=0 go build -o openschem .`. Multi-arch: `docker buildx build --platform linux/amd64,linux/arm64 ...`. Image is `FROM scratch`, runs as user 65532, data in `/data`.
- GitHub Actions (`.github/workflows/docker.yml`) publishes amd64 and arm64 images to `ghcr.io/shwhat/openschem:latest` on every push to `main` and on `v*` tags.
- Settings: `OPENSCHEM_SIGNUP` (on/off), `OPENSCHEM_SECURE_COOKIE` (auto/always/never), `OPENSCHEM_ADDR`, `OPENSCHEM_DATA`.
- Tests: `go test ./...` for the server, plus `tests/suites/91-server.mjs` which builds and starts the server and drives the browser (needs Go).
- The cloud workspace cannot pull from Docker Hub or gcr.io. To test an image there, cross-compile the binary and build a scratch image from it locally (start `dockerd` by hand in the background). Deliver image archives as `openschem-<version>-<arch>.tar.gz` (load with `docker load`).
- Pushing: the session's git proxy needs the repository attached first (add_repo with push access), or the push is refused with 403. Anonymous clones of the public repo work without attaching.

### Windows desktop version (retired)

Retired. Do not build or maintain it. The last Windows code is at commit 1f0de32 (1.13.0) in history.

### Code map for 1.15.0 additions

- `ui/js/standards.js`: IEC 60617 and NFPA 79 symbols, single-line symbols, `pair` links between standards, device letters per standard (`ip`/`np`, `prefix` is a getter on the project standard), `stdSym()`, `stdConversions()`, `applyStdConversions()`, `retagLetters()`, and the convert popup `stdCheck()`.
- `ui/js/pneumatic.js`: ISO 1219 symbols (`VALVES` table for directional valves, actuators as item properties), `PAGE_TYPES` (schematic, single-line, pneumatic), tubes (`w.tube` on a connection), tubing list (`tubeRows()`, report `tubes`).
- `ui/js/parts.js`: parts database with `MFR.OrderNumber` part numbers, manufacturer list (`MFRS`, `manufacturers.json`), `editPart()`, `editMfr()`, `mfrDlg()`, `importPartsCSV()` (async, asks Skip/Replace).
- Item roles: `main`, `aux`, `sl` (single-line or pneumatic view of a device: cross-referenced, counted once on the BOM), `mark` (pneumatic air supply and exhaust, no tag). Symbol flags: `std`, `pair`, `pneu`, `valve`, `coilNo`, `propsHTML`, `onChange`.
- Tests: `15-standards.mjs` and `16-pneumatic.mjs`; parts tests in `80-parts-loads.mjs`.

### Code map for 1.16.0 additions

- `ui/js/shapes.js`: shape types `rect` `{ c, w, h, rot, r | ch }` and `polygon` `{ c, n, r, rot, ic }` (`isParam()`). `asPline(s)` gives the same outline as a closed polyline with the shape's style and id; outline, path, snaps, curves (`curveOf` in `curves.js`), DXF export (`exportPrims` in `dxf.js`), trim and break all go through it. `rectAt()`/`rectLocal()` convert to and from the rectangle's own axes; `rectCorners()`, `rectFrom(a, b, r, ch)`, `polyVerts()`, `polyA0()`, `polyVR()`. Properties: rectangle Width, Height, Rotation, Corners, Corner radius or cut; polygon Sides, Radius, Radius to, Rotation; ellipse Rotation; arc Start and End angle.
- `ui/js/grips.js`: rectangle grips 0-3 corners, 4-7 side middles, 8 center (`rectGrip()`); polygon grips 0 center, then corners.
- `ui/js/edit.js`: offset keeps rectangles (without cut corners) and polygons; fillet and chamfer on one of their corners turn them into a polyline in place (same id); Explode turns them into closed polylines; `toPlineInPlace()`.
- `ui/js/draw.js`: tool flag `free(D)` (the next point sizes a shape, so `fpPoint` skips Ortho and Polar: rectangle corner, circle radius, ellipse other axis). `drawPress()` / `drawUp()`: a release more than 6 px from the press is the next point (press-drag-release on every draw tool).
- `ui/js/floor.js`: `fpPoint` = `fpPointRaw` plus `dynLock()` (locked dynamic input values steer the cursor); option `free`.
- `ui/js/dynin.js`: dynamic input. `DYN` state (typed text per field, locked values, active field, X,Y mode, options menu). `dynCtx()` decides the fields from `fpAwaiting()` (x y, dx dy, len ang, w h, dia, num, fac); `dynLive()` the cursor values; `dynKey()` is called first by the window keydown handler; `dynText()` turns the fields into the typed syntax the commands already read (`10'<90`, `4',2'`, `#x,y`, `@dx,dy`) and `dynSubmit()` sends it through `fpTyped()`. Options come from the `[A/B]` part of the prompt (`dynOptions()`, `dynOptWord()`). The box is `#dyn` (styles in `style.css`, class `ro` when off, `dk` on a dark sheet). `PREFS.dyn`, F12 (also from the command line), DYN in the status bar, ribbon Precision group. The old SVG `.rdout` readouts are gone.
- `ui/js/core.js`: `PREFS.ortho` now false by default, `PREFS.dyn` true.
- Tests: `49-dyn.mjs`.

## Rules for working with me

- Do not build the program or make program changes until I say "build it". Until then, ask clarifying questions and settle the spec with me.
- Do not commit or push to git until I ask. Do not remind me about uncommitted work or about stop-hook messages asking to commit; just leave the work local.
- Never mention the commercial ECAD tool OpenSchem is modeled on by name in the program, its source or its documentation (this handoff included). The banned name is listed in `tests/suites/00-static.mjs`, which enforces it.
- This handoff lives in two places: the project doc `claude/OpenSchem handoff.md` and `docs/HANDOFF.md` in the repository. Keep them identical and commit the repository copy whenever it changes.
- Never use em dashes in any output.
- Answer questions simply, without extra unrequested actions.
- The demo projects (Help > Open IEC demo project and Open NFPA demo project, built by `buildDemo(std)` in `ui/js/demo.js` from `demo-industrial.js` and `demo-home.js`; the NFPA demo is the IEC demo converted) must show every project feature. When a feature is added, add it to the demo and to the coverage test in `tests/suites/05-demo.mjs`, which checks both demos. Server features (accounts, sharing) are covered by `91-server.mjs` instead.
- Use a task list, update the README feature list, and keep the keyboard shortcut list (`shortcuts()` in `ui/js/dialogs.js`) current.
- Check every item on the bug list below on the next build.
- We are in full development and there are no old projects or saved settings to protect. Do not write upgrade conversions (migrations) for old project files or old settings. Change the saved data layout freely. Note: in 1.13.0 a step 3 -> 4 was added to `ui/js/migrate.js` (FORMAT_VERSION 4) against this rule; it can stay or be removed, but add no new steps.

## Bug list (inspect and fix on the next build)

None open.

## Open ideas, not yet specified

Settle the spec with me before building.

### 1. Import manufacturer part libraries (on hold, I said skip for now)

Import the part data files that manufacturers publish on their websites for the common commercial ECAD tool (the Data Portal style downloads, typically `.edz` archives containing parts XML, plus plain parts XML exports). Imported parts should arrive in the `MFR.OrderNumber` format, with manufacturers added to the shared manufacturer list.

- Never name the commercial tool in the program, source or documentation (the existing rule and test). Describe the format neutrally, for example "manufacturer part data (.edz, .xml)".
- Need real sample files to build and test against (one or more `.edz` downloads from Phoenix Contact, Siemens, Rittal, etc.). Fixtures go in `tests/fixtures/`.

Questions to settle: which fields to keep (technical data, prices, images, documents, connection point patterns, macros); whether macros or graphics inside the archive are imported or ignored; behavior when a part already exists (probably the same Skip/Replace question as CSV import).

### Note on Library.zip (in the project files)

Library.zip holds symbol libraries, not part libraries: IEC_single_symbol, IEC_symbol, NFPA_single_symbol, NFPA_symbol, OS_SYM_ESS, PNE1ESS, SPECIAL. Each is a `.slk` file plus a `.sdb` folder of proprietary binary database files. Not an open format; not planned unless I ask. The 1.15.0 libraries were drawn from scratch instead.

## Done so far (do not redo)

- Schematic editor, residential symbols, floor plans, panel schedule, reports, PDF export, revisions, to-dos, macros, cables, symbol editor, ribbon, dark theme.
- Page navigator tree with one page open, thumbnails, zoom window, display and user layers.
- Parts database, BOM prices, load calculation, voltage drop, breaker labels.
- Page graphics, black boxes, device boxes, PLC cards, Excel import/export, find and replace, terminal strip editor, panel layout pages.
- Align to grid, room resize handles, paper sizes including a 3 x 5 in note card, round and oval rooms, automatic connections, dragging wire ends and segments, page picker for PDF export and Print.
- Floor plan CAD (1.12.0): units and scale, object snaps, ortho and polar, typed input, command line, dockable panels and workspaces; draw tools and grips; edit tools and arrays; walls, doors, windows, rooms from walls, view sheets; associative dimensions, leaders, hatches, blocks; DXF import and export, SVG and PNG export.
- 1.12.1 (commit 380a49f): ribbon reset on version change; floor plan Align to grid.
- 1.13.0 (commit 1f0de32): keyboard-first dialogs, panel docking improvements, Open to-dos filter, New page split button, Place on schematic order, circuit legend object, symbol editor works like a page, driving dimensions, report settings and order, custom reports. 164 tests. Last Windows version.
- 1.14.0 (commit 1b16c3e): server version with accounts, projects on the server, sharing, one editor at a time with an edit lock, per-user preferences and autosave, shared libraries, browser downloads for exports, security headers, Dockerfile and compose file. 171 browser tests.
- 1.16.0 (floor plan drawing works like AutoCAD):
  - Bug fix: the rectangle never placed. Ortho was on by default and locked the second corner level with the first (zero height); it only worked when the last click snapped to a line. Ortho is now off by default, and the points that size a shape (rectangle corner, circle radius, ellipse other axis) ignore Ortho and Polar. Polylines no longer feel stuck at 90 degrees.
  - Press-drag-release as well as click-click on every draw tool (line, rectangle, circle, ellipse, wall, dimension and the rest).
  - Rectangles and polygons are true shapes (Properties, grips, Explode to a polyline, offset keeps the shape, fillet or chamfer of one corner makes a polyline, DXF export as polylines). Ellipse rotation and arc start and end angles in Properties.
  - Dynamic input (AutoCAD style) beside the cursor: prompt, typeable value boxes, Tab locks, Enter accepts, comma for X,Y, Down arrow for options, F12 and DYN toggle. Readable in light and dark sheets; with it off the values still show (read only) and typing goes to the command line.
  - Demo: rounded table and a rotated cut-corner rectangle as rectangle shapes, the hexagon as a polygon shape, a closed polyline with an arc.
  - 201 browser tests and the Go server tests pass. Image archives for amd64 and arm64 delivered.
- 1.15.0 (commit 048b8b8, merged into `main` by PR #1; the `docker` branch is deleted):
  - Bug fix: a selected floor plan dimension (and selected lines, polylines, arcs, leaders) no longer shows its click band in blue. The dimension click band is built from its real pieces plus a strip through the text, so the empty area inside the old X no longer selects it.
  - Part numbers `MFR.OrderNumber`, built automatically and read-only. Fields: Manufacturer, Order number, Type number, plus the existing ones. Shared manufacturer list (`manufacturers.json`: code, name, supplier, website) starting with PXC, SIE, RIT, WAG, SCH, ABB, AB, EAT, SQD, LEV, FES, SMC; Project > Manufacturers and a ribbon button. "Add manufacturer..." in the part dialog's picker. Codes 2 to 6 capitals or digits; a code in use cannot be renamed or deleted. Duplicate on save: not saved, offers to open the existing part. CSV import: asks once Skip/Replace/Cancel; unknown manufacturer names are added with a code made from the name. No conversion of old parts; the demos use the new format.
  - Project standard IEC or NFPA chosen in the New project dialog, fixed after that (shown read-only in project properties and the page properties panel). It sets the default palette, the ribbon's symbol buttons and device letters (IEC K, S, Q, F, B...; NFPA CR, M, TR, PB, SS, LS, PRS, PS, CB, MCP, DISC, FU, OL, MTR, PL, SOL...). New home projects use NFPA.
  - Palette checkbox "Show NFPA (or IEC) symbols too"; the other standard shows in its own categories.
  - Convert popup (table of tag, current symbol, new symbol, new tag; Convert to project standard, Keep as is, Cancel) on paste, Page > Paste page (new Copy page / Paste page) and macro insert.
  - IEC 60617 additions: on-delay and off-delay timer coils, changeover contact (numbers 11/12/14), timed contacts, solenoid valve coil, selector, limit NO/NC, proximity, pressure, temperature, level and flow switches, 2P breaker, motor protective breaker, 3P disconnect, control transformer, motor 1~ and DC, horn, heater, VFD, plug and socket.
  - NFPA 79 library with the same set plus motor starter coil and pilot light with a lens color letter.
  - Single-line symbols in both standards (breaker, MPCB, fuse, disconnect, contactor or starter, overload, motor, transformer, drive), role `sl`: same tag as the multi-line device, cross-referenced both ways, counted once on the BOM, a device with only single-line symbols is not a project check error.
  - Page types: schematic, single-line (no wire numbers, out of the connection list), pneumatic (pneumatic symbols first in the palette, the Connection tool draws tubes).
  - Pneumatic library (ISO 1219), new Pneumatics ribbon tab (hidden in home projects): air supply, exhaust, silencer, FRL, gauge, reservoir, shut-off, check, flow control, quick exhaust, 2/2, 3/2, 5/2 and 5/3 (closed, exhaust, pressure center) valves, single and double acting, cushioned, magnetic and rodless cylinders, vacuum generator, suction cup, pressure switch, pressure sensor. Valve actuators in properties (solenoid, spring, pilot, lever, push button, none) with detent; pilot adds port 12 or 14.
  - Tubes: number (T1...), outside diameter, color, length, part number; new tubes take the last size and color; Tube tool (Edit > Draw tube and ribbon). Tubing list report grouped by tube size, also available as a custom report. Tubes with a part number go on the BOM.
  - Valve solenoids carry the valve's tag and cross-reference it; a valve with two solenoids numbers them A1/A2 and A3/A4. A pneumatic pressure switch with the same tag as its electrical contact is one device.
  - Library field on user symbols (IEC, NFPA, Pneumatic, Residential); copies of built-in symbols keep their library.
  - IEC and NFPA demos with new pages: supply and auxiliary pump, heater, fans, alarm and timers, PLC inputs and valve solenoids, single-line diagram, two pneumatic pages.
  - 188 browser tests and the Go server tests pass. Image archives for amd64 and arm64 delivered.

## Skipped for now

- Home Assistant integration.
- Desktop builds (Windows retired; Wails builds for other systems not planned).
- Full parametric constraints (driving dimensions cover the main need) and DWG files.
- Manufacturer part library import (see Open ideas).

## Known limits

- Rooms made from walls follow the walls only while the walls still enclose the room.
- Dynamic input locks (Tab) steer the cursor for length and angle, width and height, and X,Y; a single value (radius, angle, scale) is only accepted with Enter.
- Blocks from the built-in block library still draw their rectangles as polylines.
- Hatches are not associative, and DXF export writes hatches as boundary outlines and blocks as plain geometry.
- Splines stored by control points in a DXF come in as traced polylines.
- Driving dimensions move geometry by "stretch" rules; a dimension whose two ends are connected through such pieces cannot be changed this way and says so.
- A custom panel schedule copies all panels together (with a heading row per panel); narrow it with filters or ticks.
- Server: the shared libraries (including the manufacturer list) are saved whole, so if two people change them at the same moment, the last save wins.
- Server: there is no admin role; nobody can reset another user's password or remove an account from the interface.
- Converting between standards maps each symbol to its counterpart and renames a device only when its tag uses the standard letter (K1 to CR1); custom tags are kept.
- A valve's solenoid must be given the valve's function and location (=, +) to be the same device; it takes the valve's tag automatically when placed after the valve.

## Where we left off

1.16.0 is built locally and not committed or pushed: the floor plan drawing fixes (rectangle bug, Ortho off by default, press-drag-release, rectangle and polygon shapes, dynamic input). 201 browser tests and the Go server tests pass. Image archives `openschem-1.16.0-amd64.tar.gz` and `openschem-1.16.0-arm64.tar.gz` delivered. Two existing tests were fixed along the way: `40-floor.mjs` room snapping now turns Ortho on itself, and `91-server.mjs` waits for the new project after the New project dialog closes (it raced the dialog's close handler). Waiting for my testing, then commit and push to `main` when I ask. Manufacturer part library import is on hold.
