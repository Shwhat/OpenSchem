# Schematics

## Pages

| Page type | Use |
|---|---|
| Schematic | Control and power circuits, with wire numbers and the connection list |
| Single-line | Power distribution in one line per circuit. No wire numbers, not in the connection list. |
| Pneumatic | ISO 1219 symbols. The Connection tool draws tubes. |
| Panel layout | The enclosure drawn to scale |

- Each page has a paper size, or uses the project's default size.
- The page tree shows sections in the order set in Project properties.

## Device tags

- A device is identified by =Function +Location -Device, for example =M01+CP1-K1.
- All symbols with the same full tag are one device. Its contacts show mirrors and cross-references to the coil.
- Devices are numbered per letter within each function and location, in page and column order.
- A single-line symbol with the same tag as a multi-line symbol is the same device and is counted once on the bill of materials.

## Standards

| Standard | Device letters |
|---|---|
| IEC 60617 | K, S, Q, F, B, M, P, T, U, X and others |
| NFPA 79 | CR, M, TR, PB, SS, LS, PRS, PS, CB, MCP, DISC, FU, OL, MTR, PL, SOL and others |

- The standard is chosen in the New project dialog and cannot be changed later.
- Symbols of the other standard can be shown in the palette and placed.
- When pasted content, a copied page or a macro uses the other standard, a list shows each symbol and what it becomes, with Convert to project standard or Keep as is. A device is renamed only when its tag uses the standard letter.

## Wires and cables

- Connections run at right angles with junction dots. Wire numbers are given per potential and can be locked.
- Facing connection points connect automatically when a symbol is placed or moved. This can be turned off.
- Cables hold conductors assigned to connections.

## Pneumatics

- Valves have actuators set in the properties: solenoid, spring, pilot, lever, push button or none, with an optional detent.
- A valve solenoid on an electrical page carries the valve's tag and cross-references the valve. Two solenoids are numbered A1/A2 and A3/A4.
- Each tube has a number, outside diameter, color, length and part number. Tubes with a part number are on the bill of materials.
