// 8-Bit Retro Audio Synthesizer (Zero External Dependencies)
class RetroAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }

  playBlip(freq = 440, type = 'square', duration = 0.08) {
    if (!this.enabled) return;
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playSuccess() {
    if (!this.enabled) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playBlip(freq, 'triangle', 0.1), idx * 70);
    });
  }

  playAlert() {
    if (!this.enabled) return;
    this.init();
    this.playBlip(300, 'sawtooth', 0.15);
    setTimeout(() => this.playBlip(240, 'sawtooth', 0.2), 120);
  }

  playTypeSound() {
    if (!this.enabled) return;
    this.init();
    const freqs = [600, 750, 900, 1100];
    const randFreq = freqs[Math.floor(Math.random() * freqs.length)];
    this.playBlip(randFreq, 'square', 0.03);
  }
}

const audioFX = new RetroAudioEngine();
