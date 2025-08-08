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
  path: string;
}

export class ModelRenderer extends ActorComponent {
  asset: Systems.LazyAsset<THREE.Group<THREE.Object3DEventMap>>;
  position: THREE.Vector3;
  model: THREE.Group<THREE.Object3DEventMap>;

  constructor(
    actor: Actor,
    options: ModelRendererOptions
  ) {
    super({
      actor,
      typeName: "ModelRenderer"
    });

    const {
      path
    } = options;

    this.asset = modelLoader(path);
  }

  awake() {
    const model = this.asset.get();
    this.actor.threeObject.add(model);
  }
}
