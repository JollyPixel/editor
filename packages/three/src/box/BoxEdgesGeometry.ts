// Import Third-party Dependencies
import * as THREE from "three";
import {
  LineSegmentsGeometry
} from "three/addons/lines/LineSegmentsGeometry.js";

// Import Internal Dependencies
import {
  BOX_EDGE_PAIRS,
  BOX_EDGE_POSITION_STRIDE,
  writeBoxOutline
} from "./boxOutline.ts";

export class BoxEdgesGeometry extends LineSegmentsGeometry {
  #values: Float32Array;
  #positions: THREE.InstancedInterleavedBuffer;
  #size = new THREE.Vector3();

  constructor(
    size: THREE.Vector3Like = { x: 1, y: 1, z: 1 }
  ) {
    super();

    this.#values = new Float32Array(
      BOX_EDGE_PAIRS.length * BOX_EDGE_POSITION_STRIDE
    );
    this.#positions = new THREE.InstancedInterleavedBuffer(
      this.#values,
      BOX_EDGE_POSITION_STRIDE,
      1
    );
    this.setAttribute(
      "instanceStart",
      new THREE.InterleavedBufferAttribute(this.#positions, 3, 0)
    );
    this.setAttribute(
      "instanceEnd",
      new THREE.InterleavedBufferAttribute(this.#positions, 3, 3)
    );
    this.instanceCount = BOX_EDGE_PAIRS.length;

    this.resize(size);
  }

  copySizeTo(
    target = new THREE.Vector3()
  ): THREE.Vector3 {
    return target.copy(this.#size);
  }

  resize(
    size: THREE.Vector3Like
  ): boolean {
    if (
      this.#size.x === size.x &&
      this.#size.y === size.y &&
      this.#size.z === size.z
    ) {
      return false;
    }

    this.#size.set(size.x, size.y, size.z);
    writeBoxOutline(this.#size, this.#values);
    this.#positions.needsUpdate = true;
    this.computeBoundingBox();
    this.computeBoundingSphere();

    return true;
  }
}
