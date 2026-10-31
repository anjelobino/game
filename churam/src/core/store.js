import { create } from 'zustand';

const KEY = 'churam.settings.v1';
const defaults = {
  graphics: 'medium', weather: 'rainy', dynamicWeather: false, sound: true, volume: 0.7,
  tppDistance: 7, tppHeight: 2.6, fov: 62, shadows: true, postfx: true, mobileControls: 'auto', headlights: 'auto',
};
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

export const useStore = create((set, get) => ({
  screen: 'menu',            // menu | select | playing
  vehicleId: 'bullet',
  paused: false, runId: 0, loaded: false, finished: false,
  cameraMode: 'tpp',         // tpp | fpp | free
  lastCam: 'tpp',
  hudVisible: true, settingsOpen: false,
  settings: { ...defaults, ...load() },

  goto: (screen) => set({ screen, paused: false, finished: false, settingsOpen: false, loaded: false }),
  selectVehicle: (vehicleId) => set({ vehicleId }),
  startGame: () => set((s) => ({ screen: 'playing', paused: false, finished: false, loaded: false, settingsOpen: false, cameraMode: 'tpp', runId: s.runId + 1 })),
  restart: () => set((s) => ({ runId: s.runId + 1, paused: false, finished: false, settingsOpen: false, loaded: false })),
  setLoaded: (loaded) => set({ loaded }),
  setPaused: (paused) => set({ paused, settingsOpen: paused ? get().settingsOpen : false }),
  togglePause: () => { const s = get(); if (s.screen === 'playing' && !s.finished) s.setPaused(!s.paused); },
  toggleCamera: () => set((s) => ({ cameraMode: s.cameraMode === 'tpp' ? 'fpp' : 'tpp' })),
  toggleFree: () => set((s) => (s.cameraMode === 'free' ? { cameraMode: s.lastCam } : { lastCam: s.cameraMode, cameraMode: 'free' })),
  toggleHud: () => set((s) => ({ hudVisible: !s.hudVisible })),
  setFinished: (finished) => set({ finished }),
  openSettings: (settingsOpen) => set({ settingsOpen }),
  updateSettings: (patch) => set((s) => {
    const settings = { ...s.settings, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    return { settings };
  }),
}));
