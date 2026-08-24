/**
 * The scheduling result for one frame. Instances are never reused.
 */
export interface FrameSchedule {
  /**
   * Non-negative wall-clock delta before clamping and scaling, in ms.
   */
  rawDelta: number;
  /**
   * Wall-clock delta after clamping and scaling, in ms.
   */
  frameDelta: number;
  /**
   * Milliseconds per fixed step: `1000 / fixedFps`.
   */
  fixedDelta: number;
  /**
   * Fixed steps to run this frame.
   */
  steps: number;
  /**
   * Accumulator remainder as a fraction in `[0, 1)`.
   */
  alpha: number;
  /**
   * Whether to draw this frame under the render cap.
   */
  render: boolean;
  /**
   * Whether `rawDelta` exceeded `maxFrameDelta`.
   */
  clamped: boolean;
  /**
   * Whether the step limit discarded accumulated time.
   */
  panicked: boolean;
  /**
   * Discarded simulation time in ms, or zero without a panic.
   */
  droppedMs: number;
}
