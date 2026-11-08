// ===== Audio engine: synthesized arena sound (no samples needed) =====
const OTC = window.OTC;
OTC.Audio = class {
  constructor() { this.ctx = null; this.vol = { master: 0.9, sfx: 1, crowd: 0.7 }; this.hype = 0.2; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol.master;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx;
    this.crowdBus = c.createGain(); this.crowdBus.gain.value = this.vol.crowd;
    // arena reverb
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(2.6, 2.2);
    const wet = c.createGain(); wet.gain.value = 0.32;
    this.sfx.connect(this.master); this.sfx.connect(this.verb); this.crowdBus.connect(this.master);
    this.verb.connect(wet).connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.startCrowd();
  }
  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  makeNoise(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let p = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; p = 0.97 * p + 0.03 * w; d[i] = w * 0.5 + p * 3; }
    return b;
  }
  setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; this.master.gain.value = this.vol.master; this.sfx.gain.value = this.vol.sfx; this.crowdBus.gain.value = this.vol.crowd; }
  noise(dur, { type = 'bandpass', f = 1000, q = 1, gain = 0.5, attack = 0.005, f2 = null, bus = null, when = 0, pan = 0 } = {}) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    s.connect(fl).connect(g); if (p) { p.pan.value = pan; g.connect(p).connect(bus || this.sfx); } else g.connect(bus || this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(freq, dur, { type = 'sine', gain = 0.3, f2 = null, attack = 0.003, when = 0, pan = 0 } = {}) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    o.connect(g); if (p) { p.pan.value = pan; g.connect(p).connect(this.sfx); } else g.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // --- game sounds (vol 0..1, pan -1..1)
  bounce(v = 1, pan = 0) { this.tone(150, 0.11, { gain: 0.5 * v, f2: 55, pan }); this.noise(0.05, { f: 900, q: 0.8, gain: 0.25 * v, pan }); }
  rim(v = 1, pan = 0) { [523, 1247, 1980, 2810].forEach((f, i) => this.tone(f * (0.98 + Math.random() * 0.04), 0.5 - i * 0.08, { type: 'triangle', gain: 0.16 * v / (i + 1), pan })); this.noise(0.06, { f: 2500, gain: 0.2 * v, pan }); }
  board(v = 1, pan = 0) { this.tone(120, 0.18, { gain: 0.4 * v, f2: 70, pan }); this.noise(0.12, { type: 'lowpass', f: 700, gain: 0.35 * v, pan }); }
  swish(pan = 0) { this.noise(0.35, { type: 'highpass', f: 3000, f2: 6000, q: 0.5, gain: 0.35, attack: 0.04, pan }); }
  squeak(pan = 0) { const f = 1900 + Math.random() * 900; this.tone(f, 0.09, { type: 'sawtooth', gain: 0.06, f2: f * 1.25, pan }); this.tone(f * 1.5, 0.07, { gain: 0.04, pan }); }
  catchBall(pan = 0) { this.noise(0.05, { f: 600, q: 1.2, gain: 0.35, pan }); }
  whoosh() { this.noise(0.25, { f: 400, f2: 1600, q: 2, gain: 0.12, attack: 0.08 }); }
  buzzer() { this.tone(196, 1.1, { type: 'square', gain: 0.12 }); this.tone(198, 1.1, { type: 'sawtooth', gain: 0.08 }); }
  whistle() { this.tone(2900, 0.45, { gain: 0.09 }); this.tone(3150, 0.45, { gain: 0.06 }); }
  click() { this.tone(900, 0.04, { gain: 0.08 }); }
  green() { this.tone(1318, 0.18, { gain: 0.07 }); this.tone(1760, 0.24, { gain: 0.06, when: 0.06 }); }
  // --- crowd
  startCrowd() {
    const c = this.ctx;
    this.crowdGain = c.createGain(); this.crowdGain.gain.value = 0.12;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6; this.crowdFilter = bp;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    // murmur: amplitude-modulated by slow random LFOs
    const lfo = c.createOscillator(); lfo.frequency.value = 0.37; const lg = c.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg).connect(this.crowdGain.gain); lfo.start();
    s.connect(bp).connect(this.crowdGain).connect(this.crowdBus); s.start();
  }
  setHype(h) { this.hype = Math.max(0, Math.min(1, h)); if (!this.ctx) return; const t = this.ctx.currentTime; this.crowdGain.gain.setTargetAtTime(0.08 + this.hype * 0.25, t, 0.8); this.crowdFilter.frequency.setTargetAtTime(600 + this.hype * 900, t, 0.8); }
  cheer(big = 1) {
    if (!this.ctx) return;
    for (let i = 0; i < 6; i++) this.noise(1.6 + Math.random() * 1.4 * big, { f: 500 + Math.random() * 1500, q: 1.5, gain: 0.07 * big, attack: 0.15, when: Math.random() * 0.2, bus: this.crowdBus, pan: Math.random() * 2 - 1 });
    this.noise(2.5 * big, { type: 'lowpass', f: 1800, gain: 0.12 * big, attack: 0.2, bus: this.crowdBus });
  }
  ooh() { if (!this.ctx) return; for (let i = 0; i < 4; i++) this.noise(1.2, { f: 350 + i * 90, f2: 250 + i * 60, q: 4, gain: 0.08, attack: 0.25, bus: this.crowdBus, pan: Math.random() * 2 - 1 }); }
  defenseChant(on) {
    if (!this.ctx) return; const now = this.ctx.currentTime;
    if (on && (!this._lastChant || now - this._lastChant > 2.4)) { this._lastChant = now; this.noise(0.35, { f: 420, q: 3, gain: 0.08, bus: this.crowdBus }); this.noise(0.45, { f: 340, q: 3, gain: 0.08, bus: this.crowdBus, when: 0.55 }); }
  }
};
