import { useEffect, useMemo } from 'react';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { ROAD } from '../road/roadData.js';
import { makeConeGeo } from '../environment/geometries.js';

// Knock-over traffic cones at the hairpin entrances – dynamic Rapier bodies resting on the road collider.
export default function Cones() {
  const { geo, mat, spots } = useMemo(() => {
    const spots = [], t = {};
    ROAD.hairpins.forEach((h) => { for (const [off, lat] of [[-26, -3.1], [-24, -3.1], [-22, -3.1], [-26, 3.1], [-24, 3.1]]) { const i = h.index + off; ROAD.pointAt(i, lat, t); spots.push([t.x, t.y + 0.34, t.z]); } });
    return { geo: makeConeGeo(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), spots };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return (
    <>
      {spots.map((p, i) => (
        <RigidBody key={i} position={p} name="cone" colliders={false} mass={3} linearDamping={0.6} angularDamping={0.5} canSleep>
          <CylinderCollider args={[0.31, 0.16]} />
          <mesh geometry={geo} material={mat} position={[0, -0.34, 0]} castShadow />
        </RigidBody>
      ))}
    </>
  );
}
