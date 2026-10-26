export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);

      // Engine oscillator setup
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'triangle';

      this.engineOsc1.frequency.value = 45;
      this.engineOsc2.frequency.value = 90;

      // Lowpass filter for smooth rumble
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 350;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineGain.gain.value = 0.08;

      this.engineOsc1.start();
      this.engineOsc2.start();

      // Tire screech noise buffer
      this.initTireNoise();

      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext not allowed or supported yet', e);
    }
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

  updateEngine(speed, throttle, maxSpeed) {
    if (!this.initialized || this.isMuted) return;
    const normSpeed = Math.min(1.0, Math.abs(speed) / maxSpeed);

    // Pitch rises with speed and throttle
    const baseFreq = 42 + normSpeed * 140 + throttle * 35;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.05, this.ctx.currentTime, 0.05);

    const targetGain = 0.04 + normSpeed * 0.08 + throttle * 0.06;
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);

    this.engineFilter.frequency.setTargetAtTime(320 + normSpeed * 650, this.ctx.currentTime, 0.08);
  }

  updateSkid(isSkidding, slipVel) {
    if (!this.initialized || !this.tireGain || this.isMuted) return;
    const targetGain = isSkidding ? Math.min(0.22, (slipVel / 10.0) * 0.22) : 0;
    this.tireGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
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
    // Pleasant arpeggio: C5, E5, G5, C6
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

  playHorn() {
    if (!this.initialized || this.isMuted) return;
    const f1 = 440, f2 = 554.37;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.frequency.setValueAtTime(f1, this.ctx.currentTime);
    osc2.frequency.setValueAtTime(f2, this.ctx.currentTime);
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.41);
    osc2.stop(this.ctx.currentTime + 0.41);
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
