// audio.js — all sound is synthesized with WebAudio. No audio files, no network.
export function createAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null, muted: false,
    ensure() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        // Engine: two detuned sawtooths through a low-pass, gain follows speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const eng2 = this.ctx.createOscillator();
        eng2.type = 'square'; eng2.frequency.value = 28;
        const engFilter = this.ctx.createBiquadFilter();
        engFilter.type = 'lowpass'; engFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(engFilter); eng2.connect(engFilter);
        engFilter.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start(); eng2.start();
        this._eng2 = eng2;
        // Siren: triangle sweeping up/down via an LFO on frequency.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 750;
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.type = 'sine'; this.sirenLfo.frequency.value = 0.7;
        const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 320;
        this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
        this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start(); this.sirenLfo.start();
      } catch (e) { this.ctx = null; }
    },
    setEngine(speed01, driving) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.11 : 0, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
      this._eng2.frequency.setTargetAtTime(26 + speed01 * 62, t, 0.08);
    },
    setSiren(on) {
      if (!this.ctx) return;
      this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
    },
    blip(freq, dur, type = 'sine', vol = 0.2) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur);
    },
    noise(dur, vol, filterFreq = 1200) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },
    shot() { this.noise(0.14, 0.5, 2600); this.blip(160, 0.08, 'square', 0.18); },
    punch() { this.noise(0.08, 0.3, 500); },
    pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(990, 0.12), 70); },
    cash() { this.blip(880, 0.1); setTimeout(() => this.blip(1174, 0.1), 90); setTimeout(() => this.blip(1568, 0.16), 180); },
    crash() { this.noise(0.3, 0.5, 700); },
    horn() { this.blip(370, 0.18, 'square', 0.12); setTimeout(() => this.blip(370, 0.18, 'square', 0.12), 200); },
    arrest() { this.blip(220, 0.4, 'sawtooth', 0.2); },
    missionOk() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.14), i * 110)); },
    missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'triangle', 0.18), i * 130)); },
    toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.35; return this.muted; },
  };
  return A;
}
