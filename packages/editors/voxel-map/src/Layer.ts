// Import Third-party Dependencies
import * as THREE from "three";

export class Layer {
  id: string = THREE.MathUtils.generateUUID();
  name: string;
  parent?: Layer | null = null;

  objects: THREE.Object3D[] = [];

  constructor(
    name: string,
    parent?: Layer
  ) {
    this.name = name;
    this.parent = parent ?? null;
  }

  clear() {
    this.objects.forEach((object) => object.clear());
    this.objects = [];
  }

  [Symbol.iterator]() {
    return this.objects[Symbol.iterator]();
  }

  setVisible(
    visible: boolean
  ) {
    this.objects.forEach((object) => {
      object.visible = visible;
    });
  }
}
