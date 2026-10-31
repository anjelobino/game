import { ROAD } from '../src/road/roadData.js';
const r=ROAD; console.log('samples',r.n,'length',r.length.toFixed(0),'bounds',JSON.stringify(r.bounds),'hairpins',r.hairpins.map(h=>h.index).join(','),'view',JSON.stringify(r.viewpoint));
let maxK=0; for(let i=0;i<r.n;i++) maxK=Math.max(maxK,Math.abs(r.kappa[i])); console.log('min radius',(1/maxK).toFixed(1));
// min distance between non-neighbouring road parts
let md=1e9; for(let i=0;i<r.n;i+=3) for(let j=i+60;j<r.n;j+=3){const d=Math.hypot(r.px[i]-r.px[j],r.pz[i]-r.pz[j]); if(d<md)md=d;} console.log('min separation of distinct stretches',md.toFixed(1));
