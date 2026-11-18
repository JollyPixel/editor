// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { CameraGizmoLens } from "../../src/index.ts";

// CONSTANTS
const kMaxWidth = 320;
const kMaxHeight = 220;
const kLeft = 16;
const kTop = 76;
const kPosition = new THREE.Vector3();
const kQuaternion = new THREE.Quaternion();
const kScale = new THREE.Vector3();
const kViewport = new THREE.Vector4();

export class CameraView {
  readonly #renderer: THREE.WebGPURenderer;
  readonly #perspective = new THREE.PerspectiveCamera();
  readonly #orthographic = new THREE.OrthographicCamera();
  readonly #frame = document.createElement("div");
  #aspect = 1;
  #width = kMaxWidth;
  #height = kMaxHeight;

  constructor(
    renderer: THREE.WebGPURenderer,
    aspect: number
  ) {
    this.#renderer = renderer;
    Object.assign(this.#frame.style, {
      position: "fixed",
      left: `${kLeft}px`,
      top: `${kTop}px`,
      pointerEvents: "none",
      outline: "1px solid rgb(255 255 255 / 0.6)"
    });
    document.body.append(this.#frame);
    this.resize(aspect);
  }

  get visible(): boolean {
    return !this.#frame.hidden;
  }

  set visible(
    visible: boolean
  ) {
    this.#frame.hidden = !visible;
  }

  resize(
    aspect: number
  ): void {
    this.#aspect = aspect;
    this.#width = Math.min(kMaxWidth, kMaxHeight * aspect);
    this.#height = this.#width / aspect;
    Object.assign(this.#frame.style, {
      width: `${this.#width}px`,
      height: `${this.#height}px`
    });
  }

  render(
    scene: THREE.Scene,
    lens: CameraGizmoLens,
    matrixWorld: THREE.Matrix4
  ): void {
    if (!this.visible) {
      return;
    }

    const renderer = this.#renderer;
    const autoClear = renderer.autoClear;

    renderer.getViewport(kViewport);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(kLeft, kTop, this.#width, this.#height);
    renderer.setViewport(kLeft, kTop, this.#width, this.#height);
    try {
      renderer.render(scene, this.#camera(lens, matrixWorld));
    }
    finally {
      renderer.setScissorTest(false);
      renderer.setViewport(kViewport);
      renderer.autoClear = autoClear;
    }
  }

  #camera(
    lens: CameraGizmoLens,
    matrixWorld: THREE.Matrix4
  ): THREE.Camera {
    const camera = lens.projection === "orthographic" ?
      this.#orthographicLens(lens) :
      this.#perspectiveLens(lens);

    matrixWorld.decompose(kPosition, kQuaternion, kScale);
    camera.position.copy(kPosition);
    camera.quaternion.copy(kQuaternion);
    camera.near = lens.near;
    camera.far = lens.far;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    return camera;
  }

  #perspectiveLens(
    lens: CameraGizmoLens
  ): THREE.PerspectiveCamera {
    const camera = this.#perspective;
    camera.fov = lens.fov;
    camera.aspect = this.#aspect;

    return camera;
  }

  #orthographicLens(
    lens: CameraGizmoLens
  ): THREE.OrthographicCamera {
    const camera = this.#orthographic;
    const halfHeight = lens.orthographicScale / 2;
    const halfWidth = halfHeight * this.#aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;

    return camera;
  }
}
