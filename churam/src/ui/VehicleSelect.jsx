import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../core/store.js';
import { VEHICLE_LIST, VEHICLES, minTurnRadius } from '../config/vehicles.js';
import { buildVehicleModel } from '../vehicles/VehicleModels.js';
import { audio } from '../core/audio.js';

function Preview({ id }) {
  const cfg = VEHICLES[id], rig = useMemo(() => { const r = buildVehicleModel(cfg); r.rider.visible = true; r.cockpit.visible = false; return r; }, [cfg]);
  const g = useRef();
  useEffect(() => () => rig.dispose(), [rig]);
  useFrame((_, dt) => { g.current.rotation.y += dt * 0.6; });
  const scale = cfg.kind === 'bus' ? 0.5 : 1.35;
  return (
    <>
      <ambientLight intensity={0.8} /><directionalLight position={[4, 6, 3]} intensity={2.4} /><directionalLight position={[-4, 2, -3]} intensity={0.8} color="#88aaff" />
      <group ref={g} scale={scale} position={[0, cfg.kind === 'bus' ? -0.9 : -0.6, 0]}><primitive object={rig.root} /></group>
      <mesh rotation-x={-Math.PI / 2} position={[0, cfg.kind === 'bus' ? -0.9 : -0.6, 0]}><circleGeometry args={[3.2, 40]} /><meshStandardMaterial color="#1b2a30" roughness={1} /></mesh>
    </>
  );
}

const Bar = ({ label, frac, text }) => <div className="bar"><span style={{ textAlign: 'left', color: 'var(--dim)' }}>{label}</span><div><i style={{ width: Math.round(frac * 100) + '%' }} /></div><span>{text}</span></div>;

export default function VehicleSelect() {
  const id = useStore((s) => s.vehicleId), select = useStore((s) => s.selectVehicle), start = useStore((s) => s.startGame), goto = useStore((s) => s.goto);
  const v = VEHICLES[id];
  return (
    <div className="screen">
      <h2 style={{ margin: 0, letterSpacing: '.2em', position: 'relative', zIndex: 1 }}>CHOOSE YOUR RIDE</h2>
      <div className="select-wrap">
        <div className="preview"><Canvas key={id} camera={{ position: [4.2, 2.3, 5.2], fov: 38 }} dpr={[1, 1.5]} gl={{ antialias: true }}><Preview id={id} /></Canvas></div>
        <div className="panel">
          <div className="vtabs">{VEHICLE_LIST.map((x) => <button key={x.id} className={'vtab' + (x.id === id ? ' on' : '')} onClick={() => select(x.id)}>{x.name}</button>)}</div>
          <div style={{ color: 'var(--dim)', fontSize: 14, minHeight: 40 }}>{v.tagline}</div>
          <div className="bars">
            <Bar label="Top speed" frac={v.maxSpeed / 36} text={Math.round(v.maxSpeed * 3.6) + ' km/h'} />
            <Bar label="Acceleration" frac={v.accel / 4.5} text={v.accel.toFixed(1) + ' m/s²'} />
            <Bar label="Braking" frac={v.brake / 8.5} text={v.brake.toFixed(1) + ' m/s²'} />
            <Bar label="Agility" frac={Math.min(1, (v.steerResponse * v.steerSensitivity) / 3.6)} text={v.steerResponse.toFixed(1) + ' rad/s'} />
            <Bar label="Turning radius" frac={1 - Math.min(1, minTurnRadius(v) / 14)} text={minTurnRadius(v).toFixed(1) + ' m'} />
            <Bar label="Mass" frac={Math.min(1, Math.log10(v.mass) / 4)} text={v.mass + ' kg'} />
          </div>
        </div>
      </div>
      <div className="stack" style={{ flexDirection: 'row' }}>
        <button className="btn" onClick={() => goto('menu')}>BACK</button>
        <button className="btn primary" onClick={() => { audio.init(); start(); }}>DRIVE</button>
      </div>
    </div>
  );
}
