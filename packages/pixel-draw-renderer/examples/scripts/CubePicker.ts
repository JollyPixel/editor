// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { UVMap } from "../../src/index.ts";

export interface CubePickerOptions {
  uv: UVMap;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  /**
   * Read lazily on every click, so the picker always raycasts against
   * whatever cubes currently exist (see CubeGallery.meshes).
   */
  getMeshes: () => THREE.Object3D[];
}

/**
 * Clicking a cube in the 3D scene reveals its UV region on the 2D canvas,
 * regardless of the canvas's current mode (see uv/UVMap.md — visibility is
 * independent of mode). Clicking empty space in the 3D scene deselects,
 * mirroring a miss-click on the 2D canvas in "uv" mode.
 */
export class CubePicker {
  #uv: UVMap;
  #camera: THREE.Camera;
  #getMeshes: () => THREE.Object3D[];
  #raycaster = new THREE.Raycaster();
  #pointerNdc = new THREE.Vector2();

  constructor(
    options: CubePickerOptions
  ) {
    this.#uv = options.uv;
    this.#camera = options.camera;
    this.#getMeshes = options.getMeshes;

    options.canvas.addEventListener("click", (event) => {
      const bounds = options.canvas.getBoundingClientRect();
      this.#pointerNdc.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      this.#pointerNdc.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      this.#raycaster.setFromCamera(this.#pointerNdc, this.#camera);
      const [hit] = this.#raycaster.intersectObjects(this.#getMeshes());
      this.#uv.select(hit ? hit.object.userData.regionId as string : null);
    });
  }
}
