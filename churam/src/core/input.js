// Reliable keyboard + touch input. One set of listeners, attached once, cleared on blur.
const keys = new Set();
const actionListeners = new Set();
export const touch = { left: false, right: false, gas: false, brake: false, horn: false };
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyR', 'KeyP', 'KeyH', 'KeyE', 'KeyV', 'KeyU', 'Escape']);
const ACTIONS = { KeyC: 'camera', KeyR: 'reset', KeyP: 'pause', Escape: 'pause', KeyH: 'horn', KeyE: 'horn', KeyU: 'hud', KeyV: 'free' };
let detach = null;

const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' && t.type !== 'range' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); };
const emit = (a) => actionListeners.forEach((fn) => fn(a));

export function clearInput() { keys.clear(); touch.left = touch.right = touch.gas = touch.brake = touch.horn = false; }

export function attachInput() {
  if (detach) return detach;               // never attach twice
  const down = (e) => {
    if (typing(e)) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();   // stop page scroll / button activation
    if (e.repeat) return;
    keys.add(e.code);
    const a = ACTIONS[e.code]; if (a) emit(a);
  };
  const up = (e) => { keys.delete(e.code); };
  const blur = () => clearInput();
  const vis = () => { if (document.hidden) { clearInput(); emit('hidden'); } };
  window.addEventListener('keydown', down, { passive: false });
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', vis);
  const noScroll = (e) => { if (e.target.closest && e.target.closest('.game-root')) e.preventDefault(); };
  window.addEventListener('wheel', noScroll, { passive: false });
  detach = () => {
    window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
    document.removeEventListener('visibilitychange', vis); window.removeEventListener('wheel', noScroll);
    clearInput(); detach = null;
  };
  return detach;
}
export function onAction(fn) { actionListeners.add(fn); return () => actionListeners.delete(fn); }

export function readInput(out) {
  const k = keys;
  out.steer = ((k.has('KeyD') || k.has('ArrowRight') || touch.right) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft') || touch.left) ? 1 : 0);
  out.throttle = (k.has('KeyW') || k.has('ArrowUp') || touch.gas) ? 1 : 0;
  out.brake = (k.has('KeyS') || k.has('ArrowDown') || touch.brake) ? 1 : 0;
  out.ebrake = k.has('Space');
  out.horn = k.has('KeyH') || k.has('KeyE') || touch.horn;
  return out;
}
