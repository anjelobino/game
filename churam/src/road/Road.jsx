import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD } from './roadData.js';
import { weatherState } from '../core/shared.js';
import { mulberry32, clamp } from '../core/noise.js';
import ChunkedInstances from '../environment/ChunkedInstances.jsx';
import { getTerrain } from '../environment/terrainData.js';

// ---------- VISUAL road geometry (collision lives in RoadCollider.jsx, decoration in Barriers) ----------
function asphaltTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), R = mulberry32(3);
  g.fillStyle = '#6a6a6c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const v = 70 + R() * 70; g.fillStyle = `rgba(${v},${v},${v + 3},0.55)`; g.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2); }
  for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(25,25,25,0.25)'; g.lineWidth = 1; g.beginPath(); let x = R() * 256, y = R() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function buildSurface(road) {
  const hw = road.halfWidth, sh = road.cfg.shoulder, cols = [-hw - sh, -hw, -hw / 2, 0, hw / 2, hw, hw + sh], nc = cols.length, n = road.n;
  const pos = new Float32Array(n * nc * 3), uv = new Float32Array(n * nc * 2), col = new Float32Array(n * nc * 3), idx = [], tmp = {};
  for (let i = 0; i < n; i++) for (let j = 0; j < nc; j++) {
    const lat = cols[j]; road.pointAt(i, lat, tmp); const k = i * nc + j, edge = Math.abs(lat) > hw;
    pos.set([tmp.x, tmp.y + (edge ? -0.03 : 0), tmp.z], k * 3); uv.set([(lat + hw + sh) / (2 * (hw + sh)), i * road.ds / 7], k * 2);
    const c = edge ? 0.78 : 1; col.set([c, c * 0.98, c * 0.95], k * 3);
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
// one merged geometry for centre double-yellow + white edge lines (vertex coloured)
function buildMarkings(road) {
  const hw = road.halfWidth, n = road.n, pos = [], col = [], idx = [], tmp = {};
  const strip = (lat, w, color) => {
    const c = new THREE.Color(color), base = pos.length / 3;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) { road.pointAt(i, lat + s * w / 2, tmp); pos.push(tmp.x, tmp.y + 0.035, tmp.z); col.push(c.r, c.g, c.b); }
    for (let i = 0; i < n - 1; i++) { const a = base + i * 2, b = a + 1, c2 = a + 2, d = a + 3; idx.push(a, b, c2, b, d, c2); }
  };
  strip(-0.13, 0.11, 0xe6b800); strip(0.13, 0.11, 0xe6b800);
  strip(-(hw - 0.3), 0.16, 0xf2f2f2); strip(hw - 0.3, 0.16, 0xf2f2f2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildPlatform(road) {
  const { i0, i1 } = road.viewpoint, hw = road.halfWidth, pos = [], idx = [], tmp = {}, uv = [];
  for (let i = i0; i <= i1; i++) for (const lat of [hw + 0.55, road.latMaxR[i]]) { road.pointAt(i, hw, tmp); const r = road.rx[i] * lat, q = road.rz[i] * lat; pos.push(road.px[i] + r, road.py[i] + road.bank[i] * hw - 0.05, road.pz[i] + q); uv.push(lat * 0.2, i * 0.4); }
  for (let k = 0; k < i1 - i0; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export default function Road({ shadowsOn }) {
  const res = useMemo(() => {
    const tex = asphaltTexture();
    const surf = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.92, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const mark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const plat = new THREE.MeshStandardMaterial({ map: tex, color: 0xb8b4aa, roughness: 0.9 });
    return { tex, surf, mark, plat, gSurf: buildSurface(ROAD), gMark: buildMarkings(ROAD), gPlat: buildPlatform(ROAD) };
  }, []);
  useEffect(() => () => { Object.values(res).forEach((o) => o.dispose?.()); }, [res]);
  // wet asphalt: roughness falls, colour darkens, reflections strengthen
  useFrame(() => {
    const w = weatherState.wet, m = res.surf;
    if (Math.abs(m._wet - w) > 0.005 || m._wet === undefined) {
      m._wet = w; m.roughness = 0.92 - 0.68 * w; m.metalness = 0.05 + 0.2 * w; m.envMapIntensity = 0.35 + 1.4 * w; m.color.setScalar(1 - 0.42 * w);
      res.mark.roughness = 0.7 - 0.45 * w; res.mark.envMapIntensity = 0.3 + 1.0 * w;
    }
  });
  return (
    <group>
      <mesh geometry={res.gSurf} material={res.surf} receiveShadow={shadowsOn} />
      <mesh geometry={res.gMark} material={res.mark} />
      <mesh geometry={res.gPlat} material={res.plat} receiveShadow={shadowsOn} />
      <Barriers shadowsOn={shadowsOn} />
    </group>
  );
}

// ---------- Roadside crash barriers: instanced rails + posts, chunked & distance culled ----------
function Barriers({ shadowsOn }) {
  const res = useMemo(() => {
    const road = ROAD, rails = [], posts = [], terr = getTerrain();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), tmp = {};
    const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
    for (const side of [-1, 1]) for (let i = 0; i < road.n - 2; i += 2) {
      const lat = side > 0 ? road.latMaxR[i] : -road.latMaxL[i];
      road.pointAt(i, lat, tmp);
      const j = Math.min(road.n - 1, i + 2); const dx = road.px[j] + road.rx[j] * (side > 0 ? road.latMaxR[j] : -road.latMaxL[j]) - (tmp.x), dz = road.pz[j] + road.rz[j] * (side > 0 ? road.latMaxR[j] : -road.latMaxL[j]) - tmp.z;
      const hl = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dz, dx);
      bx.set(dx / hl, road.grade[i], dz / hl).normalize(); by.set(0, 1, 0); bz.crossVectors(bx, by).normalize(); by.crossVectors(bz, bx).normalize();
      m.makeBasis(bx, by, bz); q.setFromRotationMatrix(m);
      p.set(tmp.x + dx / 2, tmp.y + 0.62, tmp.z + dz / 2); rails.push({ x: p.x, z: p.z, m: new THREE.Matrix4().compose(p, q, s) });
      p.set(tmp.x, tmp.y + 0.4, tmp.z); posts.push({ x: p.x, z: p.z, m: new THREE.Matrix4().compose(p, q, s) });
    }
    const railGeo = new THREE.BoxGeometry(2.1, 0.3, 0.07), postGeo = new THREE.BoxGeometry(0.12, 0.85, 0.12);
    // the W-beam is drawn on the road-side; add a second thinner rail for the "W" look
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc7cbcd, roughness: 0.45, metalness: 0.7 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x7a5a44, roughness: 0.8, metalness: 0.3 });
    return { rails, posts, railGeo, postGeo, railMat, postMat };
  }, []);
  useEffect(() => () => { res.railGeo.dispose(); res.postGeo.dispose(); res.railMat.dispose(); res.postMat.dispose(); }, [res]);
  return (
    <>
      <ChunkedInstances items={res.rails} geometry={res.railGeo} material={res.railMat} near={260} far={260} cell={120} castShadow={shadowsOn} />
      <ChunkedInstances items={res.posts} geometry={res.postGeo} material={res.postMat} near={160} far={160} cell={120} />
    </>
  );
}
