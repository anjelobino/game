import { useStore } from '../core/store.js';
export default function Loading() {
  const loaded = useStore((s) => s.loaded);
  return <div className={'loading' + (loaded ? ' done' : '')}><div className="spin" /><div style={{ letterSpacing: '.3em', color: 'var(--dim)' }}>CLIMBING TO ADIVARAM…</div></div>;
}
