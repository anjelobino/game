import { useStore } from '../core/store.js';
import { GRAPHICS } from '../config/graphics.js';
import { WEATHER, WEATHER_ORDER } from '../config/weather.js';

const Seg = ({ value, options, onChange }) => (
  <div className="seg">{options.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>
);
const Toggle = ({ value, onChange }) => <button className={'toggle' + (value ? ' on' : '')} onClick={() => onChange(!value)} aria-pressed={value} />;
const Range = ({ value, min, max, step, onChange, fmt }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} /><span style={{ minWidth: 40, textAlign: 'right' }}>{fmt ? fmt(value) : value}</span></div>
);

export default function SettingsPanel({ onClose }) {
  const s = useStore((st) => st.settings), up = useStore((st) => st.updateSettings);
  return (
    <div className="panel settings">
      <h3>SETTINGS</h3>
      <div className="row"><label>Graphics</label><Seg value={s.graphics} options={Object.entries(GRAPHICS).map(([k, g]) => [k, g.label])} onChange={(v) => up({ graphics: v })} /></div>
      <div className="row"><label>Shadows</label><Toggle value={s.shadows} onChange={(v) => up({ shadows: v })} /></div>
      <div className="row"><label>Post-processing</label><Toggle value={s.postfx} onChange={(v) => up({ postfx: v })} /></div>
      <div className="row"><label>Weather</label><Seg value={s.weather} options={WEATHER_ORDER.map((k) => [k, WEATHER[k].label.replace('Heavy monsoon fog', 'Fog')])} onChange={(v) => up({ weather: v })} /></div>
      <div className="row"><label>Changing weather</label><Toggle value={s.dynamicWeather} onChange={(v) => up({ dynamicWeather: v })} /></div>
      <div className="row"><label>Headlights</label><Seg value={s.headlights} options={[['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]} onChange={(v) => up({ headlights: v })} /></div>
      <div className="row"><label>Sound</label><Toggle value={s.sound} onChange={(v) => up({ sound: v })} /></div>
      <div className="row"><label>Volume</label><Range value={s.volume} min={0} max={1} step={0.05} onChange={(v) => up({ volume: v })} fmt={(v) => Math.round(v * 100) + '%'} /></div>
      <div className="row"><label>Camera distance</label><Range value={s.tppDistance} min={3.5} max={14} step={0.5} onChange={(v) => up({ tppDistance: v })} fmt={(v) => v + ' m'} /></div>
      <div className="row"><label>Camera height</label><Range value={s.tppHeight} min={1} max={6} step={0.25} onChange={(v) => up({ tppHeight: v })} fmt={(v) => v + ' m'} /></div>
      <div className="row"><label>Field of view</label><Range value={s.fov} min={45} max={95} step={1} onChange={(v) => up({ fov: v })} fmt={(v) => v + '°'} /></div>
      <div className="row"><label>Touch controls</label><Seg value={s.mobileControls} options={[['auto', 'Auto'], ['on', 'Always'], ['off', 'Never']]} onChange={(v) => up({ mobileControls: v })} /></div>
      <button className="btn primary small" onClick={onClose}>Done</button>
    </div>
  );
}
