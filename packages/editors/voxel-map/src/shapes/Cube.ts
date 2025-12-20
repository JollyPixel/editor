// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Shape, type ShapeOptions } from "./Shape.ts";

export class Cube extends Shape {
  constructor(
    options: ShapeOptions
  ) {
    super(options);
    this.geometry = new THREE.BoxGeometry(
      this.size / Shape.RATIO,
      this.size / Shape.RATIO,
      this.size / Shape.RATIO
    );
  }
}
