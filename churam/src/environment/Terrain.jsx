import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getTerrain } from './terrainData.js';
import { fbm, smoothstep } from '../core/noise.js';
import { ROAD } from '../road/roadData.js';

export default function Terrain({ receiveShadow }) {
  const geo = useMemo(() => {
    const T = getTerrain(), { nx, nz, cell, minX, minZ, H, colors } = T;
    const pos = new Float32Array(nx * nz * 3);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) { const i = iz * nx + ix; pos[i * 3] = minX + ix * cell; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = minZ + iz * cell; }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let k = 0;
    for (let iz = 0; iz < nz - 1; iz++) for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} receiveShadow={receiveShadow} />;
}

// Distant Western-Ghats ridges: one big displaced disc, fogged out.
export function Mountains() {
  const geo = useMemo(() => {
    const T = getTerrain(), cx = (ROAD.bounds.minX + ROAD.bounds.maxX) / 2, cz = (ROAD.bounds.minZ + ROAD.bounds.maxZ) / 2;
    const size = 9000, seg = 110, g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx, z = p.getZ(i) + cz, r = Math.hypot(x - cx, z - cz);
      const rise = smoothstep(750, 2200, r), n = fbm(x * 0.0012, z * 0.0012, 5);
      const h = T.edgeY + rise * (120 + n * 900) * (0.4 + 0.6 * smoothstep(0.3, 0.7, n));
      p.setXYZ(i, p.getX(i) + cx, h, p.getZ(i) + cz);
      const t = Math.min(1, (h - T.edgeY) / 600);
      col[i * 3] = 0.16 + t * 0.2; col[i * 3 + 1] = 0.3 + t * 0.12; col[i * 3 + 2] = 0.2 + t * 0.2;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}
