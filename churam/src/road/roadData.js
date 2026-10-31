// Pure road model: one continuous Catmull-Rom spline sampled at fixed spacing.
// No React / rendering here, so physics, rendering, collision and scenery all share it.
import * as THREE from 'three';
import { ROAD_CONFIG, HAIRPIN_COUNT } from '../config/road.js';
import { mulberry32, clamp, wrapAngle, smoothstep } from '../core/noise.js';

export function generatePath(cfg) {
  const pts = [];
  const marks = { hairpins: [], view: 0 };
  let x = 0, y = 0, z = 0, a = 0;
  const push = () => pts.push(new THREE.Vector3(x, y, z));
  push();
  const straight = (len, grade, wob = cfg.wobble) => {
    const segs = Math.max(2, Math.round(len / 26)), l = len / segs;
    for (let i = 0; i < segs; i++) {
      const d = wob && i < segs - 1 ? wob * Math.sin(i * 1.7 + len) : 0;
      x += Math.cos(a + d) * l; z += Math.sin(a + d) * l; y += grade * l; push();
    }
  };
  // sign +1 turns right (increasing heading), -1 left. returns control-point index of the apex
  const arc = (sign, R, grade, angle, step) => {
    const nx = -Math.sin(a), nz = Math.cos(a);
    const cx = x + sign * R * nx, cz = z + sign * R * nz;
    const n = Math.max(1, Math.round(angle / step));
    const a0 = a; let apex = pts.length;
    for (let k = 1; k <= n; k++) {
      const aa = a0 + sign * angle * (k / n);
      x = cx + sign * R * Math.sin(aa); z = cz - sign * R * Math.cos(aa);
      y += grade * (R * angle / n); push();
      if (k === Math.round(n / 2)) apex = pts.length - 1;
    }
    a = a0 + sign * angle;
    return apex;
  };
  // Adivaram approach
  straight(60, 0.01, 0); arc(1, 80, 0.012, 0.5, 0.125); straight(50, 0.015, 0); arc(-1, 80, 0.014, 0.5, 0.125);
  straight(cfg.leadIn, cfg.climbGrade * 0.6, 0);
  // nine hairpins (alternating right / left with compound entry & exit S-curves)
  for (let i = 0; i < HAIRPIN_COUNT; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    // Sweeping entry transition curve (eases into the hairpin)
    arc(-sign, 50, cfg.hairpinGrade * 0.7, 0.20, 0.10);
    // Deep 203° curved hairpin bend
    marks.hairpins.push(arc(sign, cfg.hairpinRadius, cfg.hairpinGrade, Math.PI + 0.40, Math.PI / 14));
    // Sweeping exit transition curve
    arc(-sign, 50, cfg.hairpinGrade * 0.7, 0.20, 0.10);
    if (i < HAIRPIN_COUNT - 1) straight(cfg.legLengths[i], cfg.climbGrade, cfg.wobble);
  }
  // Lakkidi
  straight(50, 0.05, 0); marks.view = pts.length - 1;
  straight(110, 0.04, 0);
  arc(1, 100, 0.03, 0.7, 0.1); arc(-1, 100, 0.03, 0.7, 0.1);
  straight(100, 0.02);
  arc(-1, 120, 0.02, 0.5, 0.125); arc(1, 120, 0.02, 0.5, 0.125);
  straight(180, 0.012, 0); // Vythiri
  return { pts, marks };
}

export function buildRoad(cfg = ROAD_CONFIG) {
  const { pts, marks } = generatePath(cfg);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = pts.length * 40;
  const length = curve.getLength();
  const n = Math.floor(length / cfg.sampleSpacing) + 1;
  const ds = length / (n - 1);
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = curve.getPointAt(i / (n - 1)); px[i] = p.x; py[i] = p.y; pz[i] = p.z; }
  const tx = new Float32Array(n), tz = new Float32Array(n), rx = new Float32Array(n), rz = new Float32Array(n);
  const grade = new Float32Array(n), heading = new Float32Array(n), kappa = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    const dx = px[i1] - px[i0], dz = pz[i1] - pz[i0], dy = py[i1] - py[i0], hl = Math.hypot(dx, dz);
    tx[i] = dx / hl; tz[i] = dz / hl; rx[i] = -tz[i]; rz[i] = tx[i]; grade[i] = dy / hl; heading[i] = Math.atan2(tz[i], tx[i]);
  }
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 2), i1 = Math.min(n - 1, i + 2);
    kappa[i] = wrapAngle(heading[i1] - heading[i0]) / ((i1 - i0) * ds);
  }
  // banking: outside edge higher. bank = dy per metre of lateral (+right)
  let bank = new Float32Array(n);
  for (let i = 0; i < n; i++) bank[i] = -clamp(kappa[i] * cfg.bankK, -cfg.maxBank, cfg.maxBank);
  for (let pass = 0; pass < 2; pass++) {
    const b2 = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -6; k <= 6; k++) { const j = i + k; if (j >= 0 && j < n) { s += bank[j]; c++; } } b2[i] = s / c; }
    bank = b2;
  }
  const nearestPt = (v) => { let b = 0, bd = 1e18; for (let i = 0; i < n; i++) { const d = (px[i] - v.x) ** 2 + (pz[i] - v.z) ** 2; if (d < bd) { bd = d; b = i; } } return b; };
  const hairpins = marks.hairpins.map((ci, k) => ({
    id: k + 1,
    index: nearestPt(pts[ci]),
    x: pts[ci].x,
    z: pts[ci].z,
    turnSign: (k % 2 === 0 ? 1 : -1), // +1: right-hand turn, -1: left-hand turn
  }));
  const iv = nearestPt(pts[marks.view]);
  const vp = cfg.viewpoint;
  const viewpoint = { i0: iv, i1: iv + Math.round(vp.length / ds), depth: vp.depth, taper: Math.round(vp.taper / ds) };
  const hw = cfg.halfWidth;
  const latMaxR = new Float32Array(n).fill(hw + cfg.barrierOffset), latMaxL = new Float32Array(n).fill(hw + cfg.barrierOffset);
  const benchR = new Float32Array(n).fill(cfg.bench);
  // Extra curve widening at hairpin bends to accommodate long vehicle turning radius
  marks.hairpins.forEach((ci) => {
    const hpIdx = nearestPt(pts[ci]);
    for (let k = -26; k <= 26; k++) {
      const idx = hpIdx + k;
      if (idx >= 0 && idx < n) {
        const f = Math.exp(-0.5 * ((k / 11) ** 2));
        latMaxR[idx] += f * 0.85;
        latMaxL[idx] += f * 0.85;
        benchR[idx] += f * 1.8;
      }
    }
  });
  for (let i = viewpoint.i0; i <= viewpoint.i1 && i < n; i++) {
    const f = smoothstep(0, 1, Math.min(1, (i - viewpoint.i0) / viewpoint.taper, (viewpoint.i1 - i) / viewpoint.taper));
    latMaxR[i] = hw + cfg.barrierOffset + f * viewpoint.depth;
    benchR[i] = cfg.bench + f * (viewpoint.depth + 3);
  }
  const rnd = mulberry32(cfg.seed || 5);
  const bump = new Float32Array(n);
  let bv = 0; for (let i = 0; i < n; i++) { bv += (rnd() - 0.5) * 0.5; bv *= 0.8; bump[i] = bv * 0.05; }
  const CELL = 16, grid = new Map();
  const key = (cx, cz) => (cx + 4096) * 8192 + (cz + 4096);
  for (let i = 0; i < n; i++) { const k = key(Math.floor(px[i] / CELL), Math.floor(pz[i] / CELL)); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(i); }
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < n; i++) { minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]); minZ = Math.min(minZ, pz[i]); maxZ = Math.max(maxZ, pz[i]); minY = Math.min(minY, py[i]); maxY = Math.max(maxY, py[i]); }

  const road = {
    cfg, n, ds, length, halfWidth: hw, lane: cfg.lane, px, py, pz, tx, tz, rx, rz, grade, heading, kappa, bank, latMaxR, latMaxL, benchR, bump,
    hairpins, viewpoint, bounds: { minX, maxX, minZ, maxZ, minY, maxY }, startIndex: 8, finishIndex: n - 8,
    nearestIndex(x, z) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let r = 1; r < 60; r++) {
        let best = -1, bd = Infinity;
        for (let gx = cx - r; gx <= cx + r; gx++) for (let gz = cz - r; gz <= cz + r; gz++) {
          const l = grid.get(key(gx, gz)); if (!l) continue;
          for (const i of l) { const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
        }
        if (best >= 0 && Math.sqrt(bd) <= r * CELL) return best;
      }
      return 0;
    },
    makeProj: () => ({ i: 0, u: 0, lat: 0, lon: 0, heading: 0, tx: 1, tz: 0, rx: 0, rz: 1, gx: 0, gz: 0, y: 0, yc: 0 }),
    project(out, x, z, hint) {
      let best = 0;
      if (hint < 0) best = this.nearestIndex(x, z);
      else {
        let bd = Infinity;
        const lo = Math.max(0, hint - 16), hi = Math.min(n - 1, hint + 16);
        for (let i = lo; i <= hi; i++) { const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2; if (d < bd) { bd = d; best = i; } }
        if (bd > 1600) best = this.nearestIndex(x, z);
      }
      const dx = x - px[best], dz = z - pz[best];
      const lon = dx * tx[best] + dz * tz[best];
      const lat = dx * rx[best] + dz * rz[best];
      out.i = best; out.lon = lon; out.lat = lat; out.u = best + lon / ds;
      out.heading = heading[best]; out.tx = tx[best]; out.tz = tz[best]; out.rx = rx[best]; out.rz = rz[best];
      const b = bank[best], g = grade[best];
      out.gx = g * tx[best] + b * rx[best]; out.gz = g * tz[best] + b * rz[best];
      out.yc = py[best] + g * lon;
      out.y = out.yc + b * clamp(lat, -hw, hw);
      return out;
    },
    pointAt(i, lat, out) {
      i = clamp(i | 0, 0, n - 1);
      out.x = px[i] + rx[i] * lat; out.z = pz[i] + rz[i] * lat;
      out.y = py[i] + bank[i] * clamp(lat, -hw, hw);
      return out;
    },
    lanePose(u, lat, out) {
      u = clamp(u, 0, n - 1.001); const i = Math.floor(u), f = u - i, j = i + 1;
      const x0 = px[i] + rx[i] * lat, z0 = pz[i] + rz[i] * lat, x1 = px[j] + rx[j] * lat, z1 = pz[j] + rz[j] * lat;
      out.x = x0 + (x1 - x0) * f; out.z = z0 + (z1 - z0) * f;
      out.y = py[i] + (py[j] - py[i]) * f + bank[i] * clamp(lat, -hw, hw);
      out.heading = heading[i] + wrapAngle(heading[j] - heading[i]) * f; out.grade = grade[i];
      return out;
    },
    bumpAt(u) { u = clamp(u, 0, n - 2.001); const i = Math.floor(u), f = u - i; return bump[i] + (bump[i + 1] - bump[i]) * f; },
    influence(x, z, out) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      let dmin = Infinity, bi = -1, sw = 0, sy = 0;
      for (let gx = cx - 3; gx <= cx + 3; gx++) for (let gz = cz - 3; gz <= cz + 3; gz++) {
        const l = grid.get(key(gx, gz)); if (!l) continue;
        for (const i of l) {
          const dx = px[i] - x, dz = pz[i] - z, d2 = dx * dx + dz * dz;
          if (d2 < dmin) { dmin = d2; bi = i; }
          if (d2 < 2025) { const w = 1 / (d2 * d2 + 1e-3); sw += w; sy += w * py[i]; }
        }
      }
      out.d = bi < 0 ? Infinity : Math.sqrt(dmin); out.y = sw > 0 ? sy / sw : 0; out.i = bi;
      out.bench = bi >= 0 ? benchR[bi] : cfg.bench;
      return out;
    },
    hairpinState(u, out) {
      let cur = 0, inside = false;
      for (const h of hairpins) {
        if (Math.abs(u - h.index) <= 24) { cur = h.id; inside = true; break; }
        if (u > h.index) cur = h.id;
      }
      out.current = cur; out.inside = inside; return out;
    },
  };
  return road;
}

export const ROAD = buildRoad(ROAD_CONFIG);
