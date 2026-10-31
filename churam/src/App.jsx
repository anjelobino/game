import { useEffect } from 'react';
import { useStore } from './core/store.js';
import { attachInput, onAction, clearInput } from './core/input.js';
import { flags } from './core/shared.js';
import { audio } from './core/audio.js';
import MainMenu from './ui/MainMenu.jsx';
import VehicleSelect from './ui/VehicleSelect.jsx';
import Game from './game/Game.jsx';
import HUD from './ui/HUD.jsx';
import PauseMenu from './ui/PauseMenu.jsx';
import FinishScreen from './ui/FinishScreen.jsx';
import Loading from './ui/Loading.jsx';

// App only wires screens + global hotkeys together. All game logic lives in src/core, src/vehicles, src/road, ...
export default function App() {
  const screen = useStore((s) => s.screen);
  useEffect(() => {
    const detach = attachInput();                       // exactly one set of listeners
    const off = onAction((a) => {
      const st = useStore.getState();
      if (st.screen !== 'playing') return;
      if (a === 'pause') { if (st.settingsOpen) st.openSettings(false); else st.togglePause(); }
      else if (a === 'hidden') { if (!st.paused && !st.finished) st.setPaused(true); }
      else if (st.paused || st.finished) return;
      else if (a === 'camera') st.toggleCamera();
      else if (a === 'free') st.toggleFree();
      else if (a === 'hud') st.toggleHud();
      else if (a === 'horn') audio.horn(st.vehicleId);
      else if (a === 'reset') flags.resetRequested = true;
    });
    return () => { off(); detach(); };
  }, []);
  useEffect(() => { clearInput(); }, [screen]);
  return (
    <div className="app">
      {screen === 'menu' && <MainMenu />}
      {screen === 'select' && <VehicleSelect />}
      {screen === 'playing' && (
        <div className="game-root">
          <Game />
          <HUD />
          <PauseMenu />
          <FinishScreen />
          <Loading />
        </div>
      )}
    </div>
  );
}
