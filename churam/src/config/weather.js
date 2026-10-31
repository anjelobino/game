export const WEATHER = {
  sunny:  { label: 'Sunny',  fogColor: '#cfe4f2', fogDensity: 0.0011, skyTop: '#3f8fe0', skyHorizon: '#c3dff2', sun: 1.0,  ambient: 0.55, sunColor: '#fff1d6', rain: 0,    wet: 0,   cloud: 0.15, dark: 0 },
  cloudy: { label: 'Cloudy', fogColor: '#b9c4cc', fogDensity: 0.0022, skyTop: '#7f95a8', skyHorizon: '#c9d3da', sun: 0.45, ambient: 0.62, sunColor: '#e8edf2', rain: 0,    wet: 0.1, cloud: 0.75, dark: 0.1 },
  rainy:  { label: 'Rainy',  fogColor: '#8d9aa3', fogDensity: 0.0042, skyTop: '#566673', skyHorizon: '#98a5ad', sun: 0.2,  ambient: 0.58, sunColor: '#cfd8de', rain: 0.75, wet: 0.85, cloud: 1,    dark: 0.4 },
  fog:    { label: 'Heavy monsoon fog', fogColor: '#aab4b9', fogDensity: 0.012, skyTop: '#9aa5aa', skyHorizon: '#b6bfc3', sun: 0.12, ambient: 0.62, sunColor: '#d6dde0', rain: 0.3, wet: 0.7, cloud: 1, dark: 0.45 },
};
export const WEATHER_ORDER = ['sunny', 'cloudy', 'rainy', 'fog'];
