// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kInitialQuads = 1024;
const kIndicesPerQuad = 6;

export class QuadIndex {
  #attribute: THREE.BufferAttribute | null = null;
  #capacity = 0;

  get capacity(): number {
    return this.#capacity;
  }

  forQuads(
    quads: number
  ): THREE.BufferAttribute {
    if (this.#attribute !== null && quads <= this.#capacity) {
      return new THREE.BufferAttribute(
        this.#attribute.array.subarray(0, quads * kIndicesPerQuad), 1
      );
    }

    let capacity = Math.max(kInitialQuads, this.#capacity * 2);
    while (capacity < quads) {
      capacity *= 2;
    }

    const indices = new Uint32Array(capacity * kIndicesPerQuad);
    for (let i = 0, quad = 0; quad < capacity; quad++) {
      const vertex = quad * 4;
      indices[i++] = vertex;
      indices[i++] = vertex + 1;
      indices[i++] = vertex + 2;
      indices[i++] = vertex;
      indices[i++] = vertex + 2;
      indices[i++] = vertex + 3;
    }

    this.#attribute = new THREE.BufferAttribute(indices, 1);
    this.#capacity = capacity;

    return new THREE.BufferAttribute(
      indices.subarray(0, quads * kIndicesPerQuad), 1
    );
  }
}
