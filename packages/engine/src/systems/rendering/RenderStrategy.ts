// Import Third-party Dependencies
import * as THREE from "three";
import type {
  EffectComposer,
  Pass
} from "three/addons/postprocessing/EffectComposer.js";

// Import Internal Dependencies
import type { RenderComponent } from "./GameRenderer.js";

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

  resize(width: number, height: number): void {
    this.#renderer.setSize(width, height, false);
  }
}

export class ComposerRenderStrategy implements RenderStrategy {
  #composer: EffectComposer;

  constructor(
    composer: EffectComposer
  ) {
    this.#composer = composer;
  }

  render(
    _scene: THREE.Scene,
    _renderComponents: RenderComponent[]
  ): void {
    this.#composer.render();
  }

  resize(width: number, height: number): void {
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
