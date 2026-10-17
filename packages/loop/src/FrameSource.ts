export type FrameCallback = (now: number) => void;

export interface FrameSource {
  start(
    callback: FrameCallback
  ): void;
  stop(): void;
}
