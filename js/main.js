import { Game } from "./core/Game.js";
import { Storage } from "./core/Storage.js";
import { AudioBus } from "./core/Audio.js";

const canvas = document.getElementById("game");
const storage = new Storage("flappy_remix_v1");
const audio = new AudioBus(storage);

const game = new Game({
  canvas,
  storage,
  audio,
  ui: wireUI(),
});

game.boot();
game.startMainLoop();

function wireUI() {
  const $ = (id) => document.getElementById(id);

  const ui = {
    hud: $("hud"),
    hudScore: $("hudScore"),
    chipMode: $("chipMode"),
    chipTheme: $("chipTheme"),
    chipMission: $("chipMission"),

    overlayHome: $("overlayHome"),
    overlayReady: $("overlayReady"),
    overlayPause: $("overlayPause"),
    overlayResult: $("overlayResult"),

    homeBest: $("homeBest"),
    homeRuns: $("homeRuns"),
    homeTotalScore: $("homeTotalScore"),

    resultScore: $("resultScore"),
    resultBest: $("resultBest"),
    resultCoins: $("resultCoins"),
    resultMission: $("resultMission"),
    resultHint: $("resultHint"),

    modalSettings: $("modalSettings"),
    modalStats: $("modalStats"),

    setSound: $("setSound"),
    setMusic: $("setMusic"),
    setVibration: $("setVibration"),
    setReducedMotion: $("setReducedMotion"),
    setHighContrast: $("setHighContrast"),
    setInput: $("setInput"),
    setDifficulty: $("setDifficulty"),

    statBest: $("statBest"),
    statRuns: $("statRuns"),
    statTotalScore: $("statTotalScore"),
    statCoins: $("statCoins"),
    statStreak: $("statStreak"),

    btnPlay: $("btnPlay"),
    btnPractice: $("btnPractice"),
    btnQuickRestart: $("btnQuickRestart"),
    btnSettings: $("btnSettings"),
    btnStats: $("btnStats"),

    btnCloseSettings: $("btnCloseSettings"),
    btnCloseStats: $("btnCloseStats"),

    btnResume: $("btnResume"),
    btnRestart: $("btnRestart"),
    btnQuit: $("btnQuit"),

    btnRetry: $("btnRetry"),
    btnBackHome: $("btnBackHome"),

    btnResetData: $("btnResetData"),
  };

  return ui;
}

window.__FLAPPY__ = { game };
