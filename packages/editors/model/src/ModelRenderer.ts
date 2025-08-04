// Import Third-party Dependencies
import { Actor, ActorComponent } from "@jolly-pixel/engine";
import * as THREE from "three";

export interface ModelRendererOptions {
}

export class ModelRenderer extends ActorComponent {
  model: THREE.Group;

  constructor(
    actor: Actor,
    _options: ModelRendererOptions
  ) {
    super({
      actor,
      typeName: "ModelRenderer"
    });

    this.actor.gameInstance.loader.mtlLoader.load(
      "models/Tiny_Witch.mtl",
      (materials) => {
        materials.preload();

        for (const material of Object.values(materials.materials)) {
          if (isMaterialWithMap(material) && material.map) {
            material.map.magFilter = THREE.NearestFilter;
          }
        }

        this.actor.gameInstance.loader.objLoader.setMaterials(materials).load(
          "models/Tiny_Witch.obj",
          (root) => {
            this.model = root;
            this.actor.threeObject.add(this.model);
          }
        );
      }
    );
  }
}

function isMaterialWithMap(
  material: THREE.Material
): material is THREE.MeshPhongMaterial | THREE.MeshStandardMaterial {
  return (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhongMaterial
  );
}
