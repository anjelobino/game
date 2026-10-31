import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { player } from '../core/shared.js';

// Splits instances into spatial chunks (each its own InstancedMesh) so that frustum culling works per chunk,
// and swaps near / far (LOD) meshes or hides chunks by distance. Geometry & material are shared and owned by the caller.
export default function ChunkedInstances({ items, geometry, material, lodGeometry, lodMaterial, near = 250, far = 600, cell = 150, castShadow = false, receiveShadow = false }) {
  const group = useRef();
  const chunks = useRef([]);
  const timer = useRef(1);

  useLayoutEffect(() => {
    const g = group.current, map = new Map(), list = [];
    for (const it of items) { const k = Math.floor(it.x / cell) + ':' + Math.floor(it.z / cell); if (!map.has(k)) map.set(k, []); map.get(k).push(it); }
    for (const arr of map.values()) {
      const mk = (geo, mat) => {
        const m = new THREE.InstancedMesh(geo, mat, arr.length);
        arr.forEach((it, i) => { m.setMatrixAt(i, it.m); if (it.c) m.setColorAt(i, it.c); });
        m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere(); m.matrixAutoUpdate = false; g.add(m); return m;
      };
      const hi = mk(geometry, material); hi.castShadow = castShadow; hi.receiveShadow = receiveShadow;
      let lo = null; if (lodGeometry) { lo = mk(lodGeometry, lodMaterial || material); lo.visible = false; }
      list.push({ hi, lo, c: hi.boundingSphere.center.clone(), r: hi.boundingSphere.radius });
    }
    chunks.current = list; timer.current = 1;
    return () => { for (const c of list) { g.remove(c.hi); c.hi.dispose(); if (c.lo) { g.remove(c.lo); c.lo.dispose(); } } chunks.current = []; };
  }, [items, geometry, material, lodGeometry, lodMaterial, cell, castShadow, receiveShadow]);

  useFrame((_, dt) => {
    timer.current += dt; if (timer.current < 0.25 || !player.ready) return; timer.current = 0;
    const px = player.pos.x, pz = player.pos.z;
    for (const c of chunks.current) {
      const d = Math.hypot(c.c.x - px, c.c.z - pz) - c.r;
      if (c.lo) { c.hi.visible = d < near; c.lo.visible = d >= near && d < far; } else c.hi.visible = d < far;
    }
  });
  return <group ref={group} />;
}
