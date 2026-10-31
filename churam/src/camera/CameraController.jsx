import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../core/store.js';
import { player } from '../core/shared.js';
import { getTerrain } from '../environment/terrainData.js';
import { wrapAngle, clamp } from '../core/noise.js';
import { VEHICLES } from '../config/vehicles.js';

const UP = new THREE.Vector3(0, 1, 0);
const _pos = new THREE.Vector3(), _look = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _lp = new THREE.Vector3(), _c = new THREE.Vector3();
const YFLIP = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI);

// One camera, three modes (TPP / FPP / free-look). Reads the vehicle pose from `player`; never touches vehicle state.
export default function CameraController() {
  const { camera, gl } = useThree();
  const c = useRef({ yaw: 0, y: 0, look: new THREE.Vector3(), mode: null, blend: 1, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), fov: 62, free: { yaw: 0, pitch: 0.35, dist: 9, drag: false, idle: 0 }, init: false });

  useEffect(() => {
    const el = gl.domElement, f = c.current.free;
    const down = (e) => { if (useStore.getState().cameraMode === 'free') { f.drag = true; el.setPointerCapture?.(e.pointerId); } };
    const move = (e) => { if (f.drag) { f.yaw -= e.movementX * 0.005; f.pitch = clamp(f.pitch + e.movementY * 0.004, -0.1, 1.2); f.idle = 0; } };
    const up = (e) => { f.drag = false; el.releasePointerCapture?.(e.pointerId); };
    const wheel = (e) => { if (useStore.getState().cameraMode === 'free') f.dist = clamp(f.dist + e.deltaY * 0.01, 3, 25); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('wheel', wheel, { passive: true });
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); };
  }, [gl]);

  useFrame((_, rawDt) => {
    if (!player.ready) return;
    const dt = Math.min(rawDt, 0.05), st = useStore.getState(), S = st.settings, k = c.current, T = getTerrain();
    const mode = st.cameraMode, cfg = VEHICLES[st.vehicleId];
    const speedF = clamp(Math.abs(player.speed) / cfg.maxSpeed, 0, 1);
    const distToPlayer = Math.hypot(player.pos.x - camera.position.x, player.pos.z - camera.position.z);
    if (!k.init || distToPlayer > 120) { k.yaw = player.yaw; k.y = player.pos.y + S.tppHeight + 1; k.look.copy(player.pos); k.init = true; k.mode = mode; }
    if (mode !== k.mode) { k.mode = mode; k.blend = 0; k.fromPos.copy(camera.position); k.fromQuat.copy(camera.quaternion); }   // smooth hand-over, vehicle untouched

    // heading follow (smoothed) – independent from steering input
    k.yaw += wrapAngle(player.yaw - k.yaw) * (1 - Math.exp(-4.5 * dt));
    let fov = S.fov, near = 0.25;
    if (mode === 'fpp') {
      _pos.copy(player.anchor); _pos.y += player.bounce * 0.4;
      _lp.set(Math.cos(player.yaw), player.forward.y, Math.sin(player.yaw)).normalize();       // level heading + road pitch
      _m.lookAt(_pos, _c.copy(_pos).add(_lp), UP); _q.setFromRotationMatrix(_m);
      _q2.copy(player.quat).multiply(YFLIP);                                                   // full body orientation (lean etc.)
      _q.slerp(_q2, cfg.lean ? 0.3 : 0.5);
      fov = S.fov + 6 * speedF; near = 0.1;
    } else if (mode === 'free') {
      const f = k.free; if (!f.drag) { f.idle += dt; if (f.idle > 4) f.yaw *= Math.exp(-1.5 * dt); }
      const a = k.yaw + Math.PI + f.yaw, d = f.dist;
      _pos.set(player.pos.x + Math.cos(a) * Math.cos(f.pitch) * d, player.pos.y + 1.2 + Math.sin(f.pitch) * d, player.pos.z + Math.sin(a) * Math.cos(f.pitch) * d);
      _look.copy(player.pos); _look.y += 1.2;
      _m.lookAt(_pos, _look, UP); _q.setFromRotationMatrix(_m);
    } else {
      const dist = (S.tppDistance + Math.max(0, cfg.length - 2.1) * 0.8) * (1 + 0.12 * speedF), camH = S.tppHeight + Math.max(0, cfg.height - 1.5) * 0.9;
      k.y += (player.pos.y + camH - k.y) * (1 - Math.exp(-6 * dt));
      _lp.set(player.pos.x, player.pos.y + 1.3 + (cfg.height - 1.5) * 0.4, player.pos.z);
      _pos.set(player.pos.x - Math.cos(k.yaw) * dist, k.y, player.pos.z - Math.sin(k.yaw) * dist);
      // camera collision: march from the vehicle towards the camera; stop before terrain
      let tHit = 1;
      for (let i = 1; i <= 8; i++) { const t = i / 8, x = _lp.x + (_pos.x - _lp.x) * t, z = _lp.z + (_pos.z - _lp.z) * t, y = _lp.y + (_pos.y - _lp.y) * t; if (y < T.heightAt(x, z) + 0.45) { tHit = Math.max(0.25, (i - 1.5) / 8); break; } }
      if (tHit < 1) _pos.lerpVectors(_lp, _pos, tHit);
      _pos.y = Math.max(_pos.y, T.heightAt(_pos.x, _pos.z) + 0.9);
      _look.set(player.pos.x + Math.cos(player.yaw) * Math.min(Math.abs(player.speed) * 0.12, 3.5), player.pos.y + 1.25 + (cfg.height - 1.5) * 0.4, player.pos.z + Math.sin(player.yaw) * Math.min(Math.abs(player.speed) * 0.12, 3.5));
      k.look.lerp(_look, 1 - Math.exp(-14 * dt));
      _m.lookAt(_pos, k.look, UP); _q.setFromRotationMatrix(_m);
      fov = S.fov + 11 * speedF;
    }
    // impact shake
    if (player.shake > 0.005) { _pos.x += (Math.random() - 0.5) * player.shake; _pos.y += (Math.random() - 0.5) * player.shake; }
    if (k.blend < 1) { k.blend = Math.min(1, k.blend + dt / 0.35); const e = k.blend * k.blend * (3 - 2 * k.blend); _pos.lerpVectors(k.fromPos, _pos, e); _q.slerpQuaternions(k.fromQuat, _q, e); }
    camera.position.copy(_pos); camera.quaternion.copy(_q);
    k.fov += (fov - k.fov) * (1 - Math.exp(-5 * dt));
    if (Math.abs(camera.fov - k.fov) > 0.05 || camera.near !== near) { camera.fov = k.fov; camera.near = near; camera.updateProjectionMatrix(); }
  });
  return null;
}
