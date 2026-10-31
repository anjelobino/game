// Deterministic fixed-step vehicle simulation (pure JS, no rendering).
// The vehicle owns exactly ONE state object and exactly ONE function mutates it: stepVehicle().
import { clamp, wrapAngle } from './noise.js';

export const FIXED_DT = 1 / 120;
const G = 9.81;
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));

export function createVehicleState(cfg, road) {
  const s = {
    x: 0, z: 0, y: 0, yaw: 0, v: 0, steer: 0, steerIn: 0,
    lean: 0, leanVel: 0, gx: 0, gz: 0, slopeF: 0, slopeR: 0,
    sp: { bounce: 0, bounceV: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0 },
    hint: -1, u: 0, lat: 0, rel: 0, aLat: 0, aLong: 0, throttle: 0, brake: 0, ebrake: 0,
    impact: 0, hitCount: 0, wobble: 0, stun: 0, slip: 0, t: 0, finished: false,
    proj: road.makeProj(),
  };
  placeOnRoad(s, road, road.startIndex, -road.lane);
  return s;
}

export function placeOnRoad(s, road, index, lat) {
  const i = clamp(Math.round(index), 2, road.n - 3);
  s.x = road.px[i] + road.rx[i] * lat; s.z = road.pz[i] + road.rz[i] * lat; s.yaw = road.heading[i];
  s.v = 0; s.steer = 0; s.steerIn = 0; s.lean = 0; s.leanVel = 0; s.wobble = 0; s.stun = 0; s.impact = 0; s.aLat = 0; s.aLong = 0;
  s.sp.bounce = s.sp.bounceV = s.sp.pitch = s.sp.pitchV = s.sp.roll = s.sp.rollV = 0;
  s.hint = -1; road.project(s.proj, s.x, s.z, -1); applyProj(s, s.proj); s.hint = s.proj.i;
}

function applyProj(s, p) { s.u = p.u; s.lat = p.lat; s.y = p.y; s.gx = p.gx; s.gz = p.gz; }

export function stepVehicle(s, inp, cfg, road, env, dt) {
  s.t += dt;
  const av = Math.abs(s.v);
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  s.slopeF = s.gx * fx + s.gz * fz; s.slopeR = -s.gx * fz + s.gz * fx;
  const wet = env.wetGrip;
  const stun = s.stun > 0; if (stun) s.stun -= dt;
  const control = s.finished ? { steer: 0, throttle: 0, brake: 1, ebrake: false } : inp;

  // --- steering: input ramp -> steering angle (speed-limited) -> bicycle model
  const tgtIn = control.steer;
  const flip = tgtIn !== 0 && Math.sign(tgtIn) !== Math.sign(s.steerIn);
  s.steerIn = approach(s.steerIn, tgtIn, (tgtIn === 0 ? 5 : 2.2 * cfg.steerSensitivity) * (flip ? 2 : 1) * dt);
  let maxSteer = cfg.maxSteer / (1 + (av / cfg.steerFalloff) ** 2);
  if (stun) maxSteer *= 0.6;
  s.steer = approach(s.steer, s.steerIn * maxSteer, cfg.steerResponse * dt);

  // --- longitudinal
  let a = -G * s.slopeF / Math.sqrt(1 + s.slopeF * s.slopeF);
  const thr = control.throttle, br = control.brake;
  let brakeDec = 0;
  if (thr > 0 && s.v > -0.5) { const f = Math.max(0, s.v) / cfg.maxSpeed; a += cfg.accel * thr * (1 - f * f) * (stun ? 0.5 : 1); }
  if (control.ebrake) brakeDec = cfg.brake * 1.4;
  else if (br > 0 && thr === 0) {
    if (s.v > 0.4) brakeDec = cfg.brake * br;
    else if (s.v > -cfg.reverseSpeed) a -= cfg.accel * 0.45 * br;
  }
  a -= cfg.drag * s.v * av;
  if (thr === 0 && br === 0 && !control.ebrake) a -= Math.sign(s.v) * cfg.coast * Math.min(1, av);
  const hillHold = av < 0.6 && thr === 0 && br === 0;
  const vPrev = s.v;
  if (hillHold) s.v = approach(s.v, 0, 3 * dt); else s.v += a * dt;
  if (brakeDec > 0 && s.v > 0) s.v = Math.max(0, s.v - brakeDec * (0.55 + 0.45 * wet) * dt);
  s.v = clamp(s.v, -cfg.reverseSpeed, cfg.maxSpeed * 1.1);
  s.aLong += ((s.v - vPrev) / dt - s.aLong) * Math.min(1, dt * 8);

  // --- yaw with grip limit (understeer when pushing too hard, worse in the wet)
  const L = cfg.wheelBase;
  let tanD = Math.tan(s.steer);
  const grip = cfg.grip * wet * (control.ebrake ? 0.8 : 1) * (stun ? 0.7 : 1);
  s.slip = 0;
  if (av > 0.5 && Math.abs(s.v * s.v * tanD / L) > grip) { tanD = Math.sign(tanD) * grip * L / (s.v * s.v); s.slip = 1; }
  const yawRate = s.v * tanD / L;
  s.yaw += yawRate * dt;
  s.aLat = s.v * yawRate;
  s.x += Math.cos(s.yaw) * s.v * dt; s.z += Math.sin(s.yaw) * s.v * dt;

  // --- road projection + barrier collision (analytic, deterministic)
  const p = s.proj; road.project(p, s.x, s.z, s.hint); s.hint = p.i;
  const rel = wrapAngle(s.yaw - p.heading); s.rel = rel;
  const ext = cfg.width / 2 * Math.abs(Math.cos(rel)) + cfg.length / 2 * Math.abs(Math.sin(rel));
  const limR = road.latMaxR[p.i], limL = -road.latMaxL[p.i];
  let pen = 0, dir = 0;
  if (p.lat + ext > limR) { pen = p.lat + ext - limR; dir = 1; } else if (p.lat - ext < limL) { pen = limL - (p.lat - ext); dir = -1; }
  if (pen > 0) {
    s.x -= p.rx * pen * dir; s.z -= p.rz * pen * dir;
    const vx = Math.cos(s.yaw) * s.v, vz = Math.sin(s.yaw) * s.v;
    const vt = vx * p.tx + vz * p.tz, vn = vx * p.rx + vz * p.rz;
    if (vn * dir > 0) {
      const impact = vn * dir;
      const nvt = vt * (1 - Math.min(0.5, 0.04 + impact * 0.03)), nvn = -vn * 0.12;
      const nvx = nvt * p.tx + nvn * p.rx, nvz = nvt * p.tz + nvn * p.rz, sp = Math.hypot(nvx, nvz);
      if (sp > 0.5) { const dy = Math.atan2(nvz, nvx) + (s.v < 0 ? Math.PI : 0); s.yaw += wrapAngle(dy - s.yaw) * 0.6; s.v = Math.sign(s.v || 1) * sp; }
      else s.v *= 0.3;
      registerImpact(s, cfg, impact, dir);
    }
  }
  // route ends are soft walls
  if (p.i <= 0 && p.lon < -3) { s.x += p.tx * (-3 - p.lon); s.z += p.tz * (-3 - p.lon); if (s.v < 0) s.v = 0; }
  if (p.i >= road.n - 1 && p.lon > 3) { s.x -= p.tx * (p.lon - 3); s.z -= p.tz * (p.lon - 3); s.v = Math.min(s.v, 0); }
  road.project(p, s.x, s.z, s.hint); s.hint = p.i; applyProj(s, p);
  if (!s.finished && s.u >= road.finishIndex) s.finished = true;

  // --- leaning (bikes) and suspension (all)
  if (cfg.lean) {
    const l = cfg.lean;
    const target = clamp(Math.atan(s.aLat / G) * l.factor, -l.max, l.max) * (s.v > 0 ? 1 : 0.3);
    if (s.wobble > 0.01) { s.leanVel += Math.sin(s.t * 24) * s.wobble * 18 * dt; s.wobble *= Math.exp(-2.4 * dt); }
    s.leanVel += (l.k * (target - s.lean) - l.c * s.leanVel) * dt;
    s.lean = clamp(s.lean + s.leanVel * dt, -l.max * 1.25, l.max * 1.25); // can never flip
  }
  const sp = s.sp, k = cfg.susp.k, c = 2 * cfg.susp.zeta * Math.sqrt(k);
  const bump = road.bumpAt(s.u) * Math.min(1, av / 8) * cfg.susp.bump;
  sp.bounceV += (k * (bump - sp.bounce) - c * sp.bounceV) * dt; sp.bounce += sp.bounceV * dt;
  const pT = -s.aLong * cfg.susp.pitchGain + bump * 0.3, rT = -s.aLat * cfg.susp.rollGain;
  sp.pitchV += (k * (pT - sp.pitch) - c * sp.pitchV) * dt; sp.pitch += sp.pitchV * dt;
  sp.rollV += (k * (rT - sp.roll) - c * sp.rollV) * dt; sp.roll += sp.rollV * dt;

  s.impact *= Math.exp(-3 * dt);
  s.throttle = thr; s.brake = Math.max(br, control.ebrake ? 1 : 0); s.ebrake = control.ebrake ? 1 : 0;
}

function registerImpact(s, cfg, impact, dir) {
  s.impact = Math.max(s.impact, impact); s.hitCount++;
  if (impact > 11) s.v *= 0.5;
  if (cfg.lean) { s.wobble = Math.max(s.wobble, clamp(impact / 9, 0.15, 1)); if (impact > 6) s.stun = 0.9; s.leanVel += -dir * impact * 0.25; }
}

// Called when Rapier reports overlap with another vehicle (traffic). other = {x,z,mass}
export function contactVehicle(s, cfg, other, dt, first) {
  const dx = s.x - other.x, dz = s.z - other.z, d = Math.hypot(dx, dz) || 1;
  const k = clamp(other.mass / (cfg.mass + other.mass), 0.25, 0.95);
  s.x += (dx / d) * 4 * dt; s.z += (dz / d) * 4 * dt;
  s.v *= 1 - Math.min(0.9, 3 * k * dt);
  if (first) { registerImpact(s, cfg, Math.abs(s.v) * k + 2, Math.sign(dx * s.proj.rx + dz * s.proj.rz) || 1); s.v *= 0.6; }
}

export function gearOf(s, cfg) {
  if (s.v < -0.3) return 'R';
  if (Math.abs(s.v) < 0.6 && s.throttle === 0) return 'N';
  if (cfg.gears === 0) return 'D';
  const f = clamp(s.v / cfg.maxSpeed, 0, 0.999);
  return String(1 + Math.floor(Math.pow(f, 0.8) * cfg.gears * 0.999));
}
