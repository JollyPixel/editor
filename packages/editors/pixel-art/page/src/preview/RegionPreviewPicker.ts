// Import Third-party Dependencies
import * as THREE from "three";
import type { UVMap } from "@jolly-pixel/pixel-draw.renderer";

export interface RegionPreviewPickerOptions {
  uv: UVMap;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  getMeshes: () => THREE.Object3D[];
}

export class RegionPreviewPicker {
  readonly #uv: UVMap;
  readonly #camera: THREE.Camera;
  readonly #canvas: HTMLCanvasElement;
  readonly #getMeshes: () => THREE.Object3D[];
  readonly #raycaster = new THREE.Raycaster();
  readonly #pointerNdc = new THREE.Vector2();
  #disposed = false;

  constructor(
    options: RegionPreviewPickerOptions
  ) {
    this.#uv = options.uv;
    this.#camera = options.camera;
    this.#canvas = options.canvas;
    this.#getMeshes = options.getMeshes;

    this.#canvas.addEventListener("click", this.#handleClick);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#canvas.removeEventListener("click", this.#handleClick);
  }

  readonly #handleClick = (event: MouseEvent): void => {
    const bounds = this.#canvas.getBoundingClientRect();
    this.#pointerNdc.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.#pointerNdc.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    this.#raycaster.setFromCamera(
      this.#pointerNdc,
      this.#camera
    );
    const [hit] = this.#raycaster.intersectObjects(this.#getMeshes());
    const regionId = hit?.object.userData.regionId;
    this.#uv.select(typeof regionId === "string" ? regionId : null);
  };
}
