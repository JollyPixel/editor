// Import Third-party Dependencies
import * as THREE from "three";

export interface CameraGizmoLens {
  projection: "perspective" | "orthographic";
  /**
   * Vertical field of view, in degrees.
   */
  fov: number;
  near: number;
  far: number;
  /**
   * Height of the orthographic view, in world units.
   */
  orthographicScale: number;
}

export interface CameraGizmoOptions {
  /**
   * @default "#f5c46b"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Width-to-height ratio of the drawn frustum.
   * @default 16 / 9
   */
  aspect?: number;
  /**
   * Longest drawn distance past `near`, in world units.
   * @default 3
   */
  depth?: number;
}

// CONSTANTS
const kDefaultColor = "#f5c46b";
const kDefaultAspect = 16 / 9;
const kDefaultDepth = 3;

export class CameraGizmo extends THREE.Group {
  readonly #aspect: number;
  readonly #depth: number;
  readonly #perspective = new THREE.PerspectiveCamera();
  readonly #orthographic = new THREE.OrthographicCamera();
  readonly #body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  #frustum: THREE.CameraHelper | null = null;

  constructor(
    options: CameraGizmoOptions = {}
  ) {
    super();
    const {
      color = kDefaultColor,
      aspect = kDefaultAspect,
      depth = kDefaultDepth
    } = options;

    this.#aspect = aspect;
    this.#depth = depth;
    this.#body = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, 0.4),
      new THREE.MeshBasicMaterial({
        color,
        wireframe: true
      })
    );
    this.matrixAutoUpdate = false;
    this.add(this.#body);
  }

  update(
    lens: CameraGizmoLens,
    matrixWorld: THREE.Matrix4
  ): void {
    const camera = lens.projection === "orthographic" ?
      this.#orthographic :
      this.#perspective;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = lens.fov;
      camera.aspect = this.#aspect;
    }
    else {
      const halfHeight = lens.orthographicScale / 2;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * this.#aspect;
      camera.right = halfHeight * this.#aspect;
    }
    camera.near = lens.near;
    camera.far = Math.min(lens.far, lens.near + this.#depth);
    camera.updateProjectionMatrix();

    if (this.#frustum?.camera !== camera) {
      this.#disposeFrustum();
      this.#frustum = new THREE.CameraHelper(camera);
      this.add(this.#frustum);
    }

    this.matrix.copy(matrixWorld);
    this.matrixWorldNeedsUpdate = true;
    this.#frustum.update();
  }

  override dispose(): void {
    this.#disposeFrustum();
    this.#body.geometry.dispose();
    this.#body.material.dispose();
  }

  #disposeFrustum(): void {
    if (this.#frustum !== null) {
      this.remove(this.#frustum);
      this.#frustum.dispose();
      this.#frustum = null;
    }
  }
}
