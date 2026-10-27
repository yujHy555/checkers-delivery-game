export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) {
      this.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      // 1. Engine Oscillator Setup
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'triangle';

      this.engineOsc1.frequency.value = 46;
      this.engineOsc2.frequency.value = 92;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 400;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineGain.gain.value = 0.12;

      this.engineOsc1.start();
      this.engineOsc2.start();

      // 2. Tire Drift Screech Noise Buffer
      this.initTireNoise();

      // 3. Subtle Brake Squeal / Friction Synthesizer
      this.initBrakeSound();

      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext not allowed or supported yet', e);
    }
  }

  resume() {
    if (!this.initialized) {
      this.init();
      return;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    if (!this.isMuted) {
      this.resume();
    }
    return !this.isMuted;
  }

  initTireNoise() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.tireNoise = this.ctx.createBufferSource();
    this.tireNoise.buffer = noiseBuffer;
    this.tireNoise.loop = true;

    this.tireFilter = this.ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.value = 950;
    this.tireFilter.Q.value = 3.0;

    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.value = 0;

    this.tireNoise.connect(this.tireFilter);
    this.tireFilter.connect(this.tireGain);
    this.tireGain.connect(this.masterGain);

    this.tireNoise.start();
  }

  initBrakeSound() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.brakeNoise = this.ctx.createBufferSource();
    this.brakeNoise.buffer = noiseBuffer;
    this.brakeNoise.loop = true;

    // Resonant high-pitched bandpass filter for brake pad friction & squeal
    this.brakeFilter = this.ctx.createBiquadFilter();
    this.brakeFilter.type = 'bandpass';
    this.brakeFilter.frequency.value = 2650;
    this.brakeFilter.Q.value = 5.5;

    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.value = 0;

    this.brakeNoise.connect(this.brakeFilter);
    this.brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.masterGain);

    this.brakeNoise.start();
  }

  resume() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  updateEngine(speed, throttle, maxSpeed) {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.isMuted) return;

    const normSpeed = Math.min(1.0, Math.abs(speed) / maxSpeed);

    const baseFreq = 48 + normSpeed * 175 + throttle * 45;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.02, this.ctx.currentTime, 0.05);

    const targetGain = 0.14 + normSpeed * 0.24 + throttle * 0.20;
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);

    this.engineFilter.frequency.setTargetAtTime(400 + normSpeed * 950, this.ctx.currentTime, 0.08);
  }

  updateSkid(isSkidding, slipVel) {
    if (!this.initialized || !this.tireGain || this.isMuted) return;
    const intensity = Math.min(1.0, Math.max(0.45, slipVel / 5.5));
    const targetGain = isSkidding ? 0.38 * intensity : 0;
    this.tireGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.03);
  }

  updateBrake(isBrakingHard, speed) {
    if (!this.initialized || !this.brakeGain || this.isMuted) return;
    const targetGain = (isBrakingHard && Math.abs(speed) > 1.8) ? 0.28 : 0;
    this.brakeGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
  }

  playConeHit(impactSpeed = 5) {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const vol = Math.min(0.35, Math.max(0.08, (impactSpeed / 20.0) * 0.30));
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = this.ctx.currentTime;
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.15);

      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.17);
    } catch (e) {}
  }

  playDoorSlide() {
    if (!this.initialized || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.36);
  }

  playDeliveryChime() {
    if (!this.initialized || this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  playJumpLand() {
    if (!this.initialized || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }
}
