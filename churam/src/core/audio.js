// Small WebAudio mixer: engine tone, rain hiss, impact thud. No asset files needed.
class AudioSys {
  ctx = null; muted = false; vol = 0.7; eng = null;
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol; this.master.connect(c.destination);
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const rain = c.createBufferSource(); rain.buffer = buf; rain.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
    this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
    rain.connect(hp); hp.connect(this.rainGain); this.rainGain.connect(this.master); rain.start();
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 700;
    this.o1 = c.createOscillator(); this.o2 = c.createOscillator();
    this.o2.detune.value = 14; this.o1.connect(this.lp); this.o2.connect(this.lp); this.lp.connect(this.engGain); this.engGain.connect(this.master);
    this.o1.start(); this.o2.start();
  }
  setVehicle(a) { if (!this.ctx) return; this.eng = a; this.o1.type = this.o2.type = a.wave; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.05); }
  setVolume(v) { this.vol = v; if (this.master && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  update(speedFrac, throttle, rain, active) {
    if (!this.ctx || !this.eng) return;
    const t = this.ctx.currentTime, e = this.eng;
    const rpm = 0.25 + (speedFrac * 6 % 1) * 0.55 + throttle * 0.15;
    const f = e.base * (1 + rpm * 2.2) * e.mult;
    this.o1.frequency.setTargetAtTime(f, t, 0.06); this.o2.frequency.setTargetAtTime(f * 1.003, t, 0.06);
    this.lp.frequency.setTargetAtTime(500 + rpm * 900 + throttle * 400, t, 0.1);
    this.engGain.gain.setTargetAtTime(active ? 0.08 + throttle * 0.07 : 0, t, 0.1);
    this.rainGain.gain.setTargetAtTime(active ? rain * 0.1 : 0, t, 0.3);
  }
  thud(strength) {
    try {
      if (!this.ctx) return;
      const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400 + strength * 60;
      const g = c.createGain(); g.gain.setValueAtTime(Math.min(0.5, 0.1 + strength * 0.04), c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
      s.connect(lp); lp.connect(g); g.connect(this.master); s.start(); s.stop(c.currentTime + 0.4);
    } catch { /* audio context suspended */ }
  }
  horn(type = 'car', duration = 0.38, gainMult = 1.0) {
    try {
      if (!this.ctx) this.init();
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const g = c.createGain();
      const maxGain = Math.min(0.45, Math.max(0.02, 0.28 * gainMult));
      const dur = Math.max(0.12, duration);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(maxGain, t + 0.02);
      g.gain.setValueAtTime(maxGain, t + Math.max(0.04, dur - 0.05));
      g.gain.linearRampToValueAtTime(0.001, t + dur);
      g.connect(this.master);

      const specs = {
        bus: { freqs: [370, 440], wave: 'sawtooth', filterFreq: 1800, Q: 2.2 },
        lorry: { freqs: [275, 345], wave: 'sawtooth', filterFreq: 1400, Q: 2.0 },
        bullet: { freqs: [345, 435], wave: 'square', filterFreq: 1300, Q: 1.6 },
        bike: { freqs: [450, 460], wave: 'sawtooth', filterFreq: 2200, Q: 1.2 },
        splendor: { freqs: [450, 460], wave: 'sawtooth', filterFreq: 2200, Q: 1.2 },
        scooter: { freqs: [620, 626], wave: 'sine', filterFreq: 2600, Q: 1.0 },
        scooty: { freqs: [620, 626], wave: 'sine', filterFreq: 2600, Q: 1.0 },
        car: { freqs: [410, 500], wave: 'sawtooth', filterFreq: 1900, Q: 1.5 },
        jeep: { freqs: [390, 480], wave: 'square', filterFreq: 1600, Q: 1.5 },
        auto: { freqs: [510, 520], wave: 'sawtooth', filterFreq: 2400, Q: 1.4 },
      };
      const s = specs[type] || specs.car;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = s.filterFreq;
      filter.Q.value = s.Q;
      filter.connect(g);

      s.freqs.forEach((f) => {
        const osc = c.createOscillator();
        osc.type = s.wave;
        osc.frequency.setValueAtTime(f, t);
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + dur);
      });
    } catch { /* audio context suspended */ }
  }
}
export const audio = new AudioSys();
