import { useEffect, useRef, useState } from 'react';
import { useStore } from '../core/store.js';
import { useTelemetry } from './useTelemetry.js';
import Minimap from './Minimap.jsx';
import MobileControls from './MobileControls.jsx';
import { telemetry } from '../core/shared.js';
import { ROAD } from '../road/roadData.js';
import { flags } from '../core/shared.js';
import { audio } from '../core/audio.js';

const fmtTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const isTouch = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

export default function HUD() {
  const t = useTelemetry(100);
  const hudVisible = useStore((s) => s.hudVisible), cam = useStore((s) => s.cameraMode), settings = useStore((s) => s.settings), paused = useStore((s) => s.paused);
  const setPaused = useStore((s) => s.setPaused), toggleCamera = useStore((s) => s.toggleCamera), updateSettings = useStore((s) => s.updateSettings);
  const [toast, setToast] = useState(null), [flash, setFlash] = useState(0);
  const lastEv = useRef(0), lastHit = useRef(0);
  useEffect(() => { if (t.hairpinEvent !== lastEv.current) { lastEv.current = t.hairpinEvent; if (t.hairpin) setToast({ k: t.hairpinEvent, n: t.hairpin }); } }, [t.hairpinEvent, t.hairpin]);
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(null), 2300); return () => clearTimeout(id); } }, [toast]);
  useEffect(() => { if (t.impactId !== lastHit.current) { lastHit.current = t.impactId; if (t.impactId) setFlash((f) => f + 1); } }, [t.impactId]);
  const showTouch = settings.mobileControls === 'on' || (settings.mobileControls === 'auto' && isTouch());
  const zone = ROAD.viewpoint, nearView = t.u >= zone.i0 - 10 && t.u <= zone.i1 + 10;
  return (
    <div className="hud">
      {hudVisible && (
        <>
          <div className="hud-top">
            <div className="speed">{Math.round(t.speedKmh)}<small>KM/H</small></div>
            <div className="gear">{t.gear}</div>
          </div>
          <div className="hud-right">
            <div className="big">{t.hairpin || '–'}<small> / 9 HAIRPIN</small></div>
            <div className="line">Time <b>{fmtTime(t.time)}</b></div>
            <div className="line">Distance <b>{(t.distance / 1000).toFixed(2)}</b> / {(t.total / 1000).toFixed(2)} km</div>
            <div className="prog"><i style={{ width: (t.progress * 100).toFixed(1) + '%' }} /></div>
            {nearView && <div className="line" style={{ color: 'var(--accent)' }}>Lakkidi View Point</div>}
          </div>
          <div className="hud-left">
            {settings.showMinimap !== false && <Minimap />}
            <div className="hud-btns">
              <button tabIndex={-1} title="Horn (H / E)" onClick={() => audio.horn(useStore.getState().vehicleId)}>📯</button>
              <button tabIndex={-1} title="Pause (P)" onClick={() => setPaused(true)}>❚❚</button>
              <button tabIndex={-1} title="Camera (C)" className={cam === 'fpp' ? 'on' : ''} onClick={toggleCamera}>{cam === 'fpp' ? 'FPP' : cam === 'free' ? 'FREE' : 'TPP'}</button>
              <button tabIndex={-1} title="Sound" className={settings.sound ? 'on' : ''} onClick={() => updateSettings({ sound: !settings.sound })}>{settings.sound ? '🔊' : '🔇'}</button>
              <button tabIndex={-1} title="Reset to road (R)" onClick={() => { flags.resetRequested = true; }}>⟲</button>
            </div>
          </div>
          {t.slip && !paused && <div className="slip">SLIDING</div>}
        </>
      )}
      {toast && <div className="toast" key={toast.k}><small>THAMARASSERY CHURAM</small>HAIRPIN {toast.n}</div>}
      {flash > 0 && <div className="flash" key={flash} />}
      {showTouch && <MobileControls />}
    </div>
  );
}
