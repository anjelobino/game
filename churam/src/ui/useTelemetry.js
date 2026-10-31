import { useEffect, useState } from 'react';
import { telemetry } from '../core/shared.js';

// HUD samples the mutable telemetry object at a fixed rate – the game loop never triggers React renders.
export function useTelemetry(ms = 100) {
  const [snap, setSnap] = useState({ ...telemetry });
  useEffect(() => { const id = setInterval(() => setSnap({ ...telemetry }), ms); return () => clearInterval(id); }, [ms]);
  return snap;
}
