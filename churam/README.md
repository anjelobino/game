# CHURAM – Thamarassery Ghat Road Simulator

A playable 3D driving game: **Adivaram → 9 hairpin bends → Lakkidi → Vythiri** (≈2.4 km, one continuous spline).
React + Vite + Three.js + React Three Fiber + Drei + Rapier (+ postprocessing on High).

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build -> dist/
npm run test:sim     # headless regression: bots drive every vehicle through the whole route + crash-abuse test
```

## Controls
W/↑ accelerate · S/↓ brake & reverse · A/D ←/→ steer · Space emergency brake · **C** TPP/FPP · **V** free-look (drag mouse, wheel zoom) · **R** reset onto road · **P/Esc** pause · **H** toggle HUD. Touch buttons appear on touch devices.

## Files
| File | Purpose |
|---|---|
| `src/App.jsx`, `main.jsx` | Screen switching + global hotkeys only |
| `src/config/road.js` | **Editable road**: radius, grades, leg lengths, width, lane, viewpoint |
| `src/config/vehicles.js` | **Per-vehicle handling**: max speed, accel, brake, steer sensitivity/response, mass, wheelbase (turning radius), grip, suspension, lean |
| `src/config/graphics.js`, `weather.js` | Low/Medium/High presets; Sunny/Cloudy/Rainy/Fog presets |
| `src/road/roadData.js` | Pure road model: Catmull-Rom spline, sampling, banking, projection, hairpin detection |
| `src/road/Road.jsx` | Asphalt mesh (canvas texture, wet look), yellow/white markings, view-point platform, instanced crash barriers |
| `src/road/RoadCollider.jsx` | Separate simplified Rapier trimesh collider for the road |
| `src/environment/terrainData.js`, `Terrain.jsx` | Heightfield hugging the road + distant Ghats ridges |
| `src/environment/sceneryData.js`, `Scenery.jsx`, `ChunkedInstances.jsx` | Procedural trees/bushes/rocks/poles/wires/shops; per-chunk instancing, frustum culling and near/far LOD |
| `src/environment/Signs.jsx` | Numbered hairpin boards, warning signs, ads, gateway arches |
| `src/core/vehicleSim.js` | **Deterministic fixed-step (120 Hz) vehicle model** – the only code that mutates vehicle state |
| `src/core/input.js` | keydown/keyup tracking, blur/visibility clearing, single listener set, scroll prevention, touch input |
| `src/core/store.js`, `shared.js` | UI state (zustand) vs. per-frame mutable state (no re-renders) |
| `src/core/audio.js` | WebAudio engine / rain / impact sounds |
| `src/vehicles/Vehicle.jsx` | Runs the sim, interpolates render pose, drives Rapier kinematic body, lights, wheels |
| `src/vehicles/VehicleModels.js` | Procedural placeholder models (bus, Bullet, Splendor, Scooty, traffic) |
| `src/vehicles/Traffic.jsx`, `Cones.jsx` | Pooled AI traffic (Rapier colliders) and knock-over cones (dynamic bodies) |
| `src/camera/CameraController.jsx` | TPP (smoothed, terrain collision), FPP (rider eye), free-look, blended mode switching |
| `src/weather/Weather.jsx` | Preset blending, sky dome, clouds, lights/shadows, reflections, GPU rain (single draw call) |
| `src/game/Game.jsx` | Canvas, Physics, adaptive resolution / shadow fallback, post-processing |
| `src/ui/*` | Main menu, vehicle select (3D preview), settings, HUD, minimap, pause, mobile controls, finish |
| `scripts/*.mjs` | Headless tests and diagnostics |

## Design notes
- **Physics split**: vehicle dynamics are a deterministic bicycle model with grip limit (understeer / sliding in the wet), slope gravity, banking, spring suspension and lean, stepped at a fixed 120 Hz with render interpolation. Barrier contact is resolved analytically against the spline (scrape, speed loss, wobble/stun for bikes). **Rapier** handles vehicle-vs-traffic collisions, knock-over cones and the road collision mesh. Bikes' lean is hard-limited, so they cannot flip.
- **Performance**: instanced + chunked scenery with LOD, one rain draw call, merged geometries, shared materials, no per-frame allocation in hot loops, telemetry sampled by the HUD at 10 Hz, dynamic pixel ratio with automatic shadow fallback.
- **Own models**: set `glb` handling in `VehicleModels.js` (`buildVehicleModel`) – keep origin at the ground below the wheelbase centre, +Z forward; register wheels in `rig.wheels`, steering parts in `rig.steer`.
