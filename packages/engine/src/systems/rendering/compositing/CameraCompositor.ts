// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type {
  RenderComponent,
  RenderViewport
} from "../Renderer.ts";
import {
  type CameraPipelineFactory,
  CameraPipelines
} from "./CameraPipelines.ts";

// CONSTANTS
const kFullViewport: Readonly<RenderViewport> = Object.freeze({
  x: 0,
  y: 0,
  width: 1,
  height: 1
});

export class CameraCompositor {
  #renderer: THREE.WebGPURenderer;
  #pipelines: CameraPipelines;
  #components: RenderComponent[] = [];

  constructor(
    renderer: THREE.WebGPURenderer,
    createPipeline?: CameraPipelineFactory
  ) {
    this.#renderer = renderer;
    this.#pipelines = new CameraPipelines(renderer, createPipeline);
  }

  get components(): readonly RenderComponent[] {
    return this.#components;
  }

  add(
    component: RenderComponent
  ): void {
    if (!this.#components.includes(component)) {
      this.#components.push(component);
    }
  }

  remove(
    component: RenderComponent
  ): void {
    const index = this.#components.indexOf(component);
    if (index !== -1) {
      this.#components.splice(index, 1);
    }
  }

  render(
    scene: THREE.Scene,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const components = this.#components.sort(byDepth);
    const hasViewports = components.some(hasViewport);

    if (!hasViewports) {
      this.#renderer.setViewport(0, 0, canvasWidth, canvasHeight);
      this.#renderer.clear();
    }

    for (const rc of components) {
      rc.prepareRender(canvasWidth, canvasHeight);

      if (hasViewports) {
        const vp = rc.viewport ?? kFullViewport;
        const vx = Math.round(vp.x * canvasWidth);
        const vy = Math.round(vp.y * canvasHeight);
        const vw = Math.round(vp.width * canvasWidth);
        const vh = Math.round(vp.height * canvasHeight);

        this.#renderer.setViewport(vx, vy, vw, vh);
        this.#renderer.setScissor(vx, vy, vw, vh);
        this.#renderer.setScissorTest(true);
        this.#renderer.clear();
      }

      const pipeline = this.#pipelines.acquire(rc, scene);
      if (pipeline) {
        pipeline.render();
      }
      else {
        this.#renderer.render(scene, rc.threeCamera);
      }
    }
    this.#pipelines.retain(components);

    if (hasViewports) {
      this.#renderer.setScissorTest(false);
      this.#renderer.setViewport(0, 0, canvasWidth, canvasHeight);
    }
  }

  dispose(): void {
    this.#pipelines.dispose();
    this.#components.length = 0;
  }
}

function byDepth(
  left: RenderComponent,
  right: RenderComponent
): number {
  return left.depth - right.depth;
}

function hasViewport(
  component: RenderComponent
): boolean {
  return component.viewport !== null;
}
