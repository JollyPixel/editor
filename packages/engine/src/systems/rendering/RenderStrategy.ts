// Import Third-party Dependencies
import * as THREE from "three";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import type { Pass } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

// Import Internal Dependencies
import type { RenderComponent } from "./Renderer.ts";

export type RenderMode = "direct" | "composer";

/**
 * Maps depth-sorted components onto their render passes and fixes the clear
 * flags: a RenderPass clears by default, which would wipe the previous
 * camera's output, so only the first one may clear the color buffer.
 * Components without a pass are skipped.
 */
export function orderRenderPasses(
  components: readonly RenderComponent[],
  passes: ReadonlyMap<RenderComponent, RenderPass>
): RenderPass[] {
  const ordered: RenderPass[] = [];

  for (const component of components) {
    const pass = passes.get(component);
    if (!pass) {
      continue;
    }

    const isFirst = ordered.length === 0;
    pass.clear = isFirst;
    pass.clearDepth = !isFirst;
    ordered.push(pass);
  }

  return ordered;
}

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
  #renderer: THREE.WebGLRenderer;

  constructor(
    renderer: THREE.WebGLRenderer
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
    // The WebGLRenderer is owned by ThreeRenderer, not by the strategy.
  }
}

export class ComposerRenderStrategy implements RenderStrategy {
  #renderer: THREE.WebGLRenderer;
  #composer: EffectComposer;

  constructor(
    renderer: THREE.WebGLRenderer,
    composer: EffectComposer
  ) {
    this.#renderer = renderer;
    this.#composer = composer;
  }

  render(
    scene: THREE.Scene,
    parameters: RenderParameters
  ): void {
    const {
      components: renderComponents,
      canvasWidth,
      canvasHeight
    } = parameters;

    for (const rc of renderComponents) {
      rc.prepareRender(canvasWidth, canvasHeight);
    }
    // Keep RenderPass scene references in sync with the active scene so that
    // scene transitions work correctly in composer mode.
    for (const pass of this.#composer.passes) {
      if (pass instanceof RenderPass) {
        pass.scene = scene;
      }
    }
    this.#composer.render();
  }

  resize(
    width: number,
    height: number
  ): void {
    // Must resize the WebGLRenderer canvas first, otherwise the final pass
    // renders into a (0, 0, 0, 0) WebGL viewport and nothing is drawn.
    this.#renderer.setSize(width, height, false);
    this.#composer.setSize(width, height);
  }

  addEffect(
    pass: Pass
  ): void {
    this.#composer.addPass(pass);
  }

  /** Detaches without disposing — callers own the pass lifetime. */
  removeEffect(
    pass: Pass
  ): void {
    this.#composer.removePass(pass);
  }

  /**
   * Rearranges the existing passes in place. Passes absent from `passes` keep
   * their relative order after the ones listed.
   */
  setPassOrder(
    passes: readonly Pass[]
  ): void {
    const remaining = this.#composer.passes.filter(
      (pass) => !passes.includes(pass)
    );
    this.#composer.passes = [...passes, ...remaining];
  }

  getComposer(): EffectComposer {
    return this.#composer;
  }

  dispose(): void {
    // EffectComposer.dispose() only releases its own render targets and copy pass,
    // so the passes it holds have to be disposed explicitly.
    for (const pass of [...this.#composer.passes]) {
      this.#composer.removePass(pass);
      pass.dispose();
    }
    this.#composer.dispose();
  }
}
