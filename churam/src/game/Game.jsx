import { Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useStore } from '../core/store.js';
import { GRAPHICS } from '../config/graphics.js';
import { adaptive } from '../core/shared.js';
import { audio } from '../core/audio.js';
import { WeatherController, SkyDome, CloudLayer, Lights, Reflections, Rain } from '../weather/Weather.jsx';
import Terrain, { Mountains } from '../environment/Terrain.jsx';
import Scenery from '../environment/Scenery.jsx';
import Road from '../road/Road.jsx';
import RoadCollider from '../road/RoadCollider.jsx';
import Vehicle from '../vehicles/Vehicle.jsx';
import Traffic from '../vehicles/Traffic.jsx';
import Cones from '../vehicles/Cones.jsx';
import CameraController from '../camera/CameraController.jsx';

// Adaptive quality: lowers pixel ratio first, then drops shadows if the frame rate still can't keep up.
function AdaptiveQuality({ maxDpr, onShadows }) {
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => { setDpr(maxDpr); }, [maxDpr, setDpr]);
  const lvl = useState({ dpr: maxDpr })[0];
  return (
    <PerformanceMonitor ms={250} iterations={6} flipflops={4}
      onDecline={() => { lvl.dpr = Math.max(0.6, lvl.dpr - 0.2); setDpr(Math.min(lvl.dpr, maxDpr)); if (lvl.dpr <= 0.7 && !adaptive.shadowsOff) { adaptive.shadowsOff = true; onShadows(true); } }}
      onIncline={() => { lvl.dpr = Math.min(maxDpr, lvl.dpr + 0.15); setDpr(lvl.dpr); }} />
  );
}

function World({ gfx, shadowsOn }) {
  const rainCount = gfx.rain;
  return (
    <>
      <WeatherController />
      <SkyDome /><CloudLayer /><Lights shadowsOn={shadowsOn} shadowMap={gfx.shadowMap} /><Reflections />
      <Terrain receiveShadow={shadowsOn} /><Mountains />
      <Road shadowsOn={shadowsOn} />
      <Scenery shadowsOn={shadowsOn} />
      <Rain key={rainCount} count={rainCount} />
    </>
  );
}

function ReadyGate({ children }) { // lets the loading overlay paint before the heavy procedural generation starts
  const [ok, setOk] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOk(true), 60); return () => clearTimeout(t); }, []);
  return ok ? children : null;
}

export default function Game() {
  const settings = useStore((s) => s.settings), paused = useStore((s) => s.paused), runId = useStore((s) => s.runId);
  const gfx = GRAPHICS[settings.graphics];
  const [autoShadowsOff, setAutoOff] = useState(adaptive.shadowsOff);
  const shadowsOn = gfx.shadows && settings.shadows && !autoShadowsOff;
  const postfx = gfx.postfx && settings.postfx;
  useEffect(() => { adaptive.shadowsOff = false; setAutoOff(false); }, [settings.graphics, runId]);
  useEffect(() => { audio.setMuted(!settings.sound); audio.setVolume(settings.volume); }, [settings.sound, settings.volume]);
  return (
    <Canvas key={runId} shadows={shadowsOn} dpr={gfx.maxDpr} camera={{ fov: settings.fov, near: 0.25, far: 6000, position: [0, 5, -10] }}
      gl={{ antialias: gfx.aa && !postfx, powerPreference: 'high-performance', stencil: false }} onCreated={({ gl }) => { gl.setClearColor('#8d9aa3'); }}>
      <AdaptiveQuality maxDpr={gfx.maxDpr} onShadows={setAutoOff} />
      <ReadyGate>
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} paused={paused} timeStep={1 / 60}>
            <World gfx={gfx} shadowsOn={shadowsOn} />
            <RoadCollider />
            <Vehicle />
            <Traffic />
            <Cones />
          </Physics>
        </Suspense>
        <CameraController />
        {postfx && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.45} luminanceThreshold={0.85} mipmapBlur />
            <Vignette offset={0.3} darkness={0.55} />
          </EffectComposer>
        )}
      </ReadyGate>
    </Canvas>
  );
}
