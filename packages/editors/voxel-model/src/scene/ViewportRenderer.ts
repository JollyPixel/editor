// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/engine";

/** Runs each frame after the camera is placed and before the scene is drawn. */
export type PreDrawStep = () => void;

export class ViewportRenderer implements Systems.RenderComponent {
  readonly viewport = null;
  readonly depth: number;
  postProcessing: Systems.PostProcessing | null = null;

  #camera: Systems.RenderComponent;
  #steps: PreDrawStep[] = [];

  constructor(
    camera: Systems.RenderComponent
  ) {
    this.#camera = camera;
    this.depth = camera.depth;
  }

  get threeCamera(): THREE.Camera {
    return this.#camera.threeCamera;
  }

  addPreDrawStep(
    step: PreDrawStep
  ): void {
    this.#steps.push(step);
  }

  replaceCamera(
    renderer: Pick<
      Systems.Renderer,
      "renderComponents" | "addRenderComponent" | "removeRenderComponent"
    >
  ): void {
    if (!renderer.renderComponents.includes(this.#camera)) {
      throw new Error(
        "ViewportRenderer: the camera must render before it can be replaced."
      );
    }
    renderer.removeRenderComponent(this.#camera);
    renderer.addRenderComponent(this);
  }

  prepareRender(
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.#camera.prepareRender(canvasWidth, canvasHeight);
    for (const step of this.#steps) {
      step();
    }
  }
}
