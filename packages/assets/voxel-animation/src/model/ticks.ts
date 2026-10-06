export const TICKS_PER_SECOND = 24000;

export function isFrameRate(
  fps: number
): boolean {
  return Number.isInteger(fps) && fps > 0 && TICKS_PER_SECOND % fps === 0;
}

export function ticksPerFrame(
  fps: number
): number {
  return TICKS_PER_SECOND / fps;
}

export function frameToTick(
  frame: number,
  fps: number
): number {
  return Math.round(frame * ticksPerFrame(fps));
}

export function snapToFrame(
  tick: number,
  fps: number
): number {
  return frameToTick(Math.round(tickToFrame(tick, fps)), fps);
}

export function tickToFrame(
  tick: number,
  fps: number
): number {
  return tick / ticksPerFrame(fps);
}

export function frameAt(
  tick: number,
  fps: number
): number {
  return Math.round(tickToFrame(tick, fps));
}
