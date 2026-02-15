// CONSTANTS
const kDefaultMaxFps = 60;
const kDefaultFixedFps = 60;
const kMaxAccumulatedSteps = 5;

class InternalTimer {
  #last = 0;
  #delta = 0;

  start() {
    this.#last = performance.now();
    this.#delta = 0;
  }

  update() {
    const now = performance.now();
    this.#delta = now - this.#last;
    this.#last = now;
  }

  getDelta() {
    return this.#delta;
  }
}

export interface FixedTimeStepCallbacks {
  // Called every fixed step (physics/deterministic logic)
  fixedUpdate: (fixedDelta: number) => void;
  // Called every frame (rendering/variable logic)
  update?: (interpolation: number, delta: number) => void;
}

export class FixedTimeStep {
  static MaxFramesPerSecond = kDefaultMaxFps;

  #timer: InternalTimer;
  #accumulated = 0;
  #fixedDelta: number;
  #maxAccumulated: number;
  #running = false;

  framesPerSecond = kDefaultMaxFps;
  fixedFramesPerSecond = kDefaultFixedFps;

  constructor(
    fps: number = kDefaultMaxFps,
    fixedFps: number = kDefaultFixedFps
  ) {
    this.framesPerSecond = fps;
    this.fixedFramesPerSecond = fixedFps;
    this.#fixedDelta = 1000 / this.fixedFramesPerSecond;
    this.#maxAccumulated = kMaxAccumulatedSteps * this.#fixedDelta;
    this.#timer = new InternalTimer();
  }

  setFps(
    fps: number,
    fixedFps: number = fps
  ): void {
    if (typeof fps === "number") {
      this.framesPerSecond = Math.max(1, Math.min(fps, FixedTimeStep.MaxFramesPerSecond));
    }
    if (typeof fixedFps === "number") {
      this.fixedFramesPerSecond = Math.max(1, Math.min(fixedFps, FixedTimeStep.MaxFramesPerSecond));
    }

    this.#fixedDelta = 1000 / this.fixedFramesPerSecond;
    this.#maxAccumulated = kMaxAccumulatedSteps * this.#fixedDelta;
  }

  start() {
    this.#accumulated = 0;
    this.#timer.start();
    this.#running = true;
  }

  stop() {
    this.#running = false;
  }

  /**
   * Main loop. Call this from your requestAnimationFrame or similar.
   * @param callbacks { fixedUpdate, update }
   */
  tick(
    callbacks: FixedTimeStepCallbacks
  ): void {
    if (!this.#running) {
      return;
    }

    this.#timer.update();
    let delta = this.#timer.getDelta();
    if (delta > 1000) {
      // Prevent huge catch-up after tab switch or pause
      delta = this.#fixedDelta;
    }
    this.#accumulated += delta;
    if (this.#accumulated > this.#maxAccumulated) {
      this.#accumulated = this.#maxAccumulated;
    }

    // Fixed update steps
    let steps = 0;
    while (this.#accumulated >= this.#fixedDelta) {
      callbacks.fixedUpdate(this.#fixedDelta);
      this.#accumulated -= this.#fixedDelta;
      steps++;
      if (steps > kMaxAccumulatedSteps) {
        // Avoid spiral of death
        this.#accumulated = 0;
        break;
      }
    }

    // Variable update (render/interpolation)
    if (callbacks.update) {
      const alpha = this.#accumulated / this.#fixedDelta;
      callbacks.update(alpha, delta);
    }
  }
}
