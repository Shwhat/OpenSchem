# OpenSchem

A portable electrical schematic editor with structured device tagging (=Function +Location -Device), built for both industrial controls work and documenting residential wiring.

This branch runs OpenSchem as a web server in a Docker container (amd64 and arm64), used from any modern browser. Several people can have accounts on one server, keep their projects there and share them with each other. Projects are stored as `.osp` files (JSON) and can be imported and downloaded. The Windows desktop version lives on the `main` branch.

## Features

**Server and accounts**
- Accounts with a user name and password; anyone who can reach the server can create one (turn this off with `OPENSCHEM_SIGNUP=off`)
- Projects are kept on the server. File > Open lists your projects and the ones shared with you, with a filter, owner, your access and who saved last
- Share a project with other users as view only or editable (File > Share project, or Share in the project list). Only the owner can share or delete it
- One editor at a time: while someone edits a project, others open it read-only and are told who is editing; it becomes editable for them once that person is done. A save that would overwrite someone else's newer save asks whether to replace their changes or save a copy
- Read-only projects can still be changed on screen and saved as your own copy
- Import a project from your computer (in the project list or by dropping an `.osp` file on the window), and File > Download project to get an `.osp` file
- The address bar holds the open project, so a page reload or a bookmark opens it again
- Preferences are per user; the symbol and macro library, parts database and block library are shared by everyone on the server
- Unsaved work is kept on the server every 30 seconds and offered back the next time you sign in
- Change password (signs out your other devices) and Sign out from the account menu at the right of the menu bar
- Exports (PDF, CSV, Excel, DXF, SVG, PNG) download through the browser

**Schematics**
- Paper sizes per page or per project: A2, A3, A4, Letter, Tabloid and a 3 × 5 in note card, each with its own column grid and title block
- Page navigator as a tree (circuit or function, room or location, page) that keeps only the open page's branch expanded, with a page filter, hover previews and a thumbnail view
- Zoom window (drag a box to zoom to it) and previous view
- Graphics on pages: line, polyline, rectangle, circle, dimension line and image, with line style, width, color and fill
- Black boxes with their own connection points on any edge, device boxes that make enclosed symbols part of one device, and PLC cards (inputs, outputs or both) with automatic channel addresses; black boxes and PLC cards rotate and mirror with variants A to H
- Find and replace across tags, descriptions, part numbers and more, with bulk edit of the results
- Terminal strip editor (renumber, function texts, part numbers for the whole strip)
- Display layers (symbols, tags, descriptions, connection labels, cross-references, connections, wire numbers, junctions, cables, text) with show, print and color settings, plus user layers that can be hidden, left out of print or locked
- IEC-style symbol library (coils, contacts, protection, motors, PLC I/O, terminals, interruption points) plus residential symbols (breakers, switches, dimmers, outlets, lights, fans, detectors, panels)
- Device tagging with =Function +Location -Device, automatic device and contact numbering, contact mirrors and cross-references
- Align to grid (Shift+G) for the selection or the whole page; on floor plans it covers devices, rooms, walls, doors and windows (they stay on their wall), shapes, free dimensions and blocks
- Automatic connections between facing connection points when symbols are placed or moved (can be turned off)
- Connection ends and segments can be dragged after placing
- Orthogonal wiring with rubber-banding, junction dots and automatic wire numbering per potential
- Symbol variants A to H (rotation and mirroring)
- Cables with conductor assignment
- Macros for reusable circuit blocks
- Custom symbol editor with a portable user library that works like a page: snap on or off with a choice of grid, align to grid, window and crossing selection, grips to reshape lines, rectangles and circles after placing, exact coordinates, move, rotate, mirror, duplicate, arrow-key nudge, undo and redo, wheel zoom and pan

**Floor plans**
- Floor-plan pages per level, with whole-level, single-room and custom-area views
- Rooms drawn as boxes, shapes, round or oval rooms with automatic wall snapping, resized by dragging corners or walls, and image import for tracing
- Devices shared between schematic and floor plan, with automatic room assignment; Place on schematic opens the device's circuit page, or a page for its room
- Circuit colors and automatically generated switch legs, and a circuit legend you add from the Floor plan tab and move or delete like any other object
- Real units: feet and inches (default) or metric per project, with a drawing scale per level (1/4" = 1', 1:50, ...). Length fields accept `12'6"`, `12' 6 1/2"`, `150"` and `3.5 m`
- Precision drafting: object snaps (endpoint, midpoint, center, intersection, perpendicular, nearest, quadrant) with markers, ortho and polar tracking (F3, F8, F10), typed lengths and coordinates while drawing (`10'`, `@12',8'`, `10'<45`, `#x,y`), window (left to right) and crossing (right to left) selection
- Draw tools on floor plans: line, polyline (line and tangent arc segments, start and end widths), arc (3 points or center, start, end), circle (radius, diameter, 2 points, 3 points), ellipse, regular polygon (inscribed, circumscribed or by edge), rectangle with rounded or cut corners, spline and text, all with snaps and typed lengths
- Grips on selected shapes and devices: drag or click-click to stretch, Space cycles through move, rotate, scale and mirror, with copies and typed angles or factors
- Shape properties (color, line width, line type, fill, layer, sizes) and Make room to turn a closed shape into a room
- Edit tools on floor plans: move, copy, rotate, scale (with reference), mirror, offset, trim, extend, fillet and chamfer (lines, walls and polyline corners), break, break at point, join, explode, rectangular, polar and path arrays, and draw order. They work on shapes, walls, rooms and devices (copied devices get new tags)
- Walls with presets (2x4 interior 4.5", 2x6 exterior 6.5", mobile home 2x3 interior 3.5" and 2x4 exterior 4.5") or a custom thickness, the reference line on the center or either face, clean mitered corners and tees, and a stored height for elevations
- Doors (single, double, pocket, bifold, sliding, garage), windows and cased openings placed in walls; they follow their wall, carry tags (D1, W1) and fill a door and window schedule report
- Rooms made by clicking inside walls, and view sheets that put several views of floor plans (whole level, a room or an area) on one page, each at its own scale with a title
- Dimensions (linear, aligned, angular, radius, diameter) that follow the geometry they measure, and driving dimensions: type a new size in the properties and the walls, lines and room corners it measures move (walls at right angles move along and stay joined, doors and windows ride with them, radius and diameter resize the circle); dimension styles (text size, units, precision, architectural ticks or arrowheads), and leaders
- Hatching by clicking inside an area (solid, diagonal, crosshatch, dots, brick, concrete, wood, insulation), with islands left open
- Blocks with attributes: a starter library of furniture, plumbing fixtures, appliances and mechanical equipment in the data folder, your own blocks, and project copies of every block used. PART goes on the bill of materials; LOAD with CIRCUIT adds to the circuit's load calculation
- DXF import (ASCII, R12 to 2018) onto a floor plan level, DXF export (R2000) of a level, and SVG or PNG export of any page
- Optional command line with command names and short aliases (RM, RS, ZE, UNDO, OSNAP, ...)
- Dockable panels (Pages, Devices, Symbols, To-do, Properties): float, dock left, right or bottom, stack as tabs (tabs wrap onto more rows instead of squeezing), resize, and save arrangements as named workspaces (Schematic, Floor plan, Home wiring, Reports built in). Floating panels snap to each other, the docked panels and the window edges, and join another panel when dropped on its tab bar

**Panel layout**
- Panel layout pages drawn to scale, with the enclosure, DIN rails, wire ducts and device footprints sized from the parts database

**Parts and loads**
- Parts database in the data folder (part number, manufacturer, description, category, technical data, price, watts, datasheet, size) with search, CSV import and export, and a picker in device properties
- Load calculation per circuit with editable defaults, percent of breaker rating, 80% warning in the project check, and voltage drop from wire size and run length with a 3% warning
- Printable breaker labels: panel directory in the two-column door layout, letter page or 4 × 6 in label

**Reports**
- Cover sheet and table of contents
- Panel schedule with load, percent of rating and voltage drop, bill of materials with manufacturer, prices and total cost, terminal diagrams, connection list, cable overview and cable diagrams, revision overview
- Project properties turn each generated report on or off (cover sheet and table of contents included) and set the order of the page tree sections and of the reports; the same order is used for the page tree, PDF export, printing and sheet numbers
- Custom reports: an editable copy of any report (bill of materials, panel schedule, terminal diagrams, connection list, cables, door and window schedule, revisions, table of contents, cover sheet). Pick rows by ticking them and with filters, hide or rename columns, edit any cell, add rows and notes. Live reports follow the project and mark edited cells whose project value changed; locked reports stay frozen until you refresh them
- CSV and Excel (.xlsx) export, Excel import that updates existing devices by ID, and vector PDF export with bookmarks and clickable cross-references; PDF export and printing let you choose the pages

**Project tools**
- Revision tracking with title block marking
- Project check (missing main functions, duplicate connection points, open interruption points)
- To-do list with items linked to devices and pages, and a Pages filter that shows only pages with an open to-do
- Keyboard-first dialogs: the first field is ready for typing with its text selected, and Enter confirms
- Engineering and homeowner display modes, light and dark themes
- Customizable tabbed ribbon

## Demo project

Help > Open demo project opens one project that uses every feature (pump station control panel, home wiring, floor plans, panel layout, note card page and more). It is built by `ui/js/demo.js` from the two building blocks in `ui/js/demo-industrial.js` and `ui/js/demo-home.js`. When a feature is added, add it to the demo and to the coverage test in `tests/suites/05-demo.mjs`.

## Running with Docker

```
docker compose up -d --build
```

Then open `http://<server>:8080` and create an account. To build images for both architectures and push them to a registry:

```
docker buildx build --platform linux/amd64,linux/arm64 -t <registry>/openschem:1.14.0 --push .
```

Settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `OPENSCHEM_SIGNUP` | `on` | `off` stops new accounts; existing users can still sign in |
| `OPENSCHEM_SECURE_COOKIE` | `auto` | `auto` marks the session cookie secure when the request comes over HTTPS (directly or with `X-Forwarded-Proto: https` from a reverse proxy); `always` or `never` force it |
| `OPENSCHEM_ADDR` | `:8080` | Address and port inside the container |
| `OPENSCHEM_DATA` | `/data` | Data folder inside the container |

The container runs as user 65532. A named volume (as in `docker-compose.yml`) works as is. To use a folder on the host instead, make it writable by that user (`chown 65532:65532 <folder>`) or run the container as your own user with `user: "1000:1000"` in the compose file.

For use outside your home network, put the server behind a reverse proxy with HTTPS.

## Data storage

Everything is in the data folder (`/data` in the container); back it up by copying the folder.

```
users.json             accounts (passwords stored as PBKDF2-SHA256 hashes)
sessions.json          sign-in sessions (hashed tokens), kept for 30 days of inactivity
projects.json          project list: owner, sharing, revision
projects/<id>.osp      project contents
users/<id>/            per-user preferences (prefs.json) and unsaved work (autosave.json)
shared/                symbol and macro library, parts database, block library
```

## Project layout

```
main.go              Web server: routes, sign-in, projects, data files
store.go             Data folder: accounts, sessions, projects, sharing, edit lock
auth.go              Password hashing and sign-in rate limits
server_test.go       Server tests (go test)
web/                 Sign-in page and logo
Dockerfile           Multi-architecture image (amd64, arm64)
docker-compose.yml   Example deployment
ui/index.html        Page skeleton
ui/style.css         All styles, including dark theme
ui/manifest.txt      Script load order (used by the server, the tests and tools/assemble.py)
ui/js/               Application code, one file per area (host.js: server connection, project list, sharing and account; navigator.js: page tree and thumbnails, layers.js: layers, units.js: lengths and scale, osnap.js: snaps, shapes.js and draw.js: floor plan shapes and draw tools, grips.js: grips, curves.js and edit.js: edit tools, walls.js: walls, doors and windows, sheets.js: view sheets, annotate.js: dimensions, leaders and hatches, blocks.js: blocks, dxf.js: DXF, SVG and PNG, cmdline.js: command line, dock.js: panels and workspaces)
ui/vendor/           Third-party libraries (PDF export)
tests/               Automated tests (tests/fixtures holds DXF files made by make_dxf.py)
tools/assemble.py    Builds ui/ into a single HTML page for testing in a browser
```

## Building without Docker

```
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o openschem .
OPENSCHEM_DATA=./data ./openschem
```

Go 1.24 or later. The server has no dependencies outside the Go standard library. The interface can also be opened without a server for development: `python3 tools/assemble.py` writes `build/openschem.html` (files then go through downloads and settings through browser storage).

## Testing

The tests open the interface in headless Chromium and exercise it end to end (placing and wiring devices, reports, floor plans, the symbol editor, macros, PDF export, file format upgrades, and the server).

```
npm install
npx playwright install chromium
npm test
```

Run a single area with `npm test -- floor` (matches test file names). The `91-server` suite builds the server, starts it with an empty data folder and tests accounts, sharing, the edit lock and conflicts through the browser, so it needs Go installed.

The server itself has its own tests: `go test ./...`

## Project file format

Projects are JSON. Each file records its format version (`ver`) and the app version that saved it. Older files are upgraded automatically when opened; files from a newer version open only after a warning. Format changes are added as steps in `ui/js/migrate.js`.

## Third-party components

- [jsPDF](https://github.com/parallax/jsPDF) (MIT), license in `ui/vendor/jspdf.LICENSE`
- [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) (MIT), license in `ui/vendor/svg2pdf.LICENSE`

## License

OpenSchem is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
