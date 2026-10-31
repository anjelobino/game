import { useState } from 'react';
import { useStore } from '../core/store.js';
import { audio } from '../core/audio.js';
import SettingsPanel from './SettingsPanel.jsx';

export default function MainMenu() {
  const goto = useStore((s) => s.goto);
  const [panel, setPanel] = useState(null);
  return (
    <div className="screen">
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="title">CHURAM</h1>
        <div className="subtitle">Thamarassery Ghat Road • Kerala</div>
        <div className="route"><span>Adivaram</span><i /><span>9 Hairpins</span><i /><span>Lakkidi</span><i /><span>Vythiri</span></div>
      </div>
      {panel === 'settings' ? <SettingsPanel onClose={() => setPanel(null)} /> : panel === 'controls' ? (
        <div className="panel stack">
          <div className="controls-help">
            <b>Accelerate</b><span><kbd>W</kbd> / <kbd>↑</kbd></span><b>Brake / reverse</b><span><kbd>S</kbd> / <kbd>↓</kbd></span>
            <b>Steer</b><span><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd></span><b>Emergency brake</b><span><kbd>Space</kbd></span>
            <b>Camera TPP / FPP</b><span><kbd>C</kbd></span><b>Free-look camera</b><span><kbd>V</kbd> (drag mouse)</span>
            <b>Horn</b><span><kbd>H</kbd> / <kbd>E</kbd></span><b>Reset to road</b><span><kbd>R</kbd></span>
            <b>Pause</b><span><kbd>P</kbd> / <kbd>Esc</kbd></span><b>Toggle HUD</b><span><kbd>U</kbd></span>
          </div>
          <button className="btn small" onClick={() => setPanel(null)}>Back</button>
        </div>
      ) : (
        <div className="stack">
          <button className="btn primary" onClick={() => { audio.init(); goto('select'); }}>START</button>
          <button className="btn" onClick={() => setPanel('settings')}>SETTINGS</button>
          <button className="btn" onClick={() => setPanel('controls')}>CONTROLS</button>
        </div>
      )}
    </div>
  );
}
