export class AudioBus {
  constructor(storage) {
    this.storage = storage;
    this.ctx = null;
    this.musicNode = null;
    this.musicGain = null;
    this._musicPhase = 0;
  }

  _ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
  }

  async unlock() {
    this._ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try { await this.ctx.resume(); } catch {}
    }
  }

  _beep({ freq = 440, dur = 0.06, type = "sine", gain = 0.12 }) {
    const s = this.storage.getSettings();
    if (!s.sound) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  sfxJump() { this._beep({ freq: 520, dur: 0.06, type: "triangle", gain: 0.10 }); }
  sfxScore() { this._beep({ freq: 740, dur: 0.07, type: "sine", gain: 0.09 }); }
  sfxHit() { this._beep({ freq: 120, dur: 0.10, type: "sawtooth", gain: 0.12 }); }
  sfxUI() { this._beep({ freq: 420, dur: 0.04, type: "square", gain: 0.06 }); }

  startMusic() {
    const s = this.storage.getSettings();
    if (!s.music) return;
    this._ensure();
    if (!this.ctx) return;
    if (this.musicNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    gain.gain.value = 0.03;

    osc.connect(gain).connect(this.ctx.destination);
    osc.start();

    this.musicNode = osc;
    this.musicGain = gain;

    // simple drifting tone (very subtle)
    const tick = () => {
      if (!this.musicNode || !this.ctx) return;
      const now = this.ctx.currentTime;
      this._musicPhase += 0.015;
      const base = 180 + Math.sin(this._musicPhase) * 30;
      this.musicNode.frequency.setValueAtTime(base, now);
      requestAnimationFrame(tick);
    };
    tick();
  }

  stopMusic() {
    if (!this.musicNode) return;
    try { this.musicNode.stop(); } catch {}
    this.musicNode.disconnect();
    this.musicNode = null;
    this.musicGain = null;
  }

  applyMusicSetting() {
    const s = this.storage.getSettings();
    if (!s.music) this.stopMusic();
    else this.startMusic();
  }
}
