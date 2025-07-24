// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Shape, type ShapeOptions } from "./Shape.js";

export class Slope extends Shape {
  constructor(
    options: ShapeOptions
  ) {
    super(options);
    this.geometry = this.createGeometry();
  }

  createGeometry(): THREE.BufferGeometry {
    const size = this.size / Shape.RATIO;
    const halfSize = size / 2;

    const vertices = [
      // Face avant (triangle)
      -halfSize, -halfSize, halfSize,
      halfSize, -halfSize, halfSize,
      halfSize, halfSize, halfSize,

      // Face arrière (triangle)
      -halfSize, -halfSize, -halfSize,
      halfSize, halfSize, -halfSize,
      halfSize, -halfSize, -halfSize,

      // Face du bas (rectangle)
      -halfSize, -halfSize, -halfSize,
      halfSize, -halfSize, -halfSize,
      halfSize, -halfSize, halfSize,
      -halfSize, -halfSize, halfSize,

      // Face gauche (triangle)
      -halfSize, -halfSize, -halfSize,
      -halfSize, -halfSize, halfSize,
      halfSize, halfSize, halfSize,

      // Face droite (triangle)
      halfSize, -halfSize, halfSize,
      halfSize, -halfSize, -halfSize,
      halfSize, halfSize, -halfSize,

      // Face inclinée (rectangle)
      -halfSize, -halfSize, halfSize,
      halfSize, halfSize, halfSize,
      halfSize, halfSize, -halfSize,
      -halfSize, -halfSize, -halfSize
    ];

    const indices = [
      // Face avant (triangle)
      0, 1, 2,

      // Face arrière (triangle)
      3, 4, 5,

      // Face du bas (rectangle)
      6, 7, 8,
      6, 8, 9,

      // Face gauche (triangle)
      10, 11, 12,

      // Face droite (triangle)
      13, 14, 15,

      // Face inclinée (rectangle)
      16, 17, 18,
      16, 18, 19
    ];

    const uv = [
      // Face avant
      0, 0, 1, 0, 1, 1,

      // Face arrière
      0, 0, 1, 1, 1, 0,

      // Face du bas
      0, 0, 1, 0, 1, 1, 0, 1,

      // Face gauche
      0, 0, 1, 0, 1, 1,

      // Face droite
      0, 0, 1, 0, 1, 1,

      // Face inclinée
      0, 0, 1, 0, 1, 1, 0, 1
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }
}
