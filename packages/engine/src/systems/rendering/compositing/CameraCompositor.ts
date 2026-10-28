// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { RenderComponent } from "../Renderer.ts";
import type { CanvasDimensions } from "../CanvasDimensions.ts";
import { Viewport } from "../Viewport.ts";
import {
  type CameraPipelineFactory,
  CameraPipelines
} from "./CameraPipelines.ts";

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
    canvas: CanvasDimensions
  ): void {
    const components = this.#components.sort(byDepth);
    const hasViewports = components.some(hasViewport);

    if (!hasViewports) {
      this.#renderer.setViewport(0, 0, canvas.width, canvas.height);
      this.#renderer.clear();
    }

    for (const rc of components) {
      rc.prepareRender(canvas);

      if (hasViewports) {
        const { x, y, width, height } = (rc.viewport ?? Viewport.full)
          .pixels(canvas);

        this.#renderer.setViewport(x, y, width, height);
        this.#renderer.setScissor(x, y, width, height);
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
      this.#renderer.setViewport(0, 0, canvas.width, canvas.height);
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
