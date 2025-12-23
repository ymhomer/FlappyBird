import { PipePair } from "./Entities.js";
import { CONFIG } from "./Config.js";

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
  const px = clamp(cx, rx, rx + rw);
  const py = clamp(cy, ry, ry + rh);
  const dx = cx - px;
  const dy = cy - py;
  return (dx * dx + dy * dy) <= (cr * cr);
}

export function pickDailyMissions(storage) {
  const daily = storage.getDaily();
  if (daily.missions) return daily.missions;

  const pool = [
    { id: "score10",  name: "Score 10+", type: "score", target: 10 },
    { id: "score20",  name: "Score 20+", type: "score", target: 20 },
    { id: "perfect3", name: "3 Perfect Passes", type: "perfect", target: 3 },
    { id: "survive30",name: "Survive 30s", type: "time", target: 30 },
  ];

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const pick = shuffled.slice(0, 2); // daily 2 missions in v1
  storage.setDaily({ missions: pick });
  return pick;
}

export function buildPattern(mode, t, baseTop, minTop, maxTop) {
  // deterministic-ish variations for readability
  if (mode === "Classic") return baseTop;

  if (mode === "Wave") {
    const wave = Math.sin(t * 0.9) * 70;
    return clamp(baseTop + wave, minTop, maxTop);
  }

  if (mode === "Stairs") {
    const step = Math.floor((t * 0.8) % 6); // 0..5
    const stair = (step - 2.5) * 28;
    return clamp(baseTop + stair, minTop, maxTop);
  }

  return baseTop;
}

export function spawnPipe({
  pipes,
  x,
  gap,
  w,
  mode,
  timeAlive,
}) {
  const topH0 = rand(CONFIG.pipes.minTop, CONFIG.pipes.maxTop);
  const topH = buildPattern(mode, timeAlive, topH0, CONFIG.pipes.minTop, CONFIG.pipes.maxTop);
  pipes.push(new PipePair(x, topH, gap, w));
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}
