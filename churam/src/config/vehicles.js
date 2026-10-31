// Every vehicle has its own handling – nothing is shared except the simulation code.
export const VEHICLES = {
  bus: {
    id: 'bus', name: 'KSRTC Bus', kind: 'bus',
    tagline: 'Heavy, wide, slow to turn. Rolls through every bend.',
    maxSpeed: 22, accel: 2.1, brake: 6.2, reverseSpeed: 3, drag: 0.0018, coast: 0.5,
    steerSensitivity: 0.85, steerResponse: 1.2, maxSteer: 0.52, steerFalloff: 13,
    mass: 9500, wheelBase: 5.0, grip: 6.2,
    length: 8.5, width: 2.4, height: 3.1, centerZ: -0.25, wheelRadius: 0.55,
    lean: null,
    susp: { k: 55, zeta: 0.4, rollGain: 0.017, pitchGain: 0.014, bump: 0.6 },
    gears: 6, eye: [-0.65, 2.15, 3.0], audio: { base: 38, mult: 1.1, wave: 'sawtooth' },
  },
  bullet: {
    id: 'bullet', name: 'Royal Enfield Bullet', kind: 'bike',
    tagline: 'Torquey thumper. Stable, planted, a little lazy in tight turns.',
    maxSpeed: 33, accel: 4.2, brake: 7.8, reverseSpeed: 2, drag: 0.0011, coast: 0.45,
    steerSensitivity: 1.0, steerResponse: 1.9, maxSteer: 0.5, steerFalloff: 8,
    mass: 195, wheelBase: 1.4, grip: 8.2,
    length: 2.1, width: 0.8, height: 1.5, centerZ: 0, wheelRadius: 0.35,
    lean: { max: 0.62, factor: 1.0, k: 70, c: 11 },
    susp: { k: 140, zeta: 0.55, rollGain: 0, pitchGain: 0.02, bump: 1.0 },
    gears: 5, eye: [0, 1.38, -0.1], audio: { base: 46, mult: 1.0, wave: 'square' },
  },
  splendor: {
    id: 'splendor', name: 'Hero Splendor', kind: 'bike',
    tagline: 'Light commuter. Nimble and forgiving, runs out of breath at the top.',
    maxSpeed: 28, accel: 3.6, brake: 7.2, reverseSpeed: 2, drag: 0.0013, coast: 0.4,
    steerSensitivity: 1.15, steerResponse: 2.4, maxSteer: 0.52, steerFalloff: 8,
    mass: 112, wheelBase: 1.27, grip: 8.0,
    length: 1.95, width: 0.7, height: 1.5, centerZ: 0, wheelRadius: 0.31,
    lean: { max: 0.62, factor: 1.05, k: 85, c: 12 },
    susp: { k: 160, zeta: 0.5, rollGain: 0, pitchGain: 0.022, bump: 1.1 },
    gears: 4, eye: [0, 1.32, -0.1], audio: { base: 62, mult: 1.15, wave: 'sawtooth' },
  },
  scooty: {
    id: 'scooty', name: 'Scooty', kind: 'scooter',
    tagline: 'Tiny and twitchy. Quickest to turn, easiest to unsettle.',
    maxSpeed: 19.5, accel: 3.0, brake: 6.8, reverseSpeed: 2, drag: 0.0016, coast: 0.4,
    steerSensitivity: 1.3, steerResponse: 3.0, maxSteer: 0.58, steerFalloff: 7,
    mass: 105, wheelBase: 1.2, grip: 7.4,
    length: 1.8, width: 0.68, height: 1.4, centerZ: 0, wheelRadius: 0.22,
    lean: { max: 0.55, factor: 0.9, k: 100, c: 13 },
    susp: { k: 170, zeta: 0.45, rollGain: 0, pitchGain: 0.025, bump: 1.3 },
    gears: 0, eye: [0, 1.28, -0.05], audio: { base: 80, mult: 1.2, wave: 'triangle' },
  },
};
export const VEHICLE_LIST = Object.values(VEHICLES);
export const minTurnRadius = (v) => v.wheelBase / Math.tan(v.maxSteer);
