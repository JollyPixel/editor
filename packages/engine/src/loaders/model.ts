// Import Third-party Dependencies
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Import Internal Dependencies
import {
  Asset,
  Assets,
  type AssetLoaderContext
} from "../systems/index.js";

export type Model = {
  object: THREE.Group<THREE.Object3DEventMap>;
  animations: THREE.AnimationClip[];
};

Assets.registry.loader(
  {
    extensions: [".obj", ".fbx", ".glb", ".gltf"],
    type: "model"
  },
  (asset, context) => {
    switch (asset.ext) {
      case ".obj":
        return safeLoad(asset, objectLoader(asset, context));
      case ".fbx":
        return safeLoad(asset, fbxLoader(asset, context));
      case ".glb":
      case ".gltf":
        return safeLoad(asset, gltfLoader(asset, context));
      default:
        throw new Error(`Unsupported model type: ${asset.ext}`);
    }
  }
);
export const model = Assets.lazyLoad<Model>();

async function objectLoader(
  asset: Asset,
  context: AssetLoaderContext
): Promise<Model> {
  const { manager } = context;

  const objLoader = new OBJLoader(manager)
    .setPath(asset.path);
  const mtlLoader = new MTLLoader(manager)
    .setPath(asset.path);

  const materials = await mtlLoader.loadAsync(asset.name + ".mtl");
  const object = await objLoader
    .setMaterials(loadMTLMaterials(materials))
    .loadAsync(asset.basename);
  object.name = asset.name;

  return {
    object,
    animations: []
  };
}

function loadMTLMaterials(
  materials: MTLLoader.MaterialCreator
) {
  materials.preload();

  for (const material of Object.values(materials.materials)) {
    if (isMaterialWithMap(material) && material.map) {
      material.map.magFilter = THREE.NearestFilter;
    }
  }

  return materials;
}

async function fbxLoader(
  asset: Asset,
  context: AssetLoaderContext
): Promise<Model> {
  const { manager } = context;

  const loader = new FBXLoader(manager)
    .setPath(asset.path);

  const object = await loader.loadAsync(asset.basename);
  object.name = asset.name;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.from(extractMaterials(object));
      for (const material of materials) {
        if (material.map) {
          material.map.magFilter = THREE.NearestFilter;
        }
      }
    }
  });

  return {
    object,
    animations: object.animations
  };
}

async function gltfLoader(
  asset: Asset,
  context: AssetLoaderContext
): Promise<Model> {
  const { manager } = context;

  const loader = new GLTFLoader(manager)
    .setPath(asset.path);

  const object = await loader.loadAsync(asset.basename);

  return {
    object: object.scene,
    animations: object.animations
  };
}

function* extractMaterials(
  object: THREE.Object3D | THREE.Group | THREE.Bone
): Iterable<THREE.MeshPhongMaterial | THREE.MeshStandardMaterial> {
  for (const child of object.children) {
    if (child instanceof THREE.Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (isMaterialWithMap(material)) {
          yield material;
        }
      }
    }
    else if (
      child instanceof THREE.Object3D
    ) {
      yield* extractMaterials(child);
    }
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

async function safeLoad(
  asset: Asset,
  loader: Promise<Model>
) {
  try {
    const model = await loader;

    return model;
  }
  catch (error) {
    throw new Error(`Failed to load model: ${asset.toString()}`, { cause: error });
  }
}
