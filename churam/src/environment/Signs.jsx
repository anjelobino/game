import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { player } from '../core/shared.js';
import { ROAD } from '../road/roadData.js';

function signTexture(kind, text, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = kind === 'ad' ? 240 : 360;
  const g = c.getContext('2d'), W = c.width, H = c.height;
  if (kind === 'bend') {
    g.fillStyle = '#1d6b3a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = 12; g.strokeRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#fff'; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.fillText(sub, W / 2, 80);
    g.font = 'bold 200px sans-serif'; g.fillText(text, W / 2, 270); g.font = '32px sans-serif'; g.fillText('of 9 • Thamarassery Churam', W / 2, 330);
  } else if (kind === 'warn') {
    g.fillStyle = '#ffd400'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 14; g.strokeRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#111'; g.font = 'bold 70px sans-serif'; g.textAlign = 'center'; g.fillText('⚠ ' + text, W / 2, 130);
    g.font = 'bold 44px sans-serif'; g.fillText(sub, W / 2, 210); g.font = '34px sans-serif'; g.fillText('Slow down • Low gear', W / 2, 290);
  } else {
    const hue = (text.length * 47) % 360; g.fillStyle = `hsl(${hue},55%,32%)`; g.fillRect(0, 0, W, H); g.strokeStyle = '#f5e7b6'; g.lineWidth = 8; g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = '#fff6d8'; g.textAlign = 'center'; g.font = `bold ${text.length > 12 ? 50 : 68}px sans-serif`; g.fillText(text, W / 2, 110); g.font = '34px sans-serif'; g.fillText(sub, W / 2, 175);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function Signs({ data }) {
  const group = useRef(), timer = useRef(1);
  const built = useMemo(() => {
    const res = [], planeGeo = new THREE.PlaneGeometry(1, 1), postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x555a5e, roughness: 0.7, metalness: 0.5 });
    const textures = [], mats = [postMat];
    const root = new THREE.Group();
    for (const s of data.signs) {
      const tex = signTexture(s.kind, s.text, s.sub); textures.push(tex);
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }); mats.push(m);
      const g = new THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = s.rotY;
      const h = s.kind === 'bend' ? 4.6 : 3.2;
      const board = new THREE.Mesh(planeGeo, m); board.scale.set(s.w, s.h, 1); board.position.y = h + s.h / 2; g.add(board);
      for (const dx of s.w > 3 ? [-s.w / 2 + 0.3, s.w / 2 - 0.3] : [0]) { const p = new THREE.Mesh(postGeo, postMat); p.scale.y = h + 0.5; p.position.set(dx, (h + 0.5) / 2 - 0.3, -0.05); g.add(p); }
      root.add(g); res.push(g);
    }
    // gateway arches
    const archMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.8 }); mats.push(archMat);
    const hw = ROAD.halfWidth;
    for (const a of data.arches) {
      const i = a.i, g = new THREE.Group(); g.position.set(ROAD.px[i], ROAD.py[i], ROAD.pz[i]); g.rotation.y = -ROAD.heading[i] + Math.PI / 2;
      const gp = new THREE.BoxGeometry(0.6, 6.4, 0.6), gb = new THREE.BoxGeometry(2 * hw + 2.6, 1.7, 0.6);
      [-1, 1].forEach((sx) => { const p = new THREE.Mesh(gp, archMat); p.position.set(sx * (hw + 0.7), 3.2, 0); g.add(p); });
      const tex = signTexture('ad', a.text, a.sub); textures.push(tex);
      const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }); mats.push(bm);
      const beam = new THREE.Mesh(gb, [archMat, archMat, archMat, archMat, bm, bm]); beam.position.y = 6.4; g.add(beam);
      root.add(g); res.push(g); g.userData.geos = [gp, gb];
    }
    return { root, res, geos: [planeGeo, postGeo], textures, mats };
  }, [data]);
  useEffect(() => () => { built.geos.forEach((g) => g.dispose()); built.textures.forEach((t) => t.dispose()); built.mats.forEach((m) => m.dispose()); built.res.forEach((g) => g.userData.geos?.forEach((x) => x.dispose())); }, [built]);
  useFrame((_, dt) => {
    timer.current += dt; if (timer.current < 0.4 || !player.ready) return; timer.current = 0;
    for (const g of built.res) g.visible = Math.hypot(g.position.x - player.pos.x, g.position.z - player.pos.z) < 320;
  });
  return <primitive object={built.root} />;
}
