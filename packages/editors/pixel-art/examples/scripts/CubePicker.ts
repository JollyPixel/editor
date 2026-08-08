// Import Third-party Dependencies
import * as THREE from "three";
import type { UVMap } from "@jolly-pixel/pixel-draw.renderer";

export interface CubePickerOptions {
  uv: UVMap;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  /**
   * Read on each click so raycasts use the current cube set.
   */
  getMeshes: () => THREE.Object3D[];
}

/**
 * Clicking a cube selects its UV region.
 * Clicking empty space clears selection.
 */
export class CubePicker {
  #uv: UVMap;
  #camera: THREE.Camera;
  #canvas: HTMLCanvasElement;
  #getMeshes: () => THREE.Object3D[];
  #raycaster = new THREE.Raycaster();
  #pointerNdc = new THREE.Vector2();

  constructor(
    options: CubePickerOptions
  ) {
    this.#uv = options.uv;
    this.#camera = options.camera;
    this.#canvas = options.canvas;
    this.#getMeshes = options.getMeshes;

    options.canvas.addEventListener(
      "click",
      this.#handleClick
    );
  }

  #handleClick = (event: MouseEvent) => {
    const bounds = this.#canvas.getBoundingClientRect();
    this.#pointerNdc.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.#pointerNdc.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    this.#raycaster.setFromCamera(
      this.#pointerNdc,
      this.#camera
    );
    const [hit] = this.#raycaster.intersectObjects(
      this.#getMeshes()
    );
    this.#uv.select(hit ? hit.object.userData.regionId as string : null);
  };
}
