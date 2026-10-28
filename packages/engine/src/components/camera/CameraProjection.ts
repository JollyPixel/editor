// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export type CameraProjectionMode = "perspective" | "orthographic";

export interface CameraLens {
  fov: number;
  near: number;
  far: number;
  orthographicScale: number;
}

export interface CameraProjection {
  readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  write(
    lens: Readonly<CameraLens>,
    aspect: number
  ): void;
  requirePerspective(): THREE.PerspectiveCamera;
}

export class PerspectiveProjection implements CameraProjection {
  readonly camera = new THREE.PerspectiveCamera();

  constructor() {
    this.camera.matrixWorldAutoUpdate = false;
  }

  write(
    lens: Readonly<CameraLens>,
    aspect: number
  ): void {
    this.camera.fov = lens.fov;
    this.camera.aspect = aspect;
    this.camera.near = lens.near;
    this.camera.far = lens.far;
    this.camera.updateProjectionMatrix();
  }

  requirePerspective(): THREE.PerspectiveCamera {
    return this.camera;
  }
}

export class OrthographicProjection implements CameraProjection {
  readonly camera = new THREE.OrthographicCamera();

  constructor() {
    this.camera.matrixWorldAutoUpdate = false;
  }

  write(
    lens: Readonly<CameraLens>,
    aspect: number
  ): void {
    const halfHeight = lens.orthographicScale;
    const halfWidth = halfHeight * aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.near = lens.near;
    this.camera.far = lens.far;
    this.camera.updateProjectionMatrix();
  }

  requirePerspective(): never {
    throw new Error(
      "The camera uses an orthographic projection; read threeCamera instead."
    );
  }
}

export function createCameraProjection(
  mode: CameraProjectionMode
): CameraProjection {
  return mode === "orthographic" ?
    new OrthographicProjection() :
    new PerspectiveProjection();
}
