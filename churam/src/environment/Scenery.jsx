import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import ChunkedInstances from './ChunkedInstances.jsx';
import Signs from './Signs.jsx';
import { getTerrain } from './terrainData.js';
import { buildScenery } from './sceneryData.js';
import * as G from './geometries.js';
import { GRAPHICS } from '../config/graphics.js';
import { useStore } from '../core/store.js';
import { ROAD } from '../road/roadData.js';

// Overhead power lines between poles (one LineSegments draw call)
function buildWires(poles) {
  const v = [];
  for (let k = 0; k < poles.length - 1; k++) {
    const a = poles[k], b = poles[k + 1];
    if (b.i - a.i > 20) continue;
    const ca = Math.cos(-ROAD.heading[a.i] + Math.PI / 2), sa = Math.sin(-ROAD.heading[a.i] + Math.PI / 2);
    for (const off of [-1, 0, 1]) {
      const ox = ca * off, oz = -sa * off; const ya = a.y + 8.8, yb = b.y + 8.8;
      let px = a.x + ox, py = ya, pz = a.z + oz;
      for (let s = 1; s <= 6; s++) {
        const t = s / 6, x = a.x + (b.x - a.x) * t + ox, z = a.z + (b.z - a.z) * t + oz, y = ya + (yb - ya) * t - Math.sin(t * Math.PI) * 0.7;
        v.push(px, py, pz, x, y, z); px = x; py = y; pz = z;
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return g;
}

export default function Scenery({ shadowsOn }) {
  const gfx = GRAPHICS[useStore((s) => s.settings.graphics)];
  const data = useMemo(() => buildScenery(getTerrain(), gfx.trees), [gfx.trees]);
  const res = useMemo(() => {
    const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const solid = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    const vcol = new THREE.MeshLambertMaterial({ vertexColors: true });
    const geos = { palm: G.makePalm(), broad: G.makeBroadleaf(), tall: G.makeTall(), far: G.makeFarTree(), rock: G.makeRock(), bush: G.makeBush(), pole: G.makePole(), shop: G.makeShop() };
    const wires = buildWires(data.pole); const wireMat = new THREE.LineBasicMaterial({ color: 0x1b1b1b });
    return { treeMat, solid, vcol, geos, wires, wireMat };
  }, [data]);
  useEffect(() => () => { Object.values(res.geos).forEach((g) => g.dispose()); res.wires.dispose(); res.treeMat.dispose(); res.solid.dispose(); res.vcol.dispose(); res.wireMat.dispose(); }, [res]);
  const { near, far } = gfx;
  const shopTint = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  useEffect(() => () => shopTint.dispose(), [shopTint]);
  return (
    <group>
      {['palm', 'broad', 'tall'].map((k) => (
        <ChunkedInstances key={k} items={data[k]} geometry={res.geos[k]} material={res.treeMat} lodGeometry={res.geos.far} near={near} far={far} castShadow={shadowsOn} />
      ))}
      <ChunkedInstances items={data.bush} geometry={res.geos.bush} material={res.solid} near={near * 0.6} far={near * 0.6} />
      <ChunkedInstances items={data.rock} geometry={res.geos.rock} material={res.solid} near={far} far={far} castShadow={false} />
      <ChunkedInstances items={data.pole} geometry={res.geos.pole} material={res.vcol} near={near * 1.5} far={near * 1.5} />
      <ChunkedInstances items={data.shop} geometry={res.geos.shop} material={res.vcol} near={near * 1.5} far={near * 1.5} castShadow={shadowsOn} />
      <lineSegments geometry={res.wires} material={res.wireMat} frustumCulled={false} />
      <Signs data={data} />
    </group>
  );
}
