import { useMemo } from 'react';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import { ROAD } from './roadData.js';

// Simplified collision mesh (every 4 m, slightly wider than the visual road) for Rapier dynamic props.
export default function RoadCollider() {
  const { verts, tris } = useMemo(() => {
    const step = 2, rows = [], hw = ROAD.halfWidth + 1.2, v = [], t = [];
    for (let i = 0; i < ROAD.n; i += step) rows.push(i);
    if (rows[rows.length - 1] !== ROAD.n - 1) rows.push(ROAD.n - 1);
    rows.forEach((i) => { for (const lat of [-hw, 0, hw]) { const x = ROAD.px[i] + ROAD.rx[i] * lat, z = ROAD.pz[i] + ROAD.rz[i] * lat; v.push(x, ROAD.py[i] + ROAD.bank[i] * Math.max(-ROAD.halfWidth, Math.min(ROAD.halfWidth, lat)), z); } });
    for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < 2; c++) { const a = r * 3 + c, b = a + 1, cc = a + 3, d = cc + 1; t.push(a, b, cc, b, d, cc); }
    return { verts: new Float32Array(v), tris: new Uint32Array(t) };
  }, []);
  return <RigidBody type="fixed" colliders={false}><TrimeshCollider args={[verts, tris]} /></RigidBody>;
}
