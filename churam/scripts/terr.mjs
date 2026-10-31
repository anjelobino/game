import { getTerrain } from '../src/environment/terrainData.js';
import { buildScenery } from '../src/environment/sceneryData.js';
import { ROAD } from '../src/road/roadData.js';
let t=Date.now(); const T=getTerrain(); console.log('terrain',T.nx,'x',T.nz,(Date.now()-t)+'ms');
// road must sit above terrain everywhere across width
let bad=0, worst=-9; const tmp={};
for(let i=0;i<ROAD.n;i+=2) for(const lat of [-4.6,-4,0,4,4.6]){ ROAD.pointAt(i,lat,tmp); const d=tmp.y-T.heightAt(tmp.x,tmp.z); worst=Math.max(worst,-d); if(d<0.0) bad++; }
console.log('road samples below terrain:',bad,' worst penetration',worst.toFixed(2));
t=Date.now(); const S=buildScenery(T,1); console.log('scenery',Object.fromEntries(Object.entries(S).map(([k,v])=>[k,v.length])),(Date.now()-t)+'ms');
