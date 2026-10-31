import { useEffect, useMemo, useRef } from 'react';
import { ROAD } from '../road/roadData.js';
import { telemetry } from '../core/shared.js';

const SIZE = 210;
// Route is drawn once into an offscreen canvas; each tick only the progress trail + player marker are redrawn.
export default function Minimap() {
  const ref = useRef();
  const geom = useMemo(() => {
    const b = ROAD.bounds, pad = 14, w = b.maxX - b.minX, h = b.maxZ - b.minZ, sc = Math.min((SIZE - pad * 2) / w, (SIZE * 1.15 - pad * 2) / h);
    const W = Math.round(w * sc + pad * 2), H = Math.round(h * sc + pad * 2);
    const P = (x, z) => [pad + (x - b.minX) * sc, H - pad - (z - b.minZ) * sc];
    const base = document.createElement('canvas'); base.width = W; base.height = H; const g = base.getContext('2d');
    g.lineJoin = g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 5; g.beginPath();
    for (let i = 0; i < ROAD.n; i += 3) { const [x, y] = P(ROAD.px[i], ROAD.pz[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.stroke();
    g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ROAD.hairpins.forEach((hp) => { const [x, y] = P(hp.x, hp.z); g.fillStyle = '#ff9f1c'; g.beginPath(); g.arc(x, y, 7, 0, 6.3); g.fill(); g.fillStyle = '#1b1200'; g.fillText(hp.id, x, y + 0.5); });
    const [sx, sy] = P(ROAD.px[0], ROAD.pz[0]), [ex, ey] = P(ROAD.px[ROAD.n - 1], ROAD.pz[ROAD.n - 1]);
    g.fillStyle = '#6fd36f'; g.fillRect(sx - 4, sy - 4, 8, 8); g.fillStyle = '#ff5a4d'; g.fillRect(ex - 4, ey - 4, 8, 8);
    return { base, W, H, P };
  }, []);
  useEffect(() => {
    const cv = ref.current, g = cv.getContext('2d'), { base, P } = geom;
    const draw = () => {
      g.clearRect(0, 0, cv.width, cv.height); g.drawImage(base, 0, 0);
      const end = Math.min(ROAD.n - 1, Math.floor(telemetry.u)); g.strokeStyle = '#ff9f1c'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i <= end; i += 3) { const [x, y] = P(ROAD.px[i], ROAD.pz[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      const [px, py] = P(telemetry.x, telemetry.z); g.save(); g.translate(px, py); g.rotate(telemetry.yaw); // +x axis = heading; map z is flipped
      g.scale(1, -1); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, 5); g.lineTo(-3, 0); g.lineTo(-5, -5); g.closePath(); g.fill(); g.stroke(); g.restore();
    };
    draw(); const id = setInterval(draw, 66); return () => clearInterval(id);
  }, [geom]);
  return <canvas ref={ref} className="minimap" width={geom.W} height={geom.H} style={{ width: geom.W * 0.85, height: geom.H * 0.85 }} />;
}
