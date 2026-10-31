// Procedural low-poly geometries, merged into single vertex-coloured meshes (1 draw call per type).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
function part(g, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  E.set(rx, ry, rz); Q.setFromEuler(E); M.compose(new THREE.Vector3(x, y, z), Q, new THREE.Vector3(sx, sy, sz));
  if (g.index) g = g.toNonIndexed();
  g.applyMatrix4(M);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv');
  return g;
}
const merge = (parts) => { const g = mergeGeometries(parts, false); parts.forEach((p) => p.dispose()); return g; };

export function makePalm() {
  const p = [part(new THREE.CylinderGeometry(0.14, 0.24, 8, 6), 0x6b5236, 0, 4, 0, 0.06, 0, 0.04)];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    p.push(part(new THREE.BoxGeometry(0.5, 0.06, 3.6), i % 2 ? 0x2f6a2a : 0x3b7a30, Math.cos(a) * 1.5, 8.1, Math.sin(a) * 1.5, 0.45, -a + Math.PI / 2, 0));
  }
  p.push(part(new THREE.SphereGeometry(0.28, 5, 4), 0x4a3a22, 0, 7.8, 0));
  return merge(p);
}
export function makeBroadleaf() {
  return merge([
    part(new THREE.CylinderGeometry(0.22, 0.4, 4.2, 6), 0x5a432d, 0, 2.1, 0),
    part(new THREE.IcosahedronGeometry(2.6, 0), 0x2a5a26, 0, 5.4, 0, 0, 0, 0, 1, 0.85, 1),
    part(new THREE.IcosahedronGeometry(1.9, 0), 0x37702f, 1.5, 4.5, 0.6),
    part(new THREE.IcosahedronGeometry(1.7, 0), 0x1f4a22, -1.3, 4.9, -0.8),
  ]);
}
export function makeTall() {
  return merge([
    part(new THREE.CylinderGeometry(0.2, 0.35, 8, 6), 0x6a5a48, 0, 4, 0),
    part(new THREE.ConeGeometry(2.4, 4.2, 6), 0x234d24, 0, 8, 0),
    part(new THREE.ConeGeometry(1.9, 3.6, 6), 0x2d5e2b, 0, 10, 0),
    part(new THREE.ConeGeometry(1.3, 3, 6), 0x38702f, 0, 11.8, 0),
  ]);
}
export const makeFarTree = () => merge([part(new THREE.ConeGeometry(2.6, 10, 4), 0x2a5a2a, 0, 5.5, 0)]);
export function makeRock() {
  const g = new THREE.DodecahedronGeometry(1, 0), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = 0.8 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.4; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
  g.computeVertexNormals(); return g;
}
export const makeBush = () => new THREE.IcosahedronGeometry(1, 0);
export function makePole() {
  return merge([
    part(new THREE.CylinderGeometry(0.1, 0.16, 9, 5), 0x8d8a85, 0, 4.5, 0),
    part(new THREE.BoxGeometry(2.4, 0.12, 0.12), 0x4a4540, 0, 8.6, 0),
    part(new THREE.BoxGeometry(0.1, 0.35, 0.1), 0xdddddd, -1.0, 8.8, 0), part(new THREE.BoxGeometry(0.1, 0.35, 0.1), 0xdddddd, 0, 8.8, 0), part(new THREE.BoxGeometry(0.1, 0.35, 0.1), 0xdddddd, 1.0, 8.8, 0),
  ]);
}
export function makeShop() {
  return merge([
    part(new THREE.BoxGeometry(4.4, 2.6, 3.4), 0xffffff, 0, 1.3, 0),
    part(new THREE.BoxGeometry(5.0, 0.18, 4.0), 0x4b3a2c, 0, 2.7, 0, 0.12, 0, 0),
    part(new THREE.BoxGeometry(3.2, 1.2, 0.1), 0x2a2018, 0, 1.2, 1.72),
    part(new THREE.BoxGeometry(4.0, 0.7, 0.12), 0xf1d27a, 0, 2.35, 1.8),
    part(new THREE.BoxGeometry(1.2, 0.8, 0.8), 0xc7512f, 1.4, 0.4, 2.3),
  ]);
}
export function makeConeGeo() { return merge([part(new THREE.ConeGeometry(0.2, 0.62, 10), 0xff6a1a, 0, 0.33, 0), part(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 8), 0xffffff, 0, 0.25, 0, 0, 0, 0, 1.3, 1, 1.3), part(new THREE.BoxGeometry(0.42, 0.04, 0.42), 0x222222, 0, 0.02, 0)]); }
