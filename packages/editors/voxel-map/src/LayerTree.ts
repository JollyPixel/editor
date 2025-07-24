// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Layer } from "./Layer.js";

export class LayerTree {
  root: Layer;
  selection: Layer | null = null;

  constructor() {
    this.root = new Layer("root");
  }

  get selected() {
    return this.selection ?? this.root;
  }

  add(
    object: THREE.Object3D
  ) {
    const layer = this.selected;

    layer.objects.push(object);
  }

  remove(
    object: THREE.Object3D
  ) {
    const layer = this.selected;

    const index = layer.objects.indexOf(object);
    if (index !== -1) {
      layer.objects.splice(index, 1);
    }
  }

  clear() {
    this.root.clear();
  }
}
