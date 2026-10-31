// Procedural placeholder models (swap for GLB via `glb` in the vehicle config – see README).
// Convention: origin at ground level under the middle of the wheelbase, +Z forward, +X left, +Y up.
import * as THREE from 'three';

function kit() {
  const geos = new Map(), mats = new Map(), all = [];
  const geo = (key, make) => { if (!geos.has(key)) { const g = make(); geos.set(key, g); all.push(g); } return geos.get(key); };
  const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...o }); mats.set(k, m); all.push(m); } return mats.get(k); };
  const add = (parent, g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = true) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = shadow; parent.add(me); return me; };
  const box = (p, w, h, d, c, x, y, z, rx, ry, rz, o) => add(p, geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat(c, o), x, y, z, rx, ry, rz);
  const cyl = (p, rt, rb, h, c, x, y, z, rx, ry, rz, o, seg = 10) => add(p, geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(c, o), x, y, z, rx, ry, rz);
  const sph = (p, r, c, x, y, z, sx = 1, sy = 1, sz = 1, o) => { const m = add(p, geo(`s${r}`, () => new THREE.SphereGeometry(r, 12, 8)), mat(c, o), x, y, z); m.scale.set(sx, sy, sz); return m; };
  const limb = (p, a, b, t, c) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B); const m = box(p, t, t, len, c, 0, 0, 0); m.position.copy(A).add(B).multiplyScalar(0.5); m.lookAt(B); return m; };
  const dispose = () => { all.forEach((o) => o.dispose()); };
  return { geo, mat, add, box, cyl, sph, limb, dispose };
}

function wheel(k, parent, x, y, z, r, w, rimColor = 0xb8bcc0) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const tire = k.add(g, k.geo(`tire${r},${w}`, () => new THREE.CylinderGeometry(r, r, w, 16).rotateZ(Math.PI / 2)), k.mat(0x151515, { roughness: 0.95, metalness: 0 }));
  k.add(g, k.geo(`rim${r},${w}`, () => new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.02, 10).rotateZ(Math.PI / 2)), k.mat(rimColor, { metalness: 0.8, roughness: 0.3 }));
  k.box(g, w * 1.05, r * 1.1, r * 0.12, 0x555555, 0, 0, 0); // spoke bar so spinning is visible
  return g;
}

function textTexture(lines, bg, fg, w = 512, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = 'center'; g.font = 'bold 64px sans-serif'; g.fillText(lines[0], w / 2, 72);
  g.font = '28px sans-serif'; if (lines[1]) g.fillText(lines[1], w / 2, 112);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildVehicleModel(cfg) {
  const k = kit(), root = new THREE.Group(), rig = { root, wheels: [], steer: [], rider: new THREE.Group(), cockpit: new THREE.Group(), tail: [], head: [], eye: new THREE.Object3D(), steerWheel: null, textures: [], dispose: null };
  root.add(rig.rider); root.add(rig.cockpit); root.add(rig.eye); rig.eye.position.set(...cfg.eye);
  const emissiveRed = k.mat(0x550000, { emissive: 0xff1010, emissiveIntensity: 0.3, roughness: 0.3 });
  const lamp = k.mat(0xfff4d0, { emissive: 0xfff0b0, emissiveIntensity: 0.6, roughness: 0.2 });
  rig.tail.push(emissiveRed); rig.head.push(lamp);
  const hz = cfg.wheelBase / 2, r = cfg.wheelRadius;

  if (cfg.kind === 'bus') {
    const g = new THREE.Group(); root.add(g);
    const maroon = 0x9b1c24, white = 0xf1efe8;
    k.box(g, 2.4, 1.0, 8.5, maroon, 0, 1.1, -0.25);          // lower body
    k.box(g, 2.4, 1.35, 8.5, white, 0, 2.28, -0.25);          // upper body
    k.box(g, 2.46, 0.07, 8.5, 0xf2b705, 0, 1.62, -0.25);      // yellow stripe
    k.box(g, 2.5, 0.8, 7.4, 0x1c2b38, 0, 2.3, -0.5, 0, 0, 0, { metalness: 0.5, roughness: 0.15 }); // side windows
    k.box(g, 2.2, 1.0, 0.06, 0x1c2b38, 0, 2.25, 4.0, 0, 0, 0, { metalness: 0.5, roughness: 0.1 }); // windscreen
    k.box(g, 2.3, 0.2, 0.3, 0x222222, 0, 0.55, 4.1);          // bumper
    k.box(g, 1.9, 0.6, 0.05, 0x1c2b38, 0, 2.3, -4.52, 0, 0, 0, { metalness: 0.5, roughness: 0.15 }); // rear window
    k.box(g, 2.2, 0.08, 8.2, 0xdad8d0, 0, 3.0, -0.25);         // roof
    for (const s of [-0.8, 0.8]) { const h = k.sph(g, 0.16, 0xfff4d0, s, 0.95, 4.2, 1, 1, 0.5, { emissive: 0xfff0b0, emissiveIntensity: 0.6 }); }
    for (const s of [-0.9, 0.9]) k.box(g, 0.35, 0.2, 0.06, 0x550000, s, 1.0, -4.52, 0, 0, 0, { emissive: 0xff1010, emissiveIntensity: 0.3 });
    rig.tail.length = 0; g.traverse((o) => { if (o.isMesh && o.material.emissive && o.material.emissive.r > 0.9 && o.material.emissive.g < 0.2) rig.tail.push(o.material); });
    // side texts
    const tex = textTexture(['KSRTC', 'Kerala State Road Transport Corporation'], '#9b1c24', '#f7f2e0', 512, 128); rig.textures.push(tex);
    const tm = new THREE.MeshBasicMaterial({ map: tex }); rig.textures.push(tm);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), tm); p.position.set(s * 1.205, 1.1, -0.3); p.rotation.y = s * Math.PI / 2; g.add(p); rig.textures.push(p.geometry); }
    for (const s of [-1, 1]) { const f = new THREE.Group(); f.position.set(s * 1.0, r, hz); g.add(f); rig.steer.push({ pivot: f, ratio: 1 }); rig.wheels.push({ g: wheel(k, f, 0, 0, 0, r, 0.32), r }); }
    for (const s of [-1, 1]) rig.wheels.push({ g: wheel(k, g, s * 1.0, r, -hz, r, 0.34), r });
    // mirrors
    for (const s of [-1, 1]) { k.box(g, 0.05, 0.05, 0.3, 0x222222, s * 1.35, 2.0, 3.8); k.box(g, 0.06, 0.4, 0.22, 0x111111, s * 1.5, 2.0, 3.8, 0, 0, 0, { metalness: 0.9, roughness: 0.1 }); }
    // cockpit: dashboard + steering wheel (driver on the right = -X)
    k.box(rig.cockpit, 2.2, 0.35, 0.5, 0x2b2b2b, 0, 1.6, 3.75);
    const sw = new THREE.Group(); sw.position.set(-0.65, 1.85, 3.35); sw.rotation.x = -0.95; rig.cockpit.add(sw);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), k.mat(0x111111)); sw.add(torus); rig.textures.push(torus.geometry, torus.material);
    k.box(sw, 0.4, 0.03, 0.03, 0x111111, 0, 0, 0); rig.steerWheel = sw;
    k.box(rig.cockpit, 0.05, 1.1, 0.05, 0x222222, 0, 2.2, 4.0); k.box(rig.cockpit, 0.05, 1.1, 0.05, 0x222222, -1.05, 2.2, 3.98); k.box(rig.cockpit, 0.05, 1.1, 0.05, 0x222222, 1.05, 2.2, 3.98);
    // driver
    k.box(rig.rider, 0.5, 0.7, 0.3, 0x3d4a5c, -0.65, 1.75, 2.75); k.sph(rig.rider, 0.17, 0xc99a73, -0.65, 2.28, 2.8);
  } else {
    const scooter = cfg.kind === 'scooter', bullet = cfg.id === 'bullet';
    const body = bullet ? 0x14181a : cfg.id === 'splendor' ? 0xb3201f : 0x2f7fc4, accent = bullet ? 0xc9a227 : 0x1c1c1c;
    const chrome = k.mat(0xcfd3d6, { metalness: 0.9, roughness: 0.25 });
    wheel(k, root, 0, r, -hz, r, bullet ? 0.16 : 0.12).userData.rear = true; rig.wheels.push({ g: root.children[root.children.length - 1], r });
    // steering assembly pivots around the front axle
    const piv = new THREE.Group(); piv.position.set(0, r, hz); root.add(piv); rig.steer.push({ pivot: piv, ratio: 1 });
    rig.wheels.push({ g: wheel(k, piv, 0, 0, 0, r, bullet ? 0.15 : 0.11), r });
    const barY = scooter ? 0.62 : 0.66, barZ = scooter ? -0.12 : -0.22;
    for (const s of [-0.1, 0.1]) k.cyl(piv, 0.022, 0.022, scooter ? 0.8 : 0.78, 0x9aa0a4, s, 0.34, -0.05, 0.28, 0, 0);
    // handlebar + grips + mirrors (visible in first person)
    k.cyl(piv, 0.02, 0.02, 0.78, 0x222222, 0, barY, barZ, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) { k.cyl(piv, 0.03, 0.03, 0.12, 0x111111, s * 0.4, barY, barZ, 0, 0, Math.PI / 2); k.box(piv, 0.015, 0.2, 0.015, 0x222222, s * 0.33, barY + 0.1, barZ + 0.02); k.box(piv, 0.12, 0.08, 0.02, 0x111111, s * 0.33, barY + 0.22, barZ + 0.04, -0.3, 0, 0, { metalness: 0.9, roughness: 0.1 }); }
    const hl = k.sph(piv, 0.13, 0xfff4d0, 0, barY - 0.08, barZ + 0.24, 1, 1, 0.8, { emissive: 0xfff0b0, emissiveIntensity: 0.6 }); rig.head.push(hl.material);
    if (scooter) {
      k.box(root, 0.48, 0.1, 0.9, body, 0, 0.26, 0.0);            // floorboard
      k.box(root, 0.5, 0.55, 0.45, body, 0, 0.58, hz - 0.18, -0.2);  // front cowl
      k.box(root, 0.5, 0.45, 0.7, body, 0, 0.5, -0.4);             // rear body
      k.box(root, 0.34, 0.1, 0.55, 0x1b1b1b, 0, 0.8, -0.38);       // seat
      const tl = k.box(root, 0.3, 0.1, 0.06, 0x550000, 0, 0.6, -0.78, 0, 0, 0, { emissive: 0xff1010, emissiveIntensity: 0.3 }); rig.tail = [tl.material];
    } else {
      k.cyl(root, 0.17, 0.17, 0.36, 0x2a2d30, 0, 0.42, 0.02, 0, 0, Math.PI / 2, { metalness: 0.7 }, 8); // engine
      k.box(root, 0.3, 0.3, 0.5, 0x2a2d30, 0, 0.42, 0.0);
      const tank = k.sph(root, 0.3, body, 0, 0.86, hz * 0.3, 0.85, 0.7, 1.5); tank.castShadow = true;
      k.box(root, 0.3, 0.02, 0.46, accent, 0, 0.98, hz * 0.3);
      k.box(root, 0.28, 0.09, 0.62, 0x1d1b19, 0, 0.8, -0.3);       // seat
      k.box(root, 0.2, 0.04, 0.55, body, 0, 0.62, -hz - 0.0, -0.15);// rear fender
      k.cyl(root, 0.045, 0.04, 0.95, 0xcfd3d6, -0.2, 0.3, -0.35, Math.PI / 2, 0, 0, { metalness: 0.9, roughness: 0.2 });  // exhaust
      const tl = k.box(root, 0.18, 0.08, 0.05, 0x550000, 0, 0.62, -hz - 0.28, 0, 0, 0, { emissive: 0xff1010, emissiveIntensity: 0.3 }); rig.tail = [tl.material];
    }
    // rider (hidden in first person)
    const jacket = bullet ? 0x6a4a2a : 0x294a7a, seatY = scooter ? 0.82 : 0.86, seatZ = scooter ? -0.38 : -0.3;
    const R = rig.rider;
    k.box(R, 0.34, 0.52, 0.2, jacket, 0, seatY + 0.42, seatZ + 0.05, scooter ? 0.05 : 0.35);
    k.sph(R, 0.125, bullet ? 0xeeeeee : 0xcc3322, 0, seatY + 0.84, seatZ + (scooter ? 0.08 : 0.2), 1, 1.05, 1.1);
    for (const s of [-1, 1]) {
      k.limb(R, [s * 0.15, seatY + 0.12, seatZ], [s * 0.22, scooter ? 0.35 : 0.5, seatZ + (scooter ? 0.5 : 0.3)], 0.12, 0x2a3140);
      k.limb(R, [s * 0.22, scooter ? 0.35 : 0.5, seatZ + (scooter ? 0.5 : 0.3)], [s * 0.2, 0.28, scooter ? 0.4 : 0.05], 0.1, 0x2a3140);
      k.limb(R, [s * 0.17, seatY + 0.62, seatZ + 0.12], [s * 0.37, r + barY, hz + barZ], 0.08, jacket);
    }
  }
  const sl = new THREE.SpotLight(0xfff2d8, 0, 90, 0.5, 0.6, 1.2); sl.position.set(0, cfg.kind === 'bus' ? 1.0 : 0.9, hz + (cfg.kind === 'bus' ? 3.0 : 0.3));
  sl.target.position.set(0, 0.3, hz + 25); root.add(sl); root.add(sl.target); rig.spot = sl;
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  rig.dispose = () => { k.dispose(); rig.textures.forEach((t) => t.dispose?.()); };
  return rig;
}

// ---------------- traffic ----------------
const TRAFFIC = {
  bus: { w: 2.4, h: 3.1, l: 8.5, mass: 9500 },
  lorry: { w: 2.4, h: 3.0, l: 7.5, mass: 9000 },
  car: { w: 1.7, h: 1.5, l: 4.0, mass: 1100 },
  jeep: { w: 1.8, h: 1.9, l: 3.9, mass: 1500 },
  auto: { w: 1.4, h: 1.7, l: 2.7, mass: 450 },
  bike: { w: 0.8, h: 1.5, l: 2.1, mass: 180 },
};
export const TRAFFIC_KINDS = Object.keys(TRAFFIC);
export const trafficSpec = (kind) => TRAFFIC[kind];

export function buildTrafficModel(kind, colorIdx) {
  const k = kit(), g = new THREE.Group(), s = TRAFFIC[kind];
  const pal = [0xc94a2b, 0x2f6aa8, 0xe1e1da, 0x3a7d44, 0xd6a31c, 0x6a3d8a];
  const c = pal[colorIdx % pal.length];
  const lamp = k.mat(0xfff0c0, { emissive: 0xfff0b0, emissiveIntensity: 0.5 }), tail = k.mat(0x550000, { emissive: 0xff1010, emissiveIntensity: 0.4 });
  if (kind === 'bus') {
    const busBody = colorIdx % 2 === 0 ? 0x9b1c24 : 0x1f5fa8; // Kerala maroon/cream or blue/white
    k.box(g, 2.4, 1.0, 8.5, busBody, 0, 1.1, -0.25);
    k.box(g, 2.4, 1.35, 8.5, 0xf1efe8, 0, 2.28, -0.25);
    k.box(g, 2.44, 0.08, 8.5, 0xf2b705, 0, 1.62, -0.25); // yellow stripe
    k.box(g, 2.48, 0.8, 7.2, 0x1c2b38, 0, 2.3, -0.5, 0, 0, 0, { metalness: 0.5, roughness: 0.15 }); // windows
    k.box(g, 2.2, 1.0, 0.06, 0x1c2b38, 0, 2.25, 4.0, 0, 0, 0, { metalness: 0.5, roughness: 0.1 }); // windscreen
    k.box(g, 2.3, 0.25, 0.3, 0x222222, 0, 0.55, 4.1); // front bumper
    k.box(g, 1.9, 0.6, 0.05, 0x1c2b38, 0, 2.3, -4.52, 0, 0, 0, { metalness: 0.5, roughness: 0.15 }); // rear window
    k.box(g, 2.2, 0.08, 8.2, 0xdad8d0, 0, 3.0, -0.25); // roof
    for (const x of [-0.8, 0.8]) {
      k.sph(g, 0.16, 0xfff4d0, x, 0.95, 4.2, 1, 1, 0.5, { emissive: 0xfff0b0, emissiveIntensity: 0.6 });
      k.box(g, 0.3, 0.18, 0.06, 0x550000, x, 1.0, -4.52, 0, 0, 0, { emissive: 0xff1010, emissiveIntensity: 0.4 });
    }
    for (const z of [2.5, -2.5]) for (const x of [-1, 1]) wheel(k, g, x * 1.0, 0.55, z, 0.55, 0.32);
  } else if (kind === 'bike') {
    wheel(k, g, 0, 0.35, 0.72, 0.35, 0.12);
    wheel(k, g, 0, 0.35, -0.68, 0.35, 0.14);
    k.cyl(g, 0.16, 0.16, 0.34, 0x2a2d30, 0, 0.42, 0, 0, 0, Math.PI / 2, { metalness: 0.7 });
    k.box(g, 0.28, 0.26, 0.48, 0x222222, 0, 0.42, 0.0);
    k.sph(g, 0.26, c, 0, 0.82, 0.22, 0.82, 0.68, 1.4); // tank
    k.box(g, 0.25, 0.09, 0.58, 0x1a1a1a, 0, 0.78, -0.28); // seat
    k.cyl(g, 0.02, 0.02, 0.72, 0x111111, 0, 0.96, 0.46, 0, 0, Math.PI / 2); // handlebar
    k.sph(g, 0.12, 0xfff4d0, 0, 0.88, 0.72, 1, 1, 0.7, { emissive: 0xfff0b0, emissiveIntensity: 0.6 });
    k.box(g, 0.16, 0.08, 0.05, 0x550000, 0, 0.64, -0.96, 0, 0, 0, { emissive: 0xff1010, emissiveIntensity: 0.4 });
    // rider
    k.box(g, 0.32, 0.48, 0.2, 0x294a7a, 0, 1.25, -0.2, 0.25); // jacket
    k.sph(g, 0.13, c, 0, 1.62, -0.06, 1, 1.05, 1.1); // helmet
  } else if (kind === 'lorry') {
    k.box(g, 2.3, 1.7, 1.9, c, 0, 1.55, 2.6); k.box(g, 2.1, 0.7, 0.05, 0x1c2b38, 0, 1.9, 3.57); k.box(g, 2.4, 0.2, 5.0, 0x4a4036, 0, 0.9, -1.0); k.box(g, 2.4, 1.8, 5.0, 0xb08a3a, 0, 2.0, -1.0);
    for (const x of [-0.8, 0.8]) { k.box(g, 0.3, 0.2, 0.05, 0xfff0c0, x, 1.0, 3.58, 0, 0, 0, { emissive: 0xfff0b0, emissiveIntensity: 0.5 }); k.box(g, 0.3, 0.2, 0.05, 0x550000, x, 1.1, -3.52, 0, 0, 0, { emissive: 0xff1010, emissiveIntensity: 0.4 }); }
    for (const z of [2.4, -0.8, -2.5]) for (const x of [-1, 1]) wheel(k, g, x * 1.0, 0.5, z, 0.5, 0.3);
  } else if (kind === 'auto') {
    k.box(g, 1.3, 0.25, 2.4, 0x1c1c1c, 0, 0.45, 0); k.box(g, 1.35, 0.9, 1.5, 0xf2c200, 0, 1.0, -0.3); k.box(g, 1.4, 0.06, 1.7, 0x1c1c1c, 0, 1.55, -0.2); k.box(g, 0.6, 0.7, 0.5, 0xf2c200, 0, 0.9, 1.0);
    k.box(g, 0.2, 0.2, 0.05, 0xfff0c0, 0, 0.85, 1.3, 0, 0, 0, { emissive: 0xfff0b0, emissiveIntensity: 0.5 });
    wheel(k, g, 0, 0.27, 1.05, 0.27, 0.12); for (const x of [-0.6, 0.6]) wheel(k, g, x, 0.27, -0.9, 0.27, 0.14);
  } else {
    const jeep = kind === 'jeep';
    k.box(g, s.w, 0.7, s.l, c, 0, 0.7, 0); k.box(g, s.w - 0.1, jeep ? 0.9 : 0.6, jeep ? 2.4 : 2.0, jeep ? c : 0xe8eef2, 0, jeep ? 1.4 : 1.25, jeep ? -0.6 : -0.2);
    k.box(g, s.w - 0.2, 0.5, 0.06, 0x1c2b38, 0, jeep ? 1.4 : 1.25, jeep ? 0.66 : 0.82, -0.4, 0, 0, { metalness: 0.4, roughness: 0.1 });
    for (const x of [-0.6, 0.6]) { k.box(g, 0.3, 0.16, 0.05, 0xfff0c0, x, 0.8, s.l / 2, 0, 0, 0, { emissive: 0xfff0b0, emissiveIntensity: 0.5 }); k.box(g, 0.3, 0.16, 0.05, 0x550000, x, 0.85, -s.l / 2, 0, 0, 0, { emissive: 0xff1010, emissiveIntensity: 0.4 }); }
    for (const z of [s.l * 0.3, -s.l * 0.3]) for (const x of [-1, 1]) wheel(k, g, x * (s.w / 2 - 0.1), 0.32, z, 0.32, 0.22);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, spec: s, dispose: k.dispose };
}
