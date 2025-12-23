export class Bird {
  constructor(cfg) {
    this.x = cfg.x;
    this.y = 260;
    this.vy = 0;
    this.r = cfg.r;
    this.alive = true;
    this.tilt = 0;
    this.perfectPasses = 0;
    this.lastPassPerfect = false;
  }

  reset(y = 260) {
    this.y = y;
    this.vy = 0;
    this.alive = true;
    this.tilt = 0;
    this.perfectPasses = 0;
    this.lastPassPerfect = false;
  }
}

export class PipePair {
  constructor(x, topH, gap, w) {
    this.x = x;
    this.topH = topH;
    this.gap = gap;
    this.w = w;
    this.passed = false;
  }

  get bottomY() {
    return this.topH + this.gap;
  }
}
