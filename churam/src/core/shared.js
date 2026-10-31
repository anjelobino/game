// Mutable per-frame state shared between systems. Deliberately NOT React state:
// writing here every frame never triggers re-renders. The HUD samples `telemetry` at 10 Hz.
import * as THREE from 'three';

export const player = {
  ready: false, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), levelQuat: new THREE.Quaternion(),
  anchor: new THREE.Vector3(), forward: new THREE.Vector3(1, 0, 0), yaw: 0, speed: 0, u: 0, bounce: 0, shake: 0, lean: 0,
  brake: 0, steer: 0,
};
export const telemetry = {
  speedKmh: 0, gear: 'N', hairpin: 0, inHairpin: false, hairpinEvent: 0, distance: 0, total: 0, progress: 0, time: 0,
  x: 0, z: 0, yaw: 0, u: 0, impactId: 0, impact: 0, finished: false, started: false, slip: false,
};
export const contacts = new Map();   // Rapier handle -> {body, mass}
export const flags = { resetRequested: false };
export const clock = { game: 0 };
export const weatherState = {
  fogColor: new THREE.Color('#8d9aa3'), fogDensity: 0.004, skyTop: new THREE.Color(), skyHorizon: new THREE.Color(), sunColor: new THREE.Color(),
  sun: 0.2, ambient: 0.6, rain: 0.7, wet: 0.8, cloud: 1, dark: 0.4,
};
export const adaptive = { shadowsOff: false };
