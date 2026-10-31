import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { ActiveCollisionTypes } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { VEHICLES } from '../config/vehicles.js';
import { ROAD } from '../road/roadData.js';
import { buildVehicleModel } from './VehicleModels.js';
import { createVehicleState, stepVehicle, placeOnRoad, contactVehicle, gearOf, FIXED_DT } from '../core/vehicleSim.js';
import { readInput } from '../core/input.js';
import { useStore } from '../core/store.js';
import { player, telemetry, contacts, flags, clock, weatherState } from '../core/shared.js';
import { audio } from '../core/audio.js';
import { wrapAngle, clamp } from '../core/noise.js';

const _n = new THREE.Vector3(), _f = new THREE.Vector3(), _l = new THREE.Vector3(), _m = new THREE.Matrix4(), _qb = new THREE.Quaternion(), _ql = new THREE.Quaternion(), _e = new THREE.Euler(), _hp = {};

export default function Vehicle() {
  const vehicleId = useStore((s) => s.vehicleId);
  const cfg = VEHICLES[vehicleId];
  const rig = useMemo(() => buildVehicleModel(cfg), [cfg]);
  const body = useRef(), simRef = useRef(null), accRef = useRef(0), first = useRef(true), lastHorn = useRef(0);
  const inp = useRef({ steer: 0, throttle: 0, brake: 0, ebrake: false, horn: false });
  const prev = useRef({ x: 0, y: 0, z: 0, yaw: 0, lean: 0, pitch: 0, roll: 0, bounce: 0 });
  if (!simRef.current || simRef.current.cfg !== cfg) {
    const s = createVehicleState(cfg, ROAD); simRef.current = s; simRef.current.cfg = cfg;
    Object.assign(prev.current, { x: s.x, y: s.y, z: s.z, yaw: s.yaw });
    Object.assign(telemetry, { time: 0, started: false, finished: false, hairpin: 0, hairpinEvent: 0, impactId: 0 });
    contacts.clear();
    first.current = true;
  }
  useEffect(() => {
    audio.setVehicle(cfg.audio);
    return () => {
      rig.dispose();
      player.ready = false;
      contacts.clear();
    };
  }, [rig, cfg]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05), st = useStore.getState(), s = simRef.current, pv = prev.current;
    const active = !st.paused;
    if (flags.resetRequested) { flags.resetRequested = false; placeOnRoad(s, ROAD, s.u, -ROAD.lane); s.finished = false; telemetry.finished = false; st.setFinished(false); Object.assign(pv, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, lean: 0, pitch: 0, roll: 0, bounce: 0 }); }
    if (active) {
      clock.game += dt; accRef.current += dt;
      const input = readInput(inp.current), env = { wetGrip: 1 - 0.22 * weatherState.wet };
      if (input.horn && clock.game - lastHorn.current > 0.42) {
        lastHorn.current = clock.game;
        audio.horn(cfg.id);
      }
      let steps = 0;
      while (accRef.current >= FIXED_DT && steps < 10) {
        pv.x = s.x; pv.y = s.y; pv.z = s.z; pv.yaw = s.yaw; pv.lean = s.lean; pv.pitch = s.sp.pitch; pv.roll = s.sp.roll; pv.bounce = s.sp.bounce;
        for (const c of contacts.values()) { try { const t = c.body.translation(); contactVehicle(s, cfg, { x: t.x, z: t.z, mass: c.mass }, FIXED_DT, c.first); c.first = false; } catch { /* body gone */ } }
        stepVehicle(s, input, cfg, ROAD, env, FIXED_DT); accRef.current -= FIXED_DT; steps++;
      }
      if (steps === 10) accRef.current = 0;
      if (!telemetry.started && Math.abs(s.v) > 0.5) telemetry.started = true;
      if (telemetry.started && !s.finished) telemetry.time += dt;
    }
    // ---- render pose (interpolated between fixed steps => smooth at any frame rate)
    const a = active ? accRef.current / FIXED_DT : 1;
    const x = pv.x + (s.x - pv.x) * a, y = pv.y + (s.y - pv.y) * a, z = pv.z + (s.z - pv.z) * a;
    const yaw = pv.yaw + wrapAngle(s.yaw - pv.yaw) * a, lean = pv.lean + (s.lean - pv.lean) * a;
    const pitch = pv.pitch + (s.sp.pitch - pv.pitch) * a, roll = pv.roll + (s.sp.roll - pv.roll) * a, bounce = pv.bounce + (s.sp.bounce - pv.bounce) * a;
    _n.set(-s.gx, 1, -s.gz).normalize();
    _f.set(Math.cos(yaw), 0, Math.sin(yaw)); _f.addScaledVector(_n, -_f.dot(_n)).normalize();
    _l.crossVectors(_n, _f);
    _m.makeBasis(_l, _n, _f); _qb.setFromRotationMatrix(_m);
    _ql.setFromEuler(_e.set(pitch, 0, roll + lean, 'XYZ'));
    const root = rig.root;
    root.position.set(x, y + bounce, z); root.quaternion.copy(_qb).multiply(_ql);
    // wheels / steering visuals
    if (active) for (const w of rig.wheels) w.g.rotation.x += (s.v * dt) / w.r;
    for (const p of rig.steer) p.pivot.rotation.y = -s.steer * p.ratio;
    if (rig.steerWheel) rig.steerWheel.rotation.z = -s.steer * 3.2;
    const fpp = st.cameraMode === 'fpp';
    rig.rider.visible = !fpp; rig.cockpit.visible = fpp;
    // lights
    const hs = st.settings.headlights, headOn = hs === 'on' || (hs === 'auto' && (weatherState.dark > 0.25 || weatherState.rain > 0.3 || weatherState.fogDensity > 0.006));
    rig.spot.intensity = headOn ? 140 : 0; rig.head.forEach((m) => { m.emissiveIntensity = headOn ? 2.2 : 0.35; });
    rig.tail.forEach((m) => { m.emissiveIntensity = 0.3 + s.brake * 2.2 + (headOn ? 0.6 : 0); });
    // shared pose for camera / world systems
    root.updateMatrixWorld(true); rig.eye.getWorldPosition(player.anchor);
    player.pos.set(x, y + bounce, z); player.quat.copy(root.quaternion); player.levelQuat.copy(_qb);
    player.forward.set(_f.x, _f.y, _f.z); player.yaw = yaw; player.speed = s.v; player.u = s.u; player.lat = s.lat; player.bounce = bounce; player.lean = lean; player.brake = s.brake; player.steer = s.steer;
    player.width = cfg.width; player.length = cfg.length;
    player.shake = clamp(s.impact * 0.06, 0, 0.5);
    player.ready = true;
    // kinematic Rapier body mirrors the sim (collisions with traffic / props)
    if (body.current) {
      const h = cfg.height / 2; body.current.setNextKinematicTranslation({ x: x + _n.x * h, y: y + _n.y * h, z: z + _n.z * h }); body.current.setNextKinematicRotation(_qb);
    }
    // telemetry (plain object – HUD samples it, no React re-render here)
    telemetry.speedKmh = Math.abs(s.v) * 3.6; telemetry.gear = gearOf(s, cfg); telemetry.u = s.u; telemetry.distance = s.u * ROAD.ds; telemetry.total = ROAD.length;
    telemetry.progress = clamp(s.u / (ROAD.n - 1), 0, 1); telemetry.x = s.x; telemetry.z = s.z; telemetry.yaw = s.yaw; telemetry.slip = s.slip === 1; telemetry.impact = s.impact;
    ROAD.hairpinState(s.u, _hp);
    if (_hp.inside && _hp.current !== telemetry.hairpin && Math.abs(_hp.current - telemetry.hairpin) <= 1) telemetry.hairpinEvent++;
    if (_hp.current !== telemetry.hairpin) telemetry.hairpin = _hp.current; telemetry.inHairpin = _hp.inside;
    if (s.hitCount !== simRef.current._lastHit) { simRef.current._lastHit = s.hitCount; if (s.impact > 1.5) { telemetry.impactId++; audio.thud(s.impact); } }
    if (s.finished && !telemetry.finished) { telemetry.finished = true; st.setFinished(true); }
    audio.update(Math.abs(s.v) / cfg.maxSpeed, s.throttle, weatherState.rain, active);
    if (first.current) { first.current = false; st.setLoaded(true); }
  }, -10); // runs before camera & world systems so they always see this frame's pose

  const onEnter = ({ other }) => {
    const nm = other.rigidBodyObject?.name || '';
    if (nm.startsWith('traffic')) contacts.set(other.rigidBody.handle, { body: other.rigidBody, mass: parseFloat(nm.split(':')[1]) || 1000, first: true });
    else if (nm === 'cone') simRef.current.v *= 0.97;
  };
  const onExit = ({ other }) => { contacts.delete(other.rigidBody.handle); };
  return (
    <>
      <primitive object={rig.root} />
      <RigidBody ref={body} type="kinematicPosition" colliders={false} name="player" onCollisionEnter={onEnter} onCollisionExit={onExit}>
        <CuboidCollider args={[cfg.width / 2, cfg.height / 2, cfg.length / 2]} position={[0, 0, cfg.centerZ]} activeCollisionTypes={ActiveCollisionTypes.ALL} />
      </RigidBody>
    </>
  );
}
