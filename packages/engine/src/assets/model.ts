// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import type { MTLLoader } from "three/addons/loaders/MTLLoader.js";

// Import Internal Dependencies
import { parse } from "../utils/path.ts";

export type Model = {
  object: THREE.Group<THREE.Object3DEventMap>;
  animations: THREE.AnimationClip[];
};

export const ModelAssetType = new AssetType<Model>("model");

export class ModelAssetLoader implements AssetLoader<Model> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<Model> {
    const source = parse(record.source);

    try {
      switch (source.ext) {
        case ".obj":
          return await this.#loadObject(source);
        case ".fbx":
          return await this.#loadFbx(source);
        case ".glb":
        case ".gltf":
          return await this.#loadGltf(source);
        default:
          throw new Error(`Unsupported model type: ${source.ext}`);
      }
    }
    catch (error: unknown) {
      throw new Error(
        `Failed to load model: ${record.source}`,
        { cause: error }
      );
    }
  }

  async #loadObject(
    source: ReturnType<typeof parse>
  ): Promise<Model> {
    const [{ OBJLoader }, { MTLLoader }] = await Promise.all([
      import("three/addons/loaders/OBJLoader.js"),
      import("three/addons/loaders/MTLLoader.js")
    ]);
    const objLoader = new OBJLoader(this.#manager)
      .setPath(source.dir);
    const mtlLoader = new MTLLoader(this.#manager)
      .setPath(source.dir);
    const materials = await mtlLoader.loadAsync(source.name + ".mtl");
    const object = await objLoader
      .setMaterials(loadMtlMaterials(materials))
      .loadAsync(source.base);
    object.name = source.name;

    return {
      object,
      animations: []
    };
  }

  async #loadFbx(
    source: ReturnType<typeof parse>
  ): Promise<Model> {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
    const object = await new FBXLoader(this.#manager)
      .setPath(source.dir)
      .loadAsync(source.base);
    object.name = source.name;

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.isArray(child.material) ?
        child.material :
        [child.material];
      for (const material of materials) {
        if (isMaterialWithMap(material) && material.map) {
          material.map.magFilter = THREE.NearestFilter;
        }
      }
    });

    return {
      object,
      animations: object.animations
    };
  }

  async #loadGltf(
    source: ReturnType<typeof parse>
  ): Promise<Model> {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/libs/meshopt_decoder.module.js")
    ]);
    const object = await new GLTFLoader(this.#manager)
      .setMeshoptDecoder(MeshoptDecoder)
      .setPath(source.dir)
      .loadAsync(source.base);

    return {
      object: object.scene,
      animations: object.animations
    };
  }
}

function loadMtlMaterials(
  materials: MTLLoader.MaterialCreator
): MTLLoader.MaterialCreator {
  materials.preload();

  for (const material of Object.values(materials.materials)) {
    if (isMaterialWithMap(material) && material.map) {
      material.map.magFilter = THREE.NearestFilter;
    }
  }

  return materials;
}

function isMaterialWithMap(
  material: THREE.Material
): material is THREE.MeshPhongMaterial | THREE.MeshStandardMaterial {
  return (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhongMaterial
  );
}
