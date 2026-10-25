// Import Internal Dependencies
import type { Viewport } from "../rendering/Viewport.ts";
import { clamp } from "../utils/math.ts";
import type { Vec2 } from "../types.ts";

// CONSTANTS
const kEdgeBandPixels = 32;
const kRevealMarginPixels = 32;
const kMaxDepthRatio = 2;
const kSpeedPixelsPerSecond = 600;
const kFirstFrameMs = 1000 / 60;
const kMaxFrameMs = 100;

export interface EdgePanOptions {
  viewport: Viewport;
}

export class EdgePan {
  #viewport: Viewport;
  #velocity: Vec2 = {
    x: 0,
    y: 0
  };
  #remainder: Vec2 = {
    x: 0,
    y: 0
  };
  #frame: number | null = null;
  #lastTime: number | null = null;

  constructor(
    options: EdgePanOptions
  ) {
    this.#viewport = options.viewport;
  }

  aim(
    point: Readonly<Vec2>
  ): void {
    const viewport = this.#viewport;
    this.#velocity = {
      x: axisVelocity(point.x, viewport.canvasWidth),
      y: axisVelocity(point.y, viewport.canvasHeight)
    };

    if (this.#velocity.x === 0 && this.#velocity.y === 0) {
      this.stop();
    }
    else if (this.#frame === null) {
      this.#frame = requestAnimationFrame(this.#tick);
    }
  }

  stop(): void {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    this.#lastTime = null;
    this.#remainder = {
      x: 0,
      y: 0
    };
  }

  #tick = (
    time: number
  ): void => {
    const range = this.#viewport.panRange(kRevealMarginPixels);
    const velocity = {
      x: velocityWithin(this.#velocity.x, range.min.x, range.max.x),
      y: velocityWithin(this.#velocity.y, range.min.y, range.max.y)
    };
    if (velocity.x === 0 && velocity.y === 0) {
      this.stop();

      return;
    }

    const elapsed = this.#lastTime === null ?
      kFirstFrameMs :
      clamp(time - this.#lastTime, 0, kMaxFrameMs);
    this.#lastTime = time;
    this.#frame = requestAnimationFrame(this.#tick);

    const step = this.#step(velocity, elapsed / 1000);
    const dx = clamp(step.x, range.min.x, range.max.x);
    const dy = clamp(step.y, range.min.y, range.max.y);
    if (dx !== 0 || dy !== 0) {
      this.#viewport.applyPan(dx, dy);
    }
  };

  #step(
    velocity: Readonly<Vec2>,
    seconds: number
  ): Vec2 {
    const x = this.#remainder.x + (velocity.x * seconds);
    const y = this.#remainder.y + (velocity.y * seconds);
    const step = {
      x: Math.trunc(x),
      y: Math.trunc(y)
    };
    this.#remainder = {
      x: x - step.x,
      y: y - step.y
    };

    return step;
  }
}

function axisVelocity(
  position: number,
  size: number
): number {
  const before = kEdgeBandPixels - position;
  const after = position - (size - kEdgeBandPixels);
  const depth = before > 0 ? before : -Math.max(after, 0);
  const ratio = clamp(
    depth / kEdgeBandPixels,
    -kMaxDepthRatio,
    kMaxDepthRatio
  );

  return ratio * kSpeedPixelsPerSecond;
}

function velocityWithin(
  velocity: number,
  min: number,
  max: number
): number {
  if (velocity > 0) {
    return max > 0 ? velocity : 0;
  }

  return min < 0 ? velocity : 0;
}
