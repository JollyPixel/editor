// Import Third-party Dependencies
import { Actor, ActorComponent } from "@jolly-pixel/engine";
import * as THREE from "three";

export interface ModelRendererOptions {
}

export class ModelRenderer extends ActorComponent {
  threeObject: THREE.Group;
  mtl: any;
  constructor(actor: Actor, _options: ModelRendererOptions) {
    super({
      actor,
      typeName: "ModelRenderer"
    });

    this.actor.gameInstance.loader.mtlLoader.load(
      "models/Tiny_Witch.mtl",
      (mtl) => {
        mtl.preload();
        this.actor.gameInstance.loader.objLoader.setMaterials(mtl);
        this.actor.gameInstance.loader.objLoader.load(
          "models/Tiny_Witch.obj",
          (object) => {
            console.log("cb");
            this.threeObject = object;
            this.threeObject.scale.setScalar(50);
            console.log("object", this.threeObject);
            this.actor.threeObject.add(this.threeObject);
          },
          () => void 0,
          (error) => {
            console.log(error);
          }
        );
      }
    );
  }
}
