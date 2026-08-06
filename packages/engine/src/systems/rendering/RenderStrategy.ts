// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { RenderComponent } from "./Renderer.ts";

/**
 * "composer" is reserved for a future WebGPU-native post-processing rebuild
 * (three's classic EffectComposer is WebGLRenderer-only) — only "direct" is
 * implemented today.
 */
export type RenderMode = "direct";

export interface RenderParameters {
  /** Pre-sorted by `depth` ascending — strategies must not re-sort. */
  components: readonly RenderComponent[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface RenderStrategy {
  render(
    scene: THREE.Scene,
    parameters: RenderParameters
  ): void;
  resize(
    width: number,
    height: number
  ): void;
  /** Releases GPU resources owned by the strategy. */
  dispose(): void;
}

export class DirectRenderStrategy implements RenderStrategy {
  #renderer: THREE.WebGPURenderer;

  constructor(
    renderer: THREE.WebGPURenderer
  ) {
    this.#renderer = renderer;
  }

  render(
    scene: THREE.Scene,
    parameters: RenderParameters
  ): void {
    const {
      components: sorted,
      canvasWidth,
      canvasHeight
    } = parameters;

    const hasViewports = sorted.some((rc) => rc.viewport !== null);

    if (!hasViewports) {
      // Fast path: clear once, render all cameras full-canvas
      this.#renderer.setViewport(0, 0, canvasWidth, canvasHeight);
      this.#renderer.clear();
    }

    for (const rc of sorted) {
      rc.prepareRender(canvasWidth, canvasHeight);

      if (hasViewports) {
        const vp = rc.viewport ?? { x: 0, y: 0, width: 1, height: 1 };
        const vx = Math.round(vp.x * canvasWidth);
        const vy = Math.round(vp.y * canvasHeight);
        const vw = Math.round(vp.width * canvasWidth);
        const vh = Math.round(vp.height * canvasHeight);

        this.#renderer.setViewport(vx, vy, vw, vh);
        this.#renderer.setScissor(vx, vy, vw, vh);
        this.#renderer.setScissorTest(true);
        this.#renderer.clear();
      }

      this.#renderer.render(scene, rc.threeCamera);
    }

    if (hasViewports) {
      this.#renderer.setScissorTest(false);
      this.#renderer.setViewport(0, 0, canvasWidth, canvasHeight);
    }
  }

  resize(
    width: number,
    height: number
  ): void {
    this.#renderer.setSize(width, height, false);
  }

  dispose(): void {
    // The WebGPURenderer is owned by ThreeRenderer, not by the strategy.
  }
}
