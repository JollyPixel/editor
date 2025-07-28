// Import Third-party Dependencies
import * as THREE from "three";

export interface ShapeOptions {
  size: number;
  color?: THREE.ColorRepresentation;
  texture?: string;
}

export class Shape extends THREE.Mesh {
  static RATIO = 1;

  size: number;

  constructor(
    options: ShapeOptions
  ) {
    super();
    const { size, color, texture } = options;

    this.size = size;
    if (color) {
      this.material = new THREE.MeshLambertMaterial({ color });
    }
    else {
      this.material = new THREE.MeshLambertMaterial({
        map: texture ? new THREE.TextureLoader().load(texture) : undefined
      });
    }
  }

  setPositionFromIntersection(
    intersection: THREE.Intersection<THREE.Object3D>
  ) {
    this.position
      .copy(intersection.point)
      .add(intersection.face!.normal)
      .divideScalar(this.size)
      .floor()
      .multiplyScalar(this.size)
      .addScalar(this.size / 2);

    return this;
  }
}
