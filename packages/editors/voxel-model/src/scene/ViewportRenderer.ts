// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/ecs";
import type { ThreeRenderComponent, PostProcessing } from "@jolly-pixel/backend.three";

export type PreDrawStep = () => void;

export class ViewportRenderer implements ThreeRenderComponent {
  readonly viewport = null;
  readonly depth: number;
  postProcessing: PostProcessing | null = null;

  #camera: ThreeRenderComponent;
  #steps: PreDrawStep[] = [];

  constructor(
    camera: ThreeRenderComponent
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
    canvas: Systems.CanvasDimensions
  ): void {
    this.#camera.prepareRender(canvas);
    for (const step of this.#steps) {
      step();
    }
  }
}
