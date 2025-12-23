export const CONFIG = {
  world: {
    width: 360,
    height: 640,
    groundH: 92,
  },

  bird: {
    x: 110,
    r: 14,
    hitboxPad: 3,          // “寬容度”：數值越大越寬容
    gravity: 1600,
    jumpV: -460,
    maxFall: 720,
    tiltUp: -0.35,
    tiltDown: 0.55,
  },

  pipes: {
    gap: 165,
    w: 62,
    minTop: 70,
    maxTop: 380,
    spawnEvery: 1.25,      // seconds
    speed: 210,            // px/s
  },

  difficulty: {
    normal: { gapMul: 1.0, speedMul: 1.0, ramp: 0.010 },
    soft:   { gapMul: 1.08, speedMul: 0.95, ramp: 0.007 },
    hard:   { gapMul: 0.92, speedMul: 1.06, ramp: 0.013 },
  },

  coins: {
    basePerRun: 0,
    perScore: 1,
    perfectBonus: 1,
  },

  patterns: ["Classic", "Wave", "Stairs"],
  themes: ["Day", "Sunset", "Night", "Rain"],
};
