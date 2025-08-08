// Import Third-party Dependencies
import {
  Actor,
  ActorComponent,
  Systems
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { modelLoader } from "./loaders.js";

export interface ModelRendererOptions {
}

export class ModelRenderer extends ActorComponent {
  assets: Systems.LazyAsset<THREE.Group<THREE.Object3DEventMap>>[];
  model: THREE.Group<THREE.Object3DEventMap>;

  constructor(
    actor: Actor,
    _options: ModelRendererOptions
  ) {
    super({
      actor,
      typeName: "ModelRenderer"
    });

    this.assets = [
      modelLoader("models/Tiny_Witch.obj"),
      modelLoader("models/Tree.fbx")
    ];
  }

  awake() {
    for (const asset of this.assets) {
      const model = asset.get();
      if (model.name === "Tree") {
        model.position.set(2, 0, 0);
      }
      this.actor.threeObject.add(model);
    }
  }
}
