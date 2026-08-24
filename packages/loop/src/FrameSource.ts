/**
 * Receives a frame timestamp in milliseconds from the source's clock.
 */
export type FrameCallback = (now: number) => void;

/**
 * Pumps frames without applying a frame-rate cap.
 * `start()` may emit synchronously and must replace any prior subscription.
 */
export interface FrameSource {
  start(
    callback: FrameCallback
  ): void;
  stop(): void;
}
