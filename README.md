# OpenSchem

A portable electrical schematic editor with structured device tagging (=Function +Location -Device), built for both industrial controls work and documenting residential wiring.

OpenSchem runs as a single Windows executable with no installation. Projects are stored as `.osp` files (JSON).

## Features

**Schematics**
- Multi-page A3 sheets with column grid and title block
- IEC-style symbol library (coils, contacts, protection, motors, PLC I/O, terminals, interruption points) plus residential symbols (breakers, switches, dimmers, outlets, lights, fans, detectors, panels)
- Device tagging with =Function +Location -Device, automatic device and contact numbering, contact mirrors and cross-references
- Orthogonal wiring with rubber-banding, junction dots and automatic wire numbering per potential
- Symbol variants A to H (rotation and mirroring)
- Cables with conductor assignment
- Macros for reusable circuit blocks
- Custom symbol editor with a portable user library

**Floor plans**
- Floor-plan pages per level, with whole-level, single-room and custom-area views
- Rooms drawn as boxes or shapes with automatic wall snapping, and image import for tracing
- Devices shared between schematic and floor plan, with automatic room assignment
- Circuit colors and automatically generated switch legs

**Reports**
- Cover sheet and table of contents
- Panel schedule, bill of materials, terminal diagrams, connection list, cable overview and cable diagrams, revision overview
- CSV export and vector PDF export with bookmarks and clickable cross-references

**Project tools**
- Revision tracking with title block marking
- Project check (missing main functions, duplicate connection points, open interruption points)
- To-do list with items linked to devices and pages
- Engineering and homeowner display modes, light and dark themes
- Customizable tabbed ribbon

## Data storage

OpenSchem stores settings, the user symbol and macro library, and autosave data in an `OpenSchem Data` folder next to the executable. If that location is not writable, it uses `%LOCALAPPDATA%\OpenSchem`.

## Requirements

- Windows 10 (21H2 or later) or Windows 11
- Microsoft Edge WebView2 Runtime (included with current Windows versions)

## Building

The application is a Go host (`main_windows.go`) that embeds the web interface in `ui/`.

```
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H windowsgui -s -w" -o OpenSchem.exe .
```

## Third-party components

- [go-webview2](https://github.com/jchv/go-webview2) (MIT)
- [jsPDF](https://github.com/parallax/jsPDF) (MIT), license in `ui/vendor/jspdf.LICENSE`
- [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) (MIT), license in `ui/vendor/svg2pdf.LICENSE`

## License

OpenSchem is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
