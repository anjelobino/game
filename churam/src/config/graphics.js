export const GRAPHICS = {
  low:    { label: 'Low',    maxDpr: 1,   shadows: false, shadowMap: 512,  trees: 0.35, rocks: 0.4, rain: 1500, near: 140, far: 330, traffic: 12, postfx: false, aa: false },
  medium: { label: 'Medium', maxDpr: 1.5, shadows: true,  shadowMap: 1024, trees: 0.7,  rocks: 0.7, rain: 3500, near: 190, far: 480, traffic: 18, postfx: false, aa: true },
  high:   { label: 'High',   maxDpr: 2,   shadows: true,  shadowMap: 2048, trees: 1.0,  rocks: 1.0, rain: 7000, near: 250, far: 650, traffic: 24, postfx: true,  aa: true },
};
