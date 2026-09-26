# FRC 9427 Simulator — Design Plan (draft for review)

## Goals
- Runs the team's real robot Java code (WPILib sim) — behaviour follows the code, controls read from code bindings.
- Full 2026 REBUILT field (official STEP CAD), robots, Fuel physics, official scoring (rules configurable), opponents (AI later).
- Installable desktop app (Electron); phones/tablets play through the browser; later nationwide online rooms (free tier first).

## Architecture (3 layers, so online can be added later)
1. **Sim core** (Java, robot code + Sim IO, plus physics: field collisions, Fuel, scoring) — authoritative state @50 Hz.
2. **Bridge** (Node): HALSim WebSocket <-> browser; serves the web UI; later relays to online rooms (Cloudflare free tier).
3. **Front-end** (three.js + plain UI): field/robot rendering, menus, input (keyboard, gamepad, touch joysticks).

## Field first (milestone 1, no gameplay features)
- STEP -> meshes (occt-import-js) -> glTF/JSON, official dimensions (game-specific drawings sheet).
- Elements: carpet, perimeter walls, Hub x2 (funnel+net), Depot x2, Outpost x2, Tower x2, Bumps, Trenches, AprilTags, alliance-coloured lines/zones.
- Lighting/materials pass (PBR, soft shadows), cameras: orbit, follow, driver-station, top-down.

## UI (learned from a game main menu: few big categories, drill-down subpages, no clutter)
Left vertical menu with accent bar:
- **PLAY** (Match / Practice / Auto test / Online) — big neon "START" button bottom-right
- **ROBOT** (Model, Code bindings, Physical params)
- **FIELD** (Rules, Fuel count, Lighting, Camera)
- **CONTROLS** (auto-read bindings, Keyboard / Gamepad / Touch mapping)
- **SETTINGS** (Graphics, Audio, Network)
Palette: FRC — deep navy background, FIRST blue #0066B3, alliance blue/red, warm white text, one accent.

## Later milestones
2 robot + drivetrain + bindings panel; 3 Fuel physics + scoring; 4 opponent AI; 5 Onshape robot model; 6 online rooms; 7 installer (`npm run dist`).

## Open questions
- Online: authoritative server needs to run sim per room; free tier limits => start with peer-relay, robot code local.
- Touch UI layout for tablets.
