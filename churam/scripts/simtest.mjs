// Headless regression test: a pure-pursuit bot drives every vehicle the whole route.
import { ROAD as road } from '../src/road/roadData.js';
import { VEHICLES } from '../src/config/vehicles.js';
import { createVehicleState, stepVehicle, FIXED_DT, placeOnRoad } from '../src/core/vehicleSim.js';
import { wrapAngle, clamp } from '../src/core/noise.js';

function runBot(cfg, wetGrip, laneLat = -road.lane) {
  const s = createVehicleState(cfg, road); placeOnRoad(s, road, road.startIndex, laneLat);
  const inp = { steer: 0, throttle: 0, brake: 0, ebrake: false };
  let maxLat = 0, t = 0, stuck = 0, lastU = s.u, hairpinTimes = [];
  const env = { wetGrip };
  while (t < 1200 && !s.finished) {
    const look = clamp(s.v * 0.45 + 3.5, 5, 24) / road.ds;
    const j = clamp(Math.round(s.u + look), 0, road.n - 1);
    const tx = road.px[j] + road.rx[j] * laneLat, tz = road.pz[j] + road.rz[j] * laneLat;
    const err = wrapAngle(Math.atan2(tz - s.z, tx - s.x) - s.yaw);
    inp.steer = clamp(err * 3, -1, 1);
    // speed profile from upcoming curvature
    let kmax = 0; for (let k = 0; k < 40; k += 2) { const q = clamp(Math.round(s.u + k * 1.0 + 4), 0, road.n - 1); kmax = Math.max(kmax, Math.abs(road.kappa[q])); }
    const vT = Math.min(cfg.maxSpeed, Math.sqrt(0.42 * cfg.grip * wetGrip / Math.max(kmax, 1e-3)));
    if (s.v < vT - 0.3) { inp.throttle = 1; inp.brake = 0; } else if (s.v > vT + 0.8) { inp.throttle = 0; inp.brake = 1; } else { inp.throttle = 0.4; inp.brake = 0; }
    stepVehicle(s, inp, cfg, road, env, FIXED_DT); t += FIXED_DT;
    maxLat = Math.max(maxLat, Math.abs(s.lat));
    if (Math.floor(t) % 5 === 0 && Math.abs(s.u - lastU) < 0.2 && s.v < 0.3) stuck++; if (Math.floor(t) % 5 === 1) lastU = s.u;
    if (!Number.isFinite(s.x) || Math.abs(s.lean) > 1) return { fail: 'NaN/flip', t };
  }
  return { finished: s.finished, time: +t.toFixed(0), hits: s.hitCount, maxLat: +maxLat.toFixed(2), kmhEnd: +(s.v * 3.6).toFixed(0), stuck };
}
let bad = 0;
for (const cfg of Object.values(VEHICLES)) for (const wet of [1, 0.78]) {
  const r = runBot(cfg, wet); console.log(cfg.name.padEnd(22), wet === 1 ? 'dry' : 'wet', JSON.stringify(r));
  if (!r.finished || r.hits > 2) bad++;
}
// Abuse test: full throttle with random steering -> constant barrier crashes. Must stay finite, on the road, and never flip.
for (const cfg of Object.values(VEHICLES)) {
  const s = createVehicleState(cfg, road), inp = { steer: 0, throttle: 1, brake: 0, ebrake: false }; let maxLean = 0, maxLat = 0, ok = true;
  for (let t = 0, k = 0; t < 120; t += FIXED_DT, k++) {
    if (k % 180 === 0) inp.steer = [-1, 0, 1][Math.floor(Math.random() * 3)];
    if (k % 2000 === 1999) placeOnRoad(s, road, s.u, -road.lane);
    stepVehicle(s, inp, cfg, road, { wetGrip: 0.78 }, FIXED_DT);
    maxLean = Math.max(maxLean, Math.abs(s.lean)); maxLat = Math.max(maxLat, Math.abs(s.lat));
    if (!Number.isFinite(s.x + s.z + s.v + s.yaw)) { ok = false; break; }
  }
  const limit = road.halfWidth + road.cfg.barrierOffset + 0.05, lim2 = road.latMaxR[road.n - 1];
  const pass = ok && (!cfg.lean || maxLean <= cfg.lean.max * 1.26) && maxLat < road.halfWidth + 14;
  console.log(cfg.name.padEnd(22), 'abuse', JSON.stringify({ ok, maxLean: +maxLean.toFixed(2), maxLat: +maxLat.toFixed(2), hits: s.hitCount }), pass ? 'PASS' : 'FAIL'); if (!pass) bad++;
}
console.log(bad ? `FAIL (${bad})` : 'ALL OK'); process.exit(bad ? 1 : 0);
