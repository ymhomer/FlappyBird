import { StateMachine } from "./StateMachine.js";
import { CONFIG } from "../game/Config.js";
import { Bird } from "../game/Entities.js";
import { rectCircleCollide, spawnPipe, pickDailyMissions, clamp } from "../game/Systems.js";

export class Game {
  constructor({ canvas, storage, audio, ui }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.storage = storage;
    this.audio = audio;
    this.ui = ui;

    this.sm = new StateMachine("home");
    this.w = CONFIG.world.width;
    this.h = CONFIG.world.height;

    this.bird = new Bird(CONFIG.bird);
    this.pipes = [];
    this.score = 0;
    this.best = 0;
    this.coinsThisRun = 0;

    this.mode = "Classic";
    this.theme = "Day";
    this.practice = false;

    this._lastTs = 0;
    this._accPipe = 0;
    this._timeAlive = 0;

    this._missionDaily = [];
    this._missionActive = null;

    this._pausedByBlur = false;

    this._bindStateHandlers();
  }

  boot() {
    this._syncCanvas();
    this._loadAndRenderHome();
    this._wireUIEvents();
    this._wireInputs();
    this._wireVisibility();

    this.audio.applyMusicSetting();
    this.draw(0); // initial render
  }

  startMainLoop() {
    const loop = (ts) => {
      const dt = this._lastTs ? (ts - this._lastTs) / 1000 : 0;
      this._lastTs = ts;

      this.update(dt);
      this.draw(dt);

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _syncCanvas() {
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  _bindStateHandlers() {
    this.sm
      .on("home", () => {
        this._setHUDVisible(false);
        this._showOverlay("home");
      })
      .on("ready", () => {
        this._setHUDVisible(true);
        this._showOverlay("ready");
      })
      .on("playing", () => {
        this._setHUDVisible(true);
        this._hideAllOverlays();
      })
      .on("paused", () => {
        this._setHUDVisible(true);
        this._showOverlay("pause");
      })
      .on("result", () => {
        this._setHUDVisible(false);
        this._showOverlay("result");
      });
  }

  _wireUIEvents() {
    const u = this.ui;

    const openSettings = () => { this.audio.sfxUI(); this._openModal("settings"); };
    const openStats = () => { this.audio.sfxUI(); this._openModal("stats"); };

    u.btnSettings.addEventListener("click", openSettings);
    u.btnStats.addEventListener("click", openStats);

    u.btnCloseSettings.addEventListener("click", () => { this.audio.sfxUI(); this._closeModal("settings"); });
    u.btnCloseStats.addEventListener("click", () => { this.audio.sfxUI(); this._closeModal("stats"); });

    u.btnPlay.addEventListener("click", async () => {
      this.audio.sfxUI();
      await this.audio.unlock();
      this.startRun({ practice: false, instant: false });
    });

    u.btnPractice.addEventListener("click", async () => {
      this.audio.sfxUI();
      await this.audio.unlock();
      this.startRun({ practice: true, instant: false });
    });

    u.btnQuickRestart.addEventListener("click", async () => {
      this.audio.sfxUI();
      await this.audio.unlock();
      this.startRun({ practice: false, instant: true });
    });

    u.btnResume.addEventListener("click", () => { this.audio.sfxUI(); this.resume(); });
    u.btnRestart.addEventListener("click", () => { this.audio.sfxUI(); this.restart(); });
    u.btnQuit.addEventListener("click", () => { this.audio.sfxUI(); this.quitToHome(); });

    u.btnRetry.addEventListener("click", async () => {
      this.audio.sfxUI();
      await this.audio.unlock();
      this.startRun({ practice: this.practice, instant: true });
    });
    u.btnBackHome.addEventListener("click", () => { this.audio.sfxUI(); this.quitToHome(); });

    u.btnResetData.addEventListener("click", () => {
      this.audio.sfxUI();
      this.storage.resetAll();
      this._loadAndRenderHome();
      this._syncSettingsUI();
      this._syncStatsUI();
    });

    // Settings change
    const applySettings = () => {
      const next = {
        sound: u.setSound.checked,
        music: u.setMusic.checked,
        vibration: u.setVibration.checked,
        reducedMotion: u.setReducedMotion.checked,
        highContrast: u.setHighContrast.checked,
        input: u.setInput.value,
        difficulty: u.setDifficulty.value,
      };
      this.storage.setSettings(next);
      this.audio.applyMusicSetting();
      this._applyContrast();
    };

    [u.setSound, u.setMusic, u.setVibration, u.setReducedMotion, u.setHighContrast, u.setInput, u.setDifficulty]
      .forEach(el => el.addEventListener("change", applySettings));

    this._syncSettingsUI();
    this._syncStatsUI();
  }

  _wireInputs() {
    const onFlap = async () => {
      if (this.sm.is("home")) {
        await this.audio.unlock();
        this.startRun({ practice: false, instant: false });
        return;
      }
      if (this.sm.is("ready")) {
        this.sm.set("playing");
        return;
      }
      if (this.sm.is("playing")) {
        this.flap();
        return;
      }
      if (this.sm.is("result")) {
        await this.audio.unlock();
        this.startRun({ practice: this.practice, instant: true });
      }
    };

    // Canvas click/tap
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onFlap();
    });

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") { e.preventDefault(); onFlap(); }
      if (e.code === "KeyP" || e.code === "Escape") {
        if (this.sm.is("playing")) this.pause();
        else if (this.sm.is("paused")) this.resume();
      }
      if (e.code === "KeyR") {
        if (this.sm.is("playing") || this.sm.is("paused") || this.sm.is("result")) this.restart();
      }
    });

    // Optional: hold mode (easy)
    window.addEventListener("pointermove", () => {
      const s = this.storage.getSettings();
      if (!this.sm.is("playing")) return;
      if (s.input !== "hold") return;
    });

    window.addEventListener("pointerup", () => {
      // reserved
    });
  }

  _wireVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (this.sm.is("playing")) {
          this._pausedByBlur = true;
          this.pause();
        }
      } else {
        if (this.sm.is("paused") && this._pausedByBlur) {
          this._pausedByBlur = false;
          // keep paused until user resumes (less surprising)
        }
      }
    });
  }

  _applyContrast() {
    const s = this.storage.getSettings();
    document.body.style.filter = s.highContrast ? "contrast(1.1) saturate(1.05)" : "none";
  }

  _syncSettingsUI() {
    const s = this.storage.getSettings();
    const u = this.ui;
    u.setSound.checked = !!s.sound;
    u.setMusic.checked = !!s.music;
    u.setVibration.checked = !!s.vibration;
    u.setReducedMotion.checked = !!s.reducedMotion;
    u.setHighContrast.checked = !!s.highContrast;
    u.setInput.value = s.input || "tap";
    u.setDifficulty.value = s.difficulty || "normal";
    this._applyContrast();
  }

  _syncStatsUI() {
    const st = this.storage.getStats();
    const u = this.ui;
    u.statBest.textContent = st.best;
    u.statRuns.textContent = st.runs;
    u.statTotalScore.textContent = st.totalScore;
    u.statCoins.textContent = st.coins;
    u.statStreak.textContent = st.bestStreak;

    u.homeBest.textContent = st.best;
    u.homeRuns.textContent = st.runs;
    u.homeTotalScore.textContent = st.totalScore;
  }

  _loadAndRenderHome() {
    const st = this.storage.getStats();
    this.best = st.best;
    this._syncStatsUI();
    this.sm.set("home");
  }

  _setHUDVisible(on) {
    this.ui.hud.style.display = on ? "flex" : "none";
  }

  _hideAllOverlays() {
    this.ui.overlayHome.classList.remove("visible");
    this.ui.overlayReady.classList.remove("visible");
    this.ui.overlayPause.classList.remove("visible");
    this.ui.overlayResult.classList.remove("visible");
  }

  _showOverlay(which) {
    this._hideAllOverlays();
    if (which === "home") this.ui.overlayHome.classList.add("visible");
    if (which === "ready") this.ui.overlayReady.classList.add("visible");
    if (which === "pause") this.ui.overlayPause.classList.add("visible");
    if (which === "result") this.ui.overlayResult.classList.add("visible");
  }

  _openModal(which) {
    if (which === "settings") this.ui.modalSettings.classList.add("visible");
    if (which === "stats") {
      this._syncStatsUI();
      this.ui.modalStats.classList.add("visible");
    }
  }

  _closeModal(which) {
    if (which === "settings") this.ui.modalSettings.classList.remove("visible");
    if (which === "stats") this.ui.modalStats.classList.remove("visible");
  }

  startRun({ practice, instant }) {
    this.practice = !!practice;
    this._resetRun();

    // pick mode/theme/mission
    this.mode = CONFIG.patterns[Math.floor(Math.random() * CONFIG.patterns.length)];
    this.theme = CONFIG.themes[Math.floor(Math.random() * CONFIG.themes.length)];

    this._missionDaily = pickDailyMissions(this.storage);
    this._missionActive = this._missionDaily[Math.floor(Math.random() * this._missionDaily.length)];

    this._syncHUDMeta();

    if (instant) this.sm.set("playing");
    else this.sm.set("ready");
  }

  _syncHUDMeta() {
    this.ui.chipMode.textContent = `Mode: ${this.mode}`;
    this.ui.chipTheme.textContent = `Theme: ${this.theme}`;
    this.ui.chipMission.textContent = `Mission: ${this._missionActive ? this._missionActive.name : "—"}`;
  }

  _resetRun() {
    this.score = 0;
    this.coinsThisRun = 0;
    this._accPipe = 0;
    this._timeAlive = 0;

    this.bird.reset(260);
    this.pipes.length = 0;

    this.ui.hudScore.textContent = "0";

    // spawn first pipe offscreen
    spawnPipe({
      pipes: this.pipes,
      x: this.w + 80,
      gap: this._gapNow(),
      w: CONFIG.pipes.w,
      mode: this.mode,
      timeAlive: this._timeAlive,
    });
  }

  pause() {
    if (!this.sm.is("playing")) return;
    this.sm.set("paused");
  }

  resume() {
    if (!this.sm.is("paused")) return;
    this.sm.set("playing");
  }

  restart() {
    this.startRun({ practice: this.practice, instant: true });
  }

  quitToHome() {
    this.sm.set("home");
    this._syncStatsUI();
  }

  flap() {
    const s = this.storage.getSettings();
    this.bird.vy = CONFIG.bird.jumpV;
    this.audio.sfxJump();
    if (s.vibration) this._vibrate(12);
  }

  _vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  }

  _gapNow() {
    const s = this.storage.getSettings();
    const d = CONFIG.difficulty[s.difficulty] ?? CONFIG.difficulty.normal;
    return CONFIG.pipes.gap * d.gapMul;
  }

  _speedNow() {
    const s = this.storage.getSettings();
    const d = CONFIG.difficulty[s.difficulty] ?? CONFIG.difficulty.normal;
    // ramp makes it harder over time (gentle)
    const ramp = 1 + (this._timeAlive * d.ramp);
    return CONFIG.pipes.speed * d.speedMul * ramp;
  }

  update(dt) {
    if (!dt || dt > 0.05) dt = 0.016; // stability
    if (!this.sm.is("playing")) return;

    const s = this.storage.getSettings();

    this._timeAlive += dt;

    // hold mode (easy): gently counter gravity while pointer down
    if (s.input === "hold" && (window.__pointerDown === true)) {
      this.bird.vy = Math.min(this.bird.vy, 120);
    }

    // Bird physics
    this.bird.vy += CONFIG.bird.gravity * dt;
    this.bird.vy = clamp(this.bird.vy, -1000, CONFIG.bird.maxFall);
    this.bird.y += this.bird.vy * dt;

    // tilt
    if (!s.reducedMotion) {
      const target = this.bird.vy < 0 ? CONFIG.bird.tiltUp : CONFIG.bird.tiltDown;
      this.bird.tilt += (target - this.bird.tilt) * 0.12;
    } else {
      this.bird.tilt = 0;
    }

    // Ground / ceiling
    const groundY = this.h - CONFIG.world.groundH;
    if (this.bird.y + this.bird.r >= groundY) {
      this.bird.y = groundY - this.bird.r;
      this._die("ground");
      return;
    }
    if (this.bird.y - this.bird.r <= 0) {
      this.bird.y = this.bird.r;
      this._die("ceiling");
      return;
    }

    // Pipes
    const speed = this._speedNow();
    for (const p of this.pipes) p.x -= speed * dt;

    // Spawn
    this._accPipe += dt;
    if (this._accPipe >= CONFIG.pipes.spawnEvery) {
      this._accPipe = 0;
      spawnPipe({
        pipes: this.pipes,
        x: this.w + 30,
        gap: this._gapNow(),
        w: CONFIG.pipes.w,
        mode: this.mode,
        timeAlive: this._timeAlive,
      });
    }

    // Cull
    while (this.pipes.length && this.pipes[0].x + this.pipes[0].w < -20) this.pipes.shift();

    // Collision + scoring
    const cr = Math.max(6, this.bird.r - CONFIG.bird.hitboxPad);
    for (const p of this.pipes) {
      const rx = p.x;
      const rw = p.w;
      // top rect
      const hitTop = rectCircleCollide(rx, 0, rw, p.topH, this.bird.x, this.bird.y, cr);
      // bottom rect
      const by = p.bottomY;
      const hitBot = rectCircleCollide(rx, by, rw, (this.h - CONFIG.world.groundH) - by, this.bird.x, this.bird.y, cr);

      if (hitTop || hitBot) {
        this._die("pipe");
        return;
      }

      // pass
      if (!p.passed && p.x + p.w < this.bird.x - this.bird.r) {
        p.passed = true;
        this.score += 1;
        this.ui.hudScore.textContent = String(this.score);
        this.audio.sfxScore();

        // perfect pass: bird near mid gap
        const mid = p.topH + p.gap / 2;
        const dist = Math.abs(this.bird.y - mid);
        const perfect = dist <= 18;
        this.bird.lastPassPerfect = perfect;
        if (perfect) this.bird.perfectPasses += 1;

        if (s.vibration) this._vibrate(perfect ? 18 : 10);
      }
    }
  }

  _die(reason) {
    if (!this.sm.is("playing")) return;
    this.audio.sfxHit();
    const s = this.storage.getSettings();
    if (s.vibration) this._vibrate(35);

    // coins (practice gives none)
    if (!this.practice) {
      const base = CONFIG.coins.basePerRun;
      const fromScore = this.score * CONFIG.coins.perScore;
      const fromPerfect = this.bird.perfectPasses * CONFIG.coins.perfectBonus;
      this.coinsThisRun = base + fromScore + fromPerfect;
    } else {
      this.coinsThisRun = 0;
    }

    // stats
    const st = this.storage.getStats();
    const runs = st.runs + (this.practice ? 0 : 1);
    const totalScore = st.totalScore + (this.practice ? 0 : this.score);
    const coins = st.coins + this.coinsThisRun;
    const best = Math.max(st.best, this.score);
    const bestStreak = Math.max(st.bestStreak, this.score);

    this.storage.setStats({ runs, totalScore, coins, best, bestStreak });
    this.best = best;

    // result UI
    this.ui.resultScore.textContent = String(this.score);
    this.ui.resultBest.textContent = String(best);
    this.ui.resultCoins.textContent = String(this.coinsThisRun);
    this.ui.resultMission.textContent = this._missionResultText();
    this.ui.resultHint.textContent = this._resultHintText(reason);

    this._syncStatsUI();
    this.sm.set("result");
  }

  _missionResultText() {
    if (!this._missionActive) return "—";
    const m = this._missionActive;
    if (m.type === "score") return (this.score >= m.target) ? "Completed" : `Progress: ${this.score}/${m.target}`;
    if (m.type === "perfect") return (this.bird.perfectPasses >= m.target) ? "Completed" : `Progress: ${this.bird.perfectPasses}/${m.target}`;
    if (m.type === "time") return (this._timeAlive >= m.target) ? "Completed" : `Progress: ${Math.floor(this._timeAlive)}/${m.target}s`;
    return "—";
  }

  _resultHintText(reason) {
    const lines = [
      "“One more run.”",
      "“Clean lines win.”",
      "“You were close.”",
      "“Breathe. Tap.”",
    ];
    const pick = lines[Math.floor(Math.random() * lines.length)];
    if (this.practice) return `${pick} (Practice)`;
    if (reason === "pipe") return `${pick} (Clipped a pipe)`;
    if (reason === "ground") return `${pick} (Too low)`;
    if (reason === "ceiling") return `${pick} (Too high)`;
    return pick;
  }

  draw(dt) {
    const ctx = this.ctx;
    const s = this.storage.getSettings();

    // background
    this._drawBackground(ctx, s);

    // pipes
    this._drawPipes(ctx, s);

    // ground
    this._drawGround(ctx, s);

    // bird
    this._drawBird(ctx, s);

    // minimal debug / clarity (optional)
    // (kept off in v1)
  }

  _drawBackground(ctx, s) {
  const W = this.w;
  const H = this.h;

  // === 1️⃣ 强制清屏（关键，去掉大部分残影） ===
  // 用接近最暗背景色，而不是 clearRect，避免闪烁
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0b0f17";
  ctx.fillRect(0, 0, W, H);

  // === 2️⃣ 主题色设定 ===
  let top = "rgba(120,160,255,.22)";
  let mid = "rgba(20,30,60,.26)";
  let fog = "rgba(255,255,255,.015)";

  switch (this.theme) {
    case "Sunset":
      top = "rgba(255,160,120,.20)";
      mid = "rgba(40,20,50,.30)";
      fog = "rgba(255,220,180,.02)";
      break;

    case "Night":
      top = "rgba(120,140,255,.12)";
      mid = "rgba(10,14,26,.36)";
      fog = "rgba(255,255,255,.01)";
      break;

    case "Rain":
      top = "rgba(140,180,200,.12)";
      mid = "rgba(10,16,24,.34)";
      fog = "rgba(255,255,255,.015)";
      break;
  }

  // === 3️⃣ 垂直渐层（主体背景） ===
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(0.6, mid);
  g.addColorStop(1, "rgba(0,0,0,.20)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // === 4️⃣ 极轻雾层（保留空气感，但不会累积残影） ===
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, H);

  // === 5️⃣ 雨粒（尊重 Reduced Motion） ===
  if (this.theme === "Rain" && !s.reducedMotion) {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(230,245,255,.65)";
    ctx.lineWidth = 1;

    const t = performance.now() * 0.001;
    for (let i = 0; i < 60; i++) {
      const x = (i * 37 + t * 120) % W;
      const y = (i * 83 + t * 220) % (H - 90);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + 14);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}


  _drawPipes(ctx, s) {
    const groundY = this.h - CONFIG.world.groundH;
    for (const p of this.pipes) {
      const x = p.x;
      const w = p.w;

      // pipe body
      const pipeFill = s.highContrast ? "rgba(255,255,255,.90)" : "rgba(255,255,255,.16)";
      const pipeEdge = s.highContrast ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.10)";

      ctx.fillStyle = pipeFill;
      ctx.strokeStyle = pipeEdge;
      ctx.lineWidth = 2;

      // top
      roundRect(ctx, x, 0, w, p.topH, 12);
      ctx.fill();
      ctx.stroke();

      // bottom
      const by = p.bottomY;
      roundRect(ctx, x, by, w, groundY - by, 12);
      ctx.fill();
      ctx.stroke();

      // caps
      ctx.fillStyle = s.highContrast ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.22)";
      ctx.fillRect(x - 2, p.topH - 10, w + 4, 10);
      ctx.fillRect(x - 2, by, w + 4, 10);
    }
  }

  _drawGround(ctx, s) {
    const W = this.w;
    const H = this.h;
    const gh = CONFIG.world.groundH;

    ctx.fillStyle = s.highContrast ? "rgba(255,255,255,.88)" : "rgba(0,0,0,.28)";
    ctx.fillRect(0, H - gh, W, gh);

    ctx.fillStyle = s.highContrast ? "rgba(0,0,0,.65)" : "rgba(255,255,255,.08)";
    ctx.fillRect(0, H - gh, W, 3);
  }

  _drawBird(ctx, s) {
    const ctx2 = ctx;
    const b = this.bird;

    ctx2.save();
    ctx2.translate(b.x, b.y);
    ctx2.rotate(b.tilt);

    // body
    ctx2.fillStyle = s.highContrast ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.75)";
    ctx2.strokeStyle = s.highContrast ? "rgba(0,0,0,.65)" : "rgba(0,0,0,.22)";
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.stroke();

    // eye
    ctx2.fillStyle = s.highContrast ? "rgba(0,0,0,.78)" : "rgba(0,0,0,.40)";
    ctx2.beginPath();
    ctx2.arc(5, -4, 2.4, 0, Math.PI * 2);
    ctx2.fill();

    // beak
    ctx2.fillStyle = s.highContrast ? "rgba(0,0,0,.70)" : "rgba(0,0,0,.22)";
    ctx2.beginPath();
    ctx2.moveTo(b.r - 1, 0);
    ctx2.lineTo(b.r + 7, 2);
    ctx2.lineTo(b.r - 1, 6);
    ctx2.closePath();
    ctx2.fill();

    ctx2.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Global pointer state for hold-mode
window.__pointerDown = false;
window.addEventListener("pointerdown", () => { window.__pointerDown = true; });
window.addEventListener("pointerup", () => { window.__pointerDown = false; });
window.addEventListener("pointercancel", () => { window.__pointerDown = false; });
