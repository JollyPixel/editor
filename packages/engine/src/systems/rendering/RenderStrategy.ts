// Import Third-party Dependencies
import * as THREE from "three";
import type {
  EffectComposer,
  Pass
} from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

// Import Internal Dependencies
import type { RenderComponent } from "./Renderer.ts";

export type RenderMode = "direct" | "composer";

export interface RenderParameters {
  components: RenderComponent[];
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
      components: renderComponents,
      canvasWidth,
      canvasHeight
    } = parameters;

    const sorted = [...renderComponents].sort((a, b) => a.depth - b.depth);
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

  removeEffect(
    pass: Pass
  ): void {
    this.#composer.removePass(pass);
  }

  getComposer(): EffectComposer {
    return this.#composer;
  }
}
