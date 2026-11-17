# Overview

OpenSchem is an electrical design program for industrial control panels and residential wiring, with floor plans, building framing, decks and tile layouts in the same project. It runs on a server in Docker and is used from a web browser.

| Area | What it holds |
|---|---|
| **Schematics** | Schematic, single-line and pneumatic pages with devices tagged =Function +Location -Device, wires, cables, terminals and PLC cards |
| **Home wiring** | Circuits, breakers, panel schedules, loads, voltage drop and breaker labels |
| **Floor plans** | Levels with walls, doors, windows, rooms, devices, dimensions, blocks and view sheets |
| **Panel layouts** | Enclosures drawn to scale with DIN rails, wire ducts and device footprints |
| **Framing and decks** | Small buildings, framed walls and decks with their framing drawings, lumber lists and 3D views |
| **Tile layouts** | Floors and walls laid out in tile, with cut lists and tile orders |
| **Reports** | Generated and custom reports, PDF, Excel, CSV and DXF output |

## Principles

1. **No dependence on the internet.** OpenSchem runs entirely on the local network. Nothing is loaded from outside servers.
2. **Own branding only.** The program shows only OpenSchem branding.
3. **Bundled assets.** Fonts, scripts, symbols and styles ship with the program.
4. **One project, one file.** A project is a single `.osp` file that can be downloaded and imported on any OpenSchem server.
5. **One standard per project.** Each project uses IEC 60617 or NFPA 79, chosen when it is created.
6. **Suggestions, not approvals.** Framing, deck and tile sizes follow published tables and common practice. The local building department has the final say.

## In this guide

| Page | Covers |
|---|---|
| [Capabilities](/about/capabilities) | What OpenSchem can do today, and what is planned |
| [Schematics](/about/schematics) | Pages, devices, tags, wires, cables, standards and pneumatics |
| [Home wiring](/about/home-wiring) | Circuits, breakers, loads, voltage drop and labels |
| [Floor plans](/about/floor-plans) | Levels, drafting tools, walls, rooms, dimensions and blocks |
| [Framing](/about/framing) | Buildings and framed walls, splicing, lumber and building views |
| [Decks](/about/decks) | Deck kinds, span tables, decking, stairs, guards and hardware |
| [Tile layouts](/about/tile-layouts) | Surfaces, patterns, cuts and tile orders |
| [Reports and output](/about/reports) | Generated and custom reports, export and import |
| [Accounts and sharing](/about/accounts) | Sign-in, projects on the server, sharing, editing and storage |
| [Technical](/about/technical) | Architecture, updates and third-party components |
| [Release notes](/about/release-notes) | What changed in each update |
