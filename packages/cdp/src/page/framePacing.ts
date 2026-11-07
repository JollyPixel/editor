export interface FramePacingThresholds {
  renderGapMs: number;
  wakeGapMs: number;
}

export interface FramePacing {
  startedAt: number;
  endedAt: number;
  elapsedMs: number;
  frames: number;
  worstMs: number;
  renders: number;
  wakes: number;
  idleMs: number;
}

interface PacingState {
  thresholds: FramePacingThresholds;
  frames: number;
  worstMs: number;
  started: number;
  last: number;
  running: boolean;
  renders: number;
  wakes: number;
  idleMs: number;
  lastRender: number;
  restore(): void;
}

interface CanvasContextClass {
  prototype: object;
}

type TextureAcquire = (this: unknown) => unknown;

// CONSTANTS
export const FRAME_PACING_THRESHOLDS: FramePacingThresholds = {
  renderGapMs: 4,
  wakeGapMs: 100
};

export function startFramePacing(
  thresholds: FramePacingThresholds
): void {
  const context = Reflect.get(window, "GPUCanvasContext") as
    CanvasContextClass | undefined;
  if (context === undefined) {
    throw new Error("WebGPU is unavailable, so renders cannot be counted");
  }

  const pacing: PacingState = {
    thresholds,
    frames: 0,
    worstMs: 0,
    started: performance.now(),
    last: performance.now(),
    running: true,
    renders: 0,
    wakes: 0,
    idleMs: 0,
    lastRender: performance.now(),
    restore: () => undefined
  };
  Reflect.set(window, "__perfPacing", pacing);

  function tick(now: number): void {
    pacing.frames++;
    pacing.worstMs = Math.max(pacing.worstMs, now - pacing.last);
    pacing.last = now;
    if (pacing.running) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);

  const { prototype } = context;
  const original = Reflect.get(
    prototype,
    "getCurrentTexture"
  ) as TextureAcquire;
  function countRender(this: unknown): unknown {
    const now = performance.now();
    const gap = now - pacing.lastRender;
    if (gap > thresholds.renderGapMs) {
      pacing.renders++;
      pacing.lastRender = now;
    }
    if (gap > thresholds.wakeGapMs) {
      pacing.wakes++;
      pacing.idleMs += gap;
    }

    return original.call(this);
  }
  Reflect.set(prototype, "getCurrentTexture", countRender);
  pacing.restore = () => {
    Reflect.set(prototype, "getCurrentTexture", original);
  };
}

export function stopFramePacing(): FramePacing {
  const pacing = Reflect.get(window, "__perfPacing") as PacingState;
  pacing.running = false;
  pacing.restore();
  const now = performance.now();
  const trailingGap = now - pacing.lastRender;

  return {
    startedAt: performance.timeOrigin + pacing.started,
    endedAt: performance.timeOrigin + now,
    elapsedMs: Math.round(now - pacing.started),
    frames: pacing.frames,
    worstMs: Math.round(pacing.worstMs),
    renders: pacing.renders,
    wakes: pacing.wakes,
    idleMs: Math.round(
      pacing.idleMs + (trailingGap > pacing.thresholds.wakeGapMs ? trailingGap : 0)
    )
  };
}
