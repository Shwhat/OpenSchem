# OpenSchem

A portable electrical schematic editor with structured device tagging (=Function +Location -Device), built for both industrial controls work and documenting residential wiring.

OpenSchem runs as a single Windows executable with no installation. Projects are stored as `.osp` files (JSON).

## Features

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
- Custom symbol editor with a portable user library

**Floor plans**
- Floor-plan pages per level, with whole-level, single-room and custom-area views
- Rooms drawn as boxes, shapes, round or oval rooms with automatic wall snapping, resized by dragging corners or walls, and image import for tracing
- Devices shared between schematic and floor plan, with automatic room assignment
- Circuit colors and automatically generated switch legs
- Real units: feet and inches (default) or metric per project, with a drawing scale per level (1/4" = 1', 1:50, ...). Length fields accept `12'6"`, `12' 6 1/2"`, `150"` and `3.5 m`
- Precision drafting: object snaps (endpoint, midpoint, center, intersection, perpendicular, nearest, quadrant) with markers, ortho and polar tracking (F3, F8, F10), typed lengths and coordinates while drawing (`10'`, `@12',8'`, `10'<45`, `#x,y`), window (left to right) and crossing (right to left) selection
- Draw tools on floor plans: line, polyline (line and tangent arc segments, start and end widths), arc (3 points or center, start, end), circle (radius, diameter, 2 points, 3 points), ellipse, regular polygon (inscribed, circumscribed or by edge), rectangle with rounded or cut corners, spline and text, all with snaps and typed lengths
- Grips on selected shapes and devices: drag or click-click to stretch, Space cycles through move, rotate, scale and mirror, with copies and typed angles or factors
- Shape properties (color, line width, line type, fill, layer, sizes) and Make room to turn a closed shape into a room
- Edit tools on floor plans: move, copy, rotate, scale (with reference), mirror, offset, trim, extend, fillet and chamfer (lines, walls and polyline corners), break, break at point, join, explode, rectangular, polar and path arrays, and draw order. They work on shapes, walls, rooms and devices (copied devices get new tags)
- Walls with presets (2x4 interior 4.5", 2x6 exterior 6.5", mobile home 2x3 interior 3.5" and 2x4 exterior 4.5") or a custom thickness, the reference line on the center or either face, clean mitered corners and tees, and a stored height for elevations
- Doors (single, double, pocket, bifold, sliding, garage), windows and cased openings placed in walls; they follow their wall, carry tags (D1, W1) and fill a door and window schedule report
- Rooms made by clicking inside walls, and view sheets that put several views of floor plans (whole level, a room or an area) on one page, each at its own scale with a title
- Dimensions (linear, aligned, angular, radius, diameter) that follow the geometry they measure, dimension styles (text size, units, precision, architectural ticks or arrowheads), and leaders
- Hatching by clicking inside an area (solid, diagonal, crosshatch, dots, brick, concrete, wood, insulation), with islands left open
- Blocks with attributes: a starter library of furniture, plumbing fixtures, appliances and mechanical equipment in the data folder, your own blocks, and project copies of every block used. PART goes on the bill of materials; LOAD with CIRCUIT adds to the circuit's load calculation
- DXF import (ASCII, R12 to 2018) onto a floor plan level, DXF export (R2000) of a level, and SVG or PNG export of any page
- Optional command line with command names and short aliases (RM, RS, ZE, UNDO, OSNAP, ...)
- Dockable panels (Pages, Devices, Symbols, To-do, Properties): float, dock left, right or bottom, stack as tabs, resize, and save arrangements as named workspaces (Schematic, Floor plan, Home wiring, Reports built in)

**Panel layout**
- Panel layout pages drawn to scale, with the enclosure, DIN rails, wire ducts and device footprints sized from the parts database

**Parts and loads**
- Parts database in the data folder (part number, manufacturer, description, category, technical data, price, watts, datasheet, size) with search, CSV import and export, and a picker in device properties
- Load calculation per circuit with editable defaults, percent of breaker rating, 80% warning in the project check, and voltage drop from wire size and run length with a 3% warning
- Printable breaker labels: panel directory in the two-column door layout, letter page or 4 × 6 in label

**Reports**
- Cover sheet and table of contents
- Panel schedule with load, percent of rating and voltage drop, bill of materials with manufacturer, prices and total cost, terminal diagrams, connection list, cable overview and cable diagrams, revision overview
- CSV and Excel (.xlsx) export, Excel import that updates existing devices by ID, and vector PDF export with bookmarks and clickable cross-references; PDF export and printing let you choose the pages

**Project tools**
- Revision tracking with title block marking
- Project check (missing main functions, duplicate connection points, open interruption points)
- To-do list with items linked to devices and pages
- Engineering and homeowner display modes, light and dark themes
- Customizable tabbed ribbon

## Demo project

Help > Open demo project opens one project that uses every feature (pump station control panel, home wiring, floor plans, panel layout, note card page and more). It is built by `ui/js/demo.js` from the two building blocks in `ui/js/demo-industrial.js` and `ui/js/demo-home.js`. When a feature is added, add it to the demo and to the coverage test in `tests/suites/05-demo.mjs`.

## Data storage

OpenSchem stores settings, the user symbol and macro library, the parts database (parts.json), the block library (blocks.json), saved workspaces and autosave data in an `OpenSchem Data` folder next to the executable. If that location is not writable, it uses `%LOCALAPPDATA%\OpenSchem`.

## Requirements

- Windows 10 (21H2 or later) or Windows 11
- Microsoft Edge WebView2 Runtime (included with current Windows versions)

## Project layout

```
main_windows.go      Windows host: window, file dialogs, data folder, close prompt
win32_windows.go     Windows API helpers
ui/index.html        Page skeleton
ui/style.css         All styles, including dark theme
ui/manifest.txt      Script load order (used by the exe, the tests and tools/assemble.py)
ui/js/               Application code, one file per area (navigator.js: page tree and thumbnails, layers.js: layers, units.js: lengths and scale, osnap.js: snaps, shapes.js and draw.js: floor plan shapes and draw tools, grips.js: grips, curves.js and edit.js: edit tools, walls.js: walls, doors and windows, sheets.js: view sheets, annotate.js: dimensions, leaders and hatches, blocks.js: blocks, dxf.js: DXF, SVG and PNG, cmdline.js: command line, dock.js: panels and workspaces)
ui/vendor/           Third-party libraries (PDF export)
tests/               Automated tests (tests/fixtures holds DXF files made by make_dxf.py)
tools/assemble.py    Builds ui/ into a single HTML page for testing in a browser
```

## Building

```
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H windowsgui -s -w" -o OpenSchem.exe .
```

The interface can also be run in any browser for development: `python3 tools/assemble.py` writes `build/openschem.html`.

## Testing

The tests open the interface in headless Chromium and exercise it end to end (placing and wiring devices, reports, floor plans, the symbol editor, macros, PDF export, file format upgrades).

```
npm install
npx playwright install chromium
npm test
```

Run a single area with `npm test -- floor` (matches test file names).

## Project file format

Projects are JSON. Each file records its format version (`ver`) and the app version that saved it. Older files are upgraded automatically when opened; files from a newer version open only after a warning. Format changes are added as steps in `ui/js/migrate.js`.

## Third-party components

- [go-webview2](https://github.com/jchv/go-webview2) (MIT)
- [jsPDF](https://github.com/parallax/jsPDF) (MIT), license in `ui/vendor/jspdf.LICENSE`
- [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) (MIT), license in `ui/vendor/svg2pdf.LICENSE`

## License

OpenSchem is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
