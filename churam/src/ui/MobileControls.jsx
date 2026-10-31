import { touch } from '../core/input.js';
import { useStore } from '../core/store.js';

function Hold({ k, cls, children }) {
  const set = (v) => (e) => { e.preventDefault(); touch[k] = v; e.currentTarget.classList.toggle('on', v); };
  return <button className={'tbtn ' + (cls || '')} onPointerDown={set(true)} onPointerUp={set(false)} onPointerCancel={set(false)} onPointerLeave={set(false)} onContextMenu={(e) => e.preventDefault()}>{children}</button>;
}
export default function MobileControls() {
  const cam = useStore((s) => s.toggleCamera);
  return (
    <div className="mobile">
      <div className="grp"><Hold k="left">◀</Hold><Hold k="right">▶</Hold></div>
      <div className="grp" style={{ alignItems: 'flex-end' }}>
        <Hold k="horn" cls="horn">📯</Hold>
        <button className="tbtn" style={{ width: 52, height: 52, fontSize: 18 }} onClick={cam}>📷</button>
        <Hold k="brake" cls="brk">■</Hold><Hold k="gas" cls="gas">▲</Hold>
      </div>
    </div>
  );
}
