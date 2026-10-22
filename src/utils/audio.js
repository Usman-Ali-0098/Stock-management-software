// Web Audio API sound triggers for cashier tactile feedback

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  beep(freq = 600, duration = 0.08, type = 'sine') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio context might fail on older or restricted browsers
    }
  }

  addRoll() {
    // Satisfying double-click chime
    this.beep(520, 0.05, 'triangle');
    setTimeout(() => this.beep(780, 0.08, 'triangle'), 60);
  }

  cutMeter() {
    // Snip tone
    this.beep(880, 0.06, 'sawtooth');
  }

  cashSuccess() {
    // Upbeat cash chime
    this.beep(523.25, 0.08, 'sine'); // C5
    setTimeout(() => this.beep(659.25, 0.08, 'sine'), 80); // E5
    setTimeout(() => this.beep(783.99, 0.15, 'sine'), 160); // G5
  }

  creditAlert() {
    // Red udhar warning double low tone
    this.beep(350, 0.1, 'square');
    setTimeout(() => this.beep(280, 0.15, 'square'), 120);
  }

  click() {
    this.beep(900, 0.02, 'sine');
  }
}

export const sound = new SoundEffects();
