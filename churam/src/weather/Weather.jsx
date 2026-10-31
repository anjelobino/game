import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../core/store.js';
import { WEATHER, WEATHER_ORDER } from '../config/weather.js';
import { GRAPHICS } from '../config/graphics.js';
import { weatherState, player, clock, adaptive } from '../core/shared.js';
import { fbm } from '../core/noise.js';

const tmpC = new THREE.Color();
const lerp = (a, b, t) => a + (b - a) * t;

// Smoothly blends the live weather state toward the selected preset (optionally cycling presets).
export function WeatherController() {
  const scene = useThree((s) => s.scene);
  const dyn = useRef({ t: 0, idx: 2 });
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#8d9aa3', 0.004);
    const p = WEATHER[useStore.getState().settings.weather]; // start exactly at the preset (no pop-in)
    weatherState.fogColor.set(p.fogColor); weatherState.skyTop.set(p.skyTop); weatherState.skyHorizon.set(p.skyHorizon); weatherState.sunColor.set(p.sunColor);
    Object.assign(weatherState, { fogDensity: p.fogDensity, sun: p.sun, ambient: p.ambient, rain: p.rain, wet: p.wet, cloud: p.cloud, dark: p.dark });
    return () => { scene.fog = null; };
  }, [scene]);
  useFrame((_, dt) => {
    const st = useStore.getState().settings;
    let key = st.weather;
    if (st.dynamicWeather && !useStore.getState().paused) {
      dyn.current.t += dt; if (dyn.current.t > 75) { dyn.current.t = 0; dyn.current.idx = (WEATHER_ORDER.indexOf(WEATHER_ORDER[dyn.current.idx]) + 1) % WEATHER_ORDER.length; }
      key = WEATHER_ORDER[dyn.current.idx];
    }
    const p = WEATHER[key], k = 1 - Math.exp(-Math.min(dt, 0.1) * 0.9), w = weatherState;
    w.fogColor.lerp(tmpC.set(p.fogColor), k); w.skyTop.lerp(tmpC.set(p.skyTop), k); w.skyHorizon.lerp(tmpC.set(p.skyHorizon), k); w.sunColor.lerp(tmpC.set(p.sunColor), k);
    for (const f of ['fogDensity', 'sun', 'ambient', 'rain', 'wet', 'cloud', 'dark']) w[f] = lerp(w[f], p[f], k);
    if (scene.fog) { scene.fog.color.copy(w.fogColor); scene.fog.density = w.fogDensity; }
  });
  return null;
}

const skyVS = 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const skyFS = `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform float uSunI; varying vec3 vDir;
void main(){ float h = clamp(vDir.y,0.0,1.0); vec3 c = mix(uHor,uTop,pow(h,0.55));
  float s = max(dot(normalize(vDir), normalize(uSun)),0.0); c += vec3(1.0,0.92,0.75) * (pow(s,64.0)*0.8 + pow(s,6.0)*0.25) * uSunI;
  if(vDir.y<0.0) c = uHor; gl_FragColor = vec4(c,1.0); }`;

export const SUN_DIR = new THREE.Vector3(0.45, 0.8, 0.35).normalize();

export function SkyDome() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: SUN_DIR.clone() }, uSunI: { value: 1 } } }), []);
  const geo = useMemo(() => new THREE.SphereGeometry(4800, 24, 12), []);
  const mesh = useRef();
  useEffect(() => () => { mat.dispose(); geo.dispose(); }, [mat, geo]);
  useFrame(({ camera }) => {
    mesh.current.position.copy(camera.position);
    mat.uniforms.uTop.value.copy(weatherState.skyTop); mat.uniforms.uHor.value.copy(weatherState.fogColor).lerp(weatherState.skyHorizon, 0.4); mat.uniforms.uSunI.value = weatherState.sun;
  });
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={-10} frustumCulled={false} />;
}

// Scrolling cloud deck: one plane, one procedural texture.
export function CloudLayer() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const v = Math.max(0, fbm(x / 40, y / 40, 5) * 1.6 - 0.45); const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.min(255, v * 400); }
    g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t;
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, color: '#ffffff' }), [tex]);
  const geo = useMemo(() => new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), []);
  const mesh = useRef();
  useEffect(() => () => { tex.dispose(); mat.dispose(); geo.dispose(); }, [tex, mat, geo]);
  useFrame(({ camera }) => {
    mesh.current.position.set(camera.position.x, camera.position.y + 700, camera.position.z);
    tex.offset.x = clock.game * 0.0006 + camera.position.x * 0.00004; tex.offset.y = camera.position.z * 0.00004;
    mat.opacity = Math.min(1, weatherState.cloud * 0.9); mat.color.copy(weatherState.skyHorizon).multiplyScalar(0.5 + weatherState.sun * 0.5);
  });
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={-9} frustumCulled={false} />;
}

// Sun + hemisphere. Shadow camera follows the player (small, sharp frustum).
export function Lights({ shadowsOn, shadowMap }) {
  const sun = useRef(), hemi = useRef(), amb = useRef();
  useFrame(() => {
    const l = sun.current; if (!l) return;
    l.position.set(player.pos.x + SUN_DIR.x * 90, player.pos.y + SUN_DIR.y * 90, player.pos.z + SUN_DIR.z * 90);
    l.target.position.copy(player.pos); l.target.updateMatrixWorld();
    l.intensity = 0.25 + 3.0 * weatherState.sun; l.color.copy(weatherState.sunColor);
    hemi.current.intensity = 0.35 + weatherState.ambient * 0.9; hemi.current.color.copy(weatherState.skyHorizon); hemi.current.groundColor.set('#2a3a22');
  });
  return (
    <>
      <directionalLight ref={sun} castShadow={shadowsOn} key={`${shadowsOn}-${shadowMap}`} shadow-mapSize={[shadowMap, shadowMap]} shadow-bias={-0.0005} shadow-normalBias={0.06}
        shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} shadow-camera-near={1} shadow-camera-far={240} />
      <hemisphereLight ref={hemi} />
    </>
  );
}

// Procedural reflection environment (no network): soft light panels for wet asphalt reflections.
export function Reflections() {
  return (
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" intensity={2.2} position={[0, 6, -8]} scale={[18, 6, 1]} color="#dfe9f2" />
      <Lightformer form="rect" intensity={1.4} position={[8, 3, 4]} scale={[6, 6, 1]} color="#fff3dc" />
      <Lightformer form="rect" intensity={0.8} position={[-8, 3, 4]} scale={[6, 6, 1]} color="#b8c8d8" />
    </Environment>
  );
}

// GPU rain: one LineSegments object; every streak is animated in the vertex shader (no per-drop JS).
const rainVS = `attribute vec4 aSeed; uniform float uTime; uniform vec3 uCam; uniform float uInt; uniform vec3 uBox; uniform vec2 uWind;
varying float vA;
void main(){
  float speed = 20.0 + aSeed.x * 8.0;
  float y = mod(aSeed.y * uBox.y - uTime * speed, uBox.y);
  float rx = mod(aSeed.x * uBox.x - uCam.x, uBox.x) - uBox.x * 0.5;
  float rz = mod(aSeed.z * uBox.z - uCam.z, uBox.z) - uBox.z * 0.5;
  vec3 p = vec3(uCam.x + rx, uCam.y - 12.0 + y, uCam.z + rz);
  vec3 vel = vec3(uWind.x, -speed, uWind.y);
  p -= normalize(vel) * 0.9 * aSeed.w;
  float vis = step(fract(aSeed.x * 91.7 + aSeed.z * 37.3), uInt);
  vA = vis * (0.55 - aSeed.w * 0.35);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  if (vis < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const rainFS = 'varying float vA; uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, vA * 0.55); }';

export function Rain({ count }) {
  const { geo, mat } = useMemo(() => {
    const seeds = new Float32Array(count * 2 * 4), pos = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); for (let e = 0; e < 2; e++) seeds.set([x, y, z, e], (i * 2 + e) * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const m = new THREE.ShaderMaterial({ vertexShader: rainVS, fragmentShader: rainFS, transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uInt: { value: 0 }, uBox: { value: new THREE.Vector3(70, 40, 70) }, uWind: { value: new THREE.Vector2(2, 1) }, uColor: { value: new THREE.Color('#c9d6e0') } } });
    return { geo: g, mat: m };
  }, [count]);
  const obj = useRef();
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => {
    mat.uniforms.uTime.value = clock.game; mat.uniforms.uCam.value.copy(camera.position); mat.uniforms.uInt.value = weatherState.rain;
    if (obj.current) obj.current.visible = weatherState.rain > 0.02;
  });
  return <lineSegments ref={obj} geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}
