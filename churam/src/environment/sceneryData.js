// Procedural placement of vegetation, rocks, poles, shops and signs (pure data: matrices + params).
import * as THREE from 'three';
import { ROAD } from '../road/roadData.js';
import { mulberry32, clamp } from '../core/noise.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
export function mat(x, y, z, rotY, sx, sy = sx, sz = sx, rotX = 0, rotZ = 0) {
  _e.set(rotX, rotY, rotZ); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

export function buildScenery(terr, density) {
  const road = ROAD, R = mulberry32(1337), b = terr.bounds;
  const o = { palm: [], broad: [], tall: [], bush: [], rock: [], pole: [], shop: [], signs: [], arches: [] };
  const inf = { d: 0, y: 0, i: 0, bench: 11 };
  const W = b.maxX - b.minX, Hh = b.maxZ - b.minZ;
  const nTrees = Math.floor(3600 * density);
  for (let tries = 0, n = 0; n < nTrees && tries < nTrees * 8; tries++) {
    const x = b.minX + R() * W, z = b.minZ + R() * Hh;
    road.influence(x, z, inf);
    if (inf.d < inf.bench + 2.5) continue;
    const y = terr.heightAt(x, z);
    if (y < terr.edgeY + 30 || terr.slopeAt(x, z) > 0.95) continue;
    if (inf.d > 40 && R() < 0.2) continue;
    const t = R(), s = 0.8 + R() * 0.9, rot = R() * 6.28;
    const it = { x, z, m: mat(x, y - 0.3, z, rot, s, s * (0.9 + R() * 0.4), s) };
    (t < 0.3 ? o.palm : t < 0.7 ? o.broad : o.tall).push(it); n++;
  }
  const nBush = Math.floor(1600 * density);
  for (let tries = 0, n = 0; n < nBush && tries < nBush * 6; tries++) {
    const x = b.minX + R() * W, z = b.minZ + R() * Hh;
    road.influence(x, z, inf);
    if (inf.d < inf.bench + 0.8 || inf.d > 60) continue;
    const y = terr.heightAt(x, z); if (y < terr.edgeY + 30) continue;
    const s = 0.6 + R() * 1.0;
    o.bush.push({ x, z, m: mat(x, y, z, R() * 6, s * 1.3, s * 0.8, s * 1.3), c: new THREE.Color().setHSL(0.25 + R() * 0.08, 0.5, 0.2 + R() * 0.12) });
    n++;
  }
  const nRock = Math.floor(700 * density);
  for (let tries = 0, n = 0; n < nRock && tries < nRock * 8; tries++) {
    const x = b.minX + R() * W, z = b.minZ + R() * Hh;
    road.influence(x, z, inf);
    if (inf.d < inf.bench + 0.5 || inf.d > 45) continue;
    const y = terr.heightAt(x, z); if (y < terr.edgeY + 30) continue;
    const s = 0.7 + R() * R() * 3.2, g = 0.35 + R() * 0.25;
    o.rock.push({ x, z, m: mat(x, y + s * 0.2, z, R() * 6, s * 1.2, s * 0.8, s, R() * 0.4, R() * 0.4), c: new THREE.Color(g, g * 0.97, g * 0.9) });
    n++;
  }
  const hw = road.halfWidth, tmp = { x: 0, y: 0, z: 0 };
  // electric poles on the left (uphill) side
  const poleIdx = [];
  for (let i = 16; i < road.n - 12; i += 18) {
    road.pointAt(i, -(hw + 1.7), tmp);
    const y = terr.heightAt(tmp.x, tmp.z);
    o.pole.push({ x: tmp.x, z: tmp.z, y, i, m: mat(tmp.x, y - 0.4, tmp.z, -road.heading[i] + Math.PI / 2, 1) });
    poleIdx.push(i);
  }
  // roadside shops (tea stalls) + viewpoint shops
  const shopAt = [60, 150, 258, 330, 450, 540, 700, 800, road.viewpoint.i0 + 20, road.viewpoint.i1 - 14, 1010, 1100];
  const palette = [0xd94f3d, 0x2f8f9d, 0xe0b43a, 0x5b8c3a, 0x8c5fb0];
  shopAt.forEach((i, k) => {
    if (i >= road.n - 20) return;
    const side = k % 2 === 0 ? 1 : -1, lat = side * (hw + 4.2);
    road.pointAt(i, lat, tmp); const y = terr.heightAt(tmp.x, tmp.z);
    o.shop.push({ x: tmp.x, z: tmp.z, y, m: mat(tmp.x, y - 0.2, tmp.z, -road.heading[i] + Math.PI / 2 + (side > 0 ? Math.PI : 0), 1), c: new THREE.Color(palette[k % palette.length]) });
  });
  // hairpin signs
  const sign = (kind, text, sub, i, lat, faceDir, extra = {}) => {
    road.pointAt(i, lat, tmp);
    const y = terr.heightAt(tmp.x, tmp.z);
    o.signs.push({ kind, text, sub, x: tmp.x, z: tmp.z, y, rotY: Math.atan2(faceDir[0], faceDir[1]), ...extra });
  };
  road.hairpins.forEach((h) => {
    const k = road.kappa[h.index], outside = k > 0 ? -1 : 1; // outside of the bend
    sign('bend', String(h.id), 'HAIRPIN', h.index, outside * (hw + 3.0), [-outside * road.rx[h.index], -outside * road.rz[h.index]], { w: 3.6, h: 2.6 });
    const i = h.index - 40;
    sign('warn', `${h.id}`, `Hairpin ${h.id} ahead`, i, -(hw + 1.6), [-road.tx[i], -road.tz[i]], { w: 1.8, h: 1.8 });
  });
  const ads = [[40, 'KERALA TOURISM', "God's Own Country"], [110, 'CHAYA KADA', 'Hot tea & pazham pori'], [300, 'KSRTC', 'Safe journey, Thamarassery–Wayanad'], [470, 'WAYANAD', 'Spices • Coffee • Mist'], [620, 'DRIVE SLOW', 'Ghat road – use low gear'], [740, 'HONEY & SPICES', 'Lakkidi 1 km'], [1030, 'VYTHIRI RESORT', 'Misty mountain stay'], [1140, 'WELCOME', 'Wayanad district']];
  ads.forEach(([i, t, sub], k) => { const side = k % 2 ? 1 : -1; sign('ad', t, sub, i, side * (hw + 3.5), [-side * road.rx[i], -side * road.rz[i]], { w: 5.2, h: 2.4 }); });
  // arches
  o.arches.push({ i: 14, text: 'ADIVARAM', sub: 'Thamarassery Churam →' });
  o.arches.push({ i: road.viewpoint.i0 + 4, text: 'LAKKIDI VIEW POINT', sub: 'Gateway of Wayanad' });
  o.arches.push({ i: road.n - 14, text: 'VYTHIRI', sub: 'Welcome to Wayanad' });
  return o;
}
