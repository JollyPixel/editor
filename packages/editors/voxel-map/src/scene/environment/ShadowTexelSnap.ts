// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// CONSTANTS
const kOrigin = new THREE.Vector3();
const kUp = new THREE.Vector3(0, 1, 0);

export class ShadowTexelSnap {
  #texelSize: number;
  #view = new THREE.Matrix4();
  #toWorld = new THREE.Quaternion();
  #toLight = new THREE.Quaternion();

  constructor(
    frustumSize: number,
    mapSize: number
  ) {
    this.#texelSize = frustumSize / mapSize;
  }

  get texelSize(): number {
    return this.#texelSize;
  }

  apply(
    point: THREE.Vector3,
    sunDirection: THREE.Vector3
  ): THREE.Vector3 {
    this.#toWorld.setFromRotationMatrix(
      this.#view.lookAt(sunDirection, kOrigin, kUp)
    );
    this.#toLight.copy(this.#toWorld).invert();

    point.applyQuaternion(this.#toLight);
    point.x = Math.round(point.x / this.#texelSize) * this.#texelSize;
    point.y = Math.round(point.y / this.#texelSize) * this.#texelSize;

    return point.applyQuaternion(this.#toWorld);
  }
}
