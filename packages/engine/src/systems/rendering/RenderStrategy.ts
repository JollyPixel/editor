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

export interface RenderStrategy {
  render(scene: THREE.Scene, renderComponents: RenderComponent[]): void;
  resize(width: number, height: number): void;
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
    renderComponents: RenderComponent[]
  ): void {
    for (const renderComponent of renderComponents) {
      this.#renderer.render(scene, renderComponent);
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
    _renderComponents: RenderComponent[]
  ): void {
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

  addEffect(pass: Pass): void {
    this.#composer.addPass(pass);
  }

  removeEffect(pass: Pass): void {
    this.#composer.removePass(pass);
  }

  getComposer(): EffectComposer {
    return this.#composer;
  }
}
