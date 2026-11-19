// SOLMARINA audio: all sound is synthesized live with WebAudio — no audio
// files, no network. Engine hum, sirens, gunshots, pickups and a bass loop.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var ctx = null, master = null, muted = false;
  var engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  var musicTimer = null, musicStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    var t = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    var g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  function setEngine(speed01, on) {
    if (!engineOsc) return;
    var t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
  }
  function startSiren() {
    if (!ensure() || sirenOsc) return;
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
    var hi = false;
    sirenOsc._iv = setInterval(function () {
      if (!sirenOsc) return;
      hi = !hi;
      sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, ctx.currentTime, 0.05);
    }, 320);
  }
  function setSiren(on) {
    if (!sirenOsc) return;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, ctx.currentTime, 0.2);
  }
  function stopSiren() {
    if (!sirenOsc) return;
    clearInterval(sirenOsc._iv);
    try { sirenOsc.stop(); } catch (e) {}
    sirenOsc = null; sirenGain = null;
  }

  // Laid-back bass loop: Am – F – C – G, one bar each, 100 bpm.
  var BASS = [55, 43.65, 65.41, 49];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(function () {
      if (muted) return;
      var root = BASS[Math.floor(musicStep / 4) % 4];
      var beat = musicStep % 4;
      if (beat === 0 || beat === 2) blip(root, 0.5, 'triangle', 0.10);
      if (beat === 3) blip(root * 1.5, 0.25, 'triangle', 0.07);
      if (beat === 1) blip(root * 2, 0.18, 'sine', 0.05);
      musicStep++;
    }, 300);
  }

  S.Audio = {
    unlock: ensure,
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted: function () { return muted; },
    shot: function () { noise(0.14, 0.4, 2400); blip(190, 0.09, 'square', 0.16, 60); },
    punch: function () { noise(0.08, 0.3, 500); },
    pickup: function () { blip(660, 0.1, 'sine', 0.2); setTimeout(function () { blip(990, 0.14, 'sine', 0.2); }, 90); },
    steal: function () { blip(220, 0.16, 'square', 0.16, 440); },
    crash: function () { noise(0.25, 0.4, 800); },
    busted: function () { blip(392, 0.3, 'sawtooth', 0.2, 196); blip(311, 0.4, 'sawtooth', 0.2, 155); },
    missionOk: function () {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (n, i) {
        setTimeout(function () { blip(n, 0.22, 'triangle', 0.22); }, i * 110);
      });
    },
    missionFail: function () { blip(330, 0.3, 'sawtooth', 0.2, 165); },
    engine: { start: startEngine, set: setEngine },
    siren: { start: startSiren, set: setSiren, stop: stopSiren },
    music: { start: startMusic }
  };
})();
