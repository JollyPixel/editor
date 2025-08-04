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
  asset: Systems.LazyAsset<THREE.Group<THREE.Object3DEventMap>>;
  model: THREE.Group<THREE.Object3DEventMap>;

  constructor(
    actor: Actor,
    _options: ModelRendererOptions
  ) {
    super({
      actor,
      typeName: "ModelRenderer"
    });

    this.asset = modelLoader("models/Tiny_Witch.obj");
  }

  awake() {
    this.model = this.asset.get();
    this.actor.threeObject.add(this.model);
  }
}
