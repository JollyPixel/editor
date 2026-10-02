// Import Internal Dependencies
import type {
  FrameCallback,
  FrameSource
} from "../FrameSource.ts";

export type AnimationLoopRendererCallback = (time: number) => void;

export interface AnimationLoopRenderer {
  setAnimationLoop(
    callback: AnimationLoopRendererCallback | null
  ): void;
}

/**
 * Frame source driven by a renderer's `setAnimationLoop()`.
 */
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
