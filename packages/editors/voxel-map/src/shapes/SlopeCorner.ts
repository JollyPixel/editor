// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Shape, type ShapeOptions } from "./Shape.ts";

export class SlopeCorner extends Shape {
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
      -halfSize, -halfSize, halfSize,
      halfSize, halfSize, -halfSize,
      -halfSize, -halfSize, -halfSize,
      -halfSize, -halfSize, -halfSize,
      halfSize, -halfSize, -halfSize,
      -halfSize, -halfSize, halfSize,
      halfSize, -halfSize, halfSize,
      halfSize, -halfSize, halfSize,
      halfSize, -halfSize, -halfSize,
      halfSize, halfSize, -halfSize,
      halfSize, -halfSize, halfSize,
      halfSize, halfSize, -halfSize,
      -halfSize, -halfSize, halfSize,
      -halfSize, -halfSize, -halfSize,
      halfSize, halfSize, -halfSize,
      halfSize, -halfSize, -halfSize
    ];

    const indices = [
      0, 1, 2,
      3, 4, 5,
      5, 4, 6,
      7, 8, 9,
      10, 11, 12,
      13, 14, 15
    ];

    const uv = [
      1, 1,
      0, 0,
      0, 1,
      0, 1,
      1, 1,
      0, 0,
      1, 0,
      0, 1,
      1, 1,
      0, 0,
      1, 0,
      0, 0,
      1, 1,
      1, 0,
      0, 0,
      1, 1
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }
}
