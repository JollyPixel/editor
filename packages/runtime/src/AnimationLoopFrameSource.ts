// Import Third-party Dependencies
import type {
  FrameCallback,
  FrameSource
} from "@jolly-pixel/loop";

export type AnimationLoopRendererCallback = (time: number) => void;

export interface AnimationLoopRenderer {
  setAnimationLoop(
    callback: AnimationLoopRendererCallback | null
  ): void;
}

export class AnimationLoopFrameSource implements FrameSource {
  #renderer: AnimationLoopRenderer;

  constructor(
    renderer: AnimationLoopRenderer
  ) {
    this.#renderer = renderer;
  }

  start(
    callback: FrameCallback
  ): void {
    this.#renderer.setAnimationLoop(
      (time) => callback(time)
    );
  }

  stop(): void {
    this.#renderer.setAnimationLoop(null);
  }
}
