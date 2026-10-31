import { useStore } from '../core/store.js';
import { telemetry } from '../core/shared.js';

export default function FinishScreen() {
  const finished = useStore((s) => s.finished);
  const { restart, goto } = useStore.getState();
  if (!finished) return null;
  const t = telemetry.time;
  return (
    <div className="overlay">
      <div className="panel">
        <h2>VYTHIRI REACHED</h2>
        <div style={{ color: 'var(--dim)' }}>You conquered all 9 hairpins of Thamarassery Churam.</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--accent)' }}>{String(Math.floor(t / 60)).padStart(2, '0')}:{String(Math.floor(t % 60)).padStart(2, '0')}</div>
        <button className="btn primary" onClick={restart}>DRIVE AGAIN</button>
        <button className="btn" onClick={() => goto('select')}>CHANGE VEHICLE</button>
        <button className="btn" onClick={() => goto('menu')}>MAIN MENU</button>
      </div>
    </div>
  );
}
