// Heightfield terrain that hugs the road (flat "bench" around it, mountain / valley elsewhere).
import { ROAD } from '../road/roadData.js';
import { fbm, smoothstep } from '../core/noise.js';

let cached = null;
export function getTerrain() {
  if (cached) return cached;
  const road = ROAD, b = road.bounds, cell = 5, margin = 260;
  const minX = b.minX - margin, maxX = b.maxX + margin, minZ = b.minZ - margin, maxZ = b.maxZ + margin;
  const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
  const H = new Float32Array(nx * nz), D = new Float32Array(nx * nz);
  // mean road height by z (the hillside rises along +z)
  const bin = 8, nb = Math.ceil((b.maxZ - b.minZ) / bin) + 1;
  const sum = new Float64Array(nb), cnt = new Float64Array(nb);
  for (let i = 0; i < road.n; i++) { const k = Math.floor((road.pz[i] - b.minZ) / bin); sum[k] += road.py[i]; cnt[k]++; }
  const prof = new Float32Array(nb).fill(NaN);
  for (let k = 0; k < nb; k++) if (cnt[k]) prof[k] = sum[k] / cnt[k];
  for (let k = 0; k < nb; k++) if (Number.isNaN(prof[k])) {
    let l = k - 1, r = k + 1; while (l >= 0 && Number.isNaN(prof[l])) l--; while (r < nb && Number.isNaN(prof[r])) r++;
    prof[k] = l < 0 ? prof[r] : r >= nb ? prof[l] : prof[l] + (prof[r] - prof[l]) * (k - l) / (r - l);
  }
  const yz = (z) => {
    const t = (z - b.minZ) / bin;
    if (t < 0) return prof[0] + t * bin * 0.28;
    if (t >= nb - 1) return prof[nb - 1] + (t - (nb - 1)) * bin * 0.22;
    const i = Math.floor(t); return prof[i] + (prof[i + 1] - prof[i]) * (t - i);
  };
  const edgeY = b.minY - 60, out = { d: 0, y: 0, i: 0, bench: 11 };
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = minX + ix * cell, z = minZ + iz * cell;
    let g = yz(z) + 30 * (fbm(x * 0.0045 + 11, z * 0.0045 - 7) - 0.45) + 9 * (fbm(x * 0.02, z * 0.02) - 0.5);
    g -= Math.max(0, b.minX - 20 - x, x - b.maxX - 20) * 0.35;
    road.influence(x, z, out);
    let h = g;
    if (out.d < Infinity) { const w = 1 - smoothstep(out.bench, out.bench + 38, out.d); h = g * (1 - w) + (out.y - 0.45) * w; }
    const ed = Math.min(ix, nx - 1 - ix, iz, nz - 1 - iz) * cell, f = smoothstep(0, 110, ed);
    H[iz * nx + ix] = edgeY + (h - edgeY) * f; D[iz * nx + ix] = out.d - out.bench;
  }
  const heightAt = (x, z) => {
    const fx = (x - minX) / cell, fz = (z - minZ) / cell;
    if (fx < 0 || fz < 0 || fx >= nx - 1 || fz >= nz - 1) return edgeY;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, i = iz * nx + ix;
    return (H[i] * (1 - tx) + H[i + 1] * tx) * (1 - tz) + (H[i + nx] * (1 - tx) + H[i + nx + 1] * tx) * tz;
  };
  const slopeAt = (x, z) => { const e = 3; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); };
  // vertex colours
  const colors = new Float32Array(nx * nz * 3);
  const c = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  const dark = c(0x1f4020), light = c(0x3f6a2a), rock = c(0x6b6558), dirt = c(0x5b4a36), moss = c(0x2d5a2b);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const i = iz * nx + ix, x = minX + ix * cell, z = minZ + iz * cell;
    const gx = (H[iz * nx + Math.min(nx - 1, ix + 1)] - H[iz * nx + Math.max(0, ix - 1)]) / (2 * cell);
    const gz = (H[Math.min(nz - 1, iz + 1) * nx + ix] - H[Math.max(0, iz - 1) * nx + ix]) / (2 * cell);
    const slope = Math.hypot(gx, gz), n = fbm(x * 0.05, z * 0.05);
    let col = [0, 1, 2].map((k) => dark[k] + (light[k] - dark[k]) * n);
    const m = fbm(x * 0.012 + 40, z * 0.012) > 0.55 ? 0.5 : 0; if (m) col = col.map((v, k) => v + (moss[k] - v) * m);
    const r = smoothstep(0.55, 0.95, slope); col = col.map((v, k) => v + (rock[k] - v) * r);
    if (D[i] < 4) { const dd = 1 - smoothstep(0, 4, D[i]); col = col.map((v, k) => v + (dirt[k] - v) * dd * 0.85); }
    colors[i * 3] = col[0]; colors[i * 3 + 1] = col[1]; colors[i * 3 + 2] = col[2];
  }
  cached = { nx, nz, cell, minX, minZ, maxX, maxZ, H, colors, edgeY, heightAt, slopeAt, bounds: { minX, maxX, minZ, maxZ } };
  return cached;
}
