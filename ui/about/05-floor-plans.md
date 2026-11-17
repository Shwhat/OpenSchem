# Floor plans

## Levels and views

- A floor plan page shows a whole level, one room or an area.
- View sheets put several views on one page, each at its own scale with a title.
- Lengths are in feet and inches or metric for the whole project. Length fields accept `12'6"`, `12' 6 1/2"`, `150"` and `3.5 m`.

## Drawing

| Tool | Works with |
|---|---|
| Object snaps | Endpoint, midpoint, center, intersection, perpendicular, nearest, quadrant |
| Ortho and polar | F8 and F10. Both are off by default. |
| Dynamic input | F12. Boxes beside the cursor for the next values; Tab locks a value, Enter accepts. |
| Typed input | `10'`, `@12',8'`, `10'<45`, `#x,y` |
| Command line | Command names and short aliases |

- Two-point tools work by clicking each point or by pressing, dragging and releasing.
- Rectangles, polygons, circles, ellipses and arcs stay true shapes and are edited in Properties.
- Edit tools: move, copy, rotate, scale, mirror, offset, trim, extend, fillet, chamfer, break, join, explode, arrays and draw order.

## Walls, doors and windows

- Walls have presets or a custom thickness, a reference line on the center or a face, and a height.
- Doors, windows and cased openings sit in a wall and follow it. They carry tags (D1, W1) and fill the door and window schedule.
- Rooms are made by clicking inside walls.

## Dimensions, hatches and blocks

- Dimensions follow the geometry they measure. A driving dimension moves the walls, lines and room corners when a new size is typed.
- Hatches fill an area by clicking inside it, leaving islands open.
- Blocks carry attributes. PART goes on the bill of materials; LOAD with CIRCUIT adds to the circuit's load.

## Exchange

- DXF import (R12 to 2018) and export (R2000) of a level. SVG and PNG export of any page.
