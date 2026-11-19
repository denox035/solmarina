// audio.js — every sound in Solmarina is synthesised with WebAudio.
// No audio files: engine hum, sirens, gunshots, pickups and a bass line are
// all built from oscillators and filtered noise at run time.

const AudioSys = {
  ctx: null,
  master: null,
  muted: false,
  engineOsc: null,
  engineGain: null,
  musicTimer: null,
  musicStep: 0,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows the player's speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },

  setEngine(speedNorm, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.06 : 0.0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.08);
  },

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.12));
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + (dur || 0.12));
  },

  noiseBurst(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = freq || 1800;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t);
  },

  gunshot() { this.noiseBurst(0.14, 0.3, 1400); this.blip(90, 0.1, 'sine', 0.2); },
  punch() { this.noiseBurst(0.08, 0.2, 700); },
  pickup() { this.blip(660, 0.09, 'square', 0.1); setTimeout(() => this.blip(880, 0.12, 'square', 0.1), 90); },
  cash() { this.blip(523, 0.1, 'triangle', 0.14); setTimeout(() => this.blip(659, 0.1, 'triangle', 0.14), 100); setTimeout(() => this.blip(784, 0.16, 'triangle', 0.14), 200); },
  crash() { this.noiseBurst(0.35, 0.35, 500); },
  busted() { this.blip(220, 0.3, 'sawtooth', 0.16); setTimeout(() => this.blip(165, 0.4, 'sawtooth', 0.16), 280); },

  // Two-tone police siren, called on a timer while wanted >= 1.
  siren() {
    if (!this.ctx || this.muted) return;
    this.blip(720, 0.28, 'sine', 0.07);
    setTimeout(() => this.blip(540, 0.28, 'sine', 0.07), 300);
  },

  // A slow bass loop: A minor walk, one note per beat.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep++;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.55);
    }, 480);
  },
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } },
};
