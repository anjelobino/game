import { useStore } from '../core/store.js';
import SettingsPanel from './SettingsPanel.jsx';

export default function PauseMenu() {
  const paused = useStore((s) => s.paused), finished = useStore((s) => s.finished), open = useStore((s) => s.settingsOpen);
  const { setPaused, restart, openSettings, goto } = useStore.getState();
  if (!paused || finished) return null;
  return (
    <div className="overlay">
      {open ? <SettingsPanel onClose={() => openSettings(false)} /> : (
        <div className="panel">
          <h2>PAUSED</h2>
          <button className="btn primary" onClick={() => setPaused(false)}>RESUME</button>
          <button className="btn" onClick={restart}>RESTART</button>
          <button className="btn" onClick={() => openSettings(true)}>SETTINGS</button>
          <button className="btn" onClick={() => goto('menu')}>MAIN MENU</button>
        </div>
      )}
    </div>
  );
}
