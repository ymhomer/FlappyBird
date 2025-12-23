export class Storage {
  constructor(namespace) {
    this.ns = namespace;
    this.data = this._load() ?? this._defaults();
    this._save();
  }

  _defaults() {
    return {
      settings: {
        sound: true,
        music: true,
        vibration: true,
        reducedMotion: false,
        highContrast: false,
        input: "tap",
        difficulty: "normal",
      },
      stats: {
        best: 0,
        runs: 0,
        totalScore: 0,
        coins: 0,
        bestStreak: 0,
      },
      daily: {
        dateKey: this._dateKey(),
        missions: null,
      },
    };
  }

  _dateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.ns);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _save() {
    try {
      localStorage.setItem(this.ns, JSON.stringify(this.data));
    } catch {}
  }

  getSettings() {
    return { ...this.data.settings };
  }

  setSettings(next) {
    this.data.settings = { ...this.data.settings, ...next };
    this._save();
  }

  getStats() {
    return { ...this.data.stats };
  }

  setStats(next) {
    this.data.stats = { ...this.data.stats, ...next };
    this._save();
  }

  resetAll() {
    this.data = this._defaults();
    this._save();
  }

  getDaily() {
    const key = this._dateKey();
    if (this.data.daily.dateKey !== key) {
      this.data.daily = { dateKey: key, missions: null };
      this._save();
    }
    return { ...this.data.daily };
  }

  setDaily(next) {
    this.data.daily = { ...this.data.daily, ...next };
    this._save();
  }
}
