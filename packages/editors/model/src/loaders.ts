// Import Third-party Dependencies
import {
  Systems
} from "@jolly-pixel/engine";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

export const modelLoader = Systems.Assets.registerLoader<THREE.Group<THREE.Object3DEventMap>>(
  {
    extensions: [".obj", ".fbx"],
    type: "model"
  },
  (asset, context) => {
    switch (asset.ext) {
      case ".obj":
        return objectLoader(asset, context);
      case ".fbx":
        return fbxLoader(asset, context);
      default:
        throw new Error(`Unsupported model type: ${asset.ext}`);
    }
  }
);

function objectLoader(
  asset: Systems.Asset,
  context: Systems.AssetLoaderContext
): Promise<THREE.Group<THREE.Object3DEventMap>> {
  const { manager } = context;

  const objLoader = new OBJLoader(manager)
    .setPath(asset.path);
  const mtlLoader = new MTLLoader(manager)
    .setPath(asset.path);

  return new Promise((resolve, reject) => {
    mtlLoader.load(asset.name + ".mtl", (materials) => {
      objLoader
        .setMaterials(loadMaterials(materials))
        .load(
          asset.basename,
          (object) => resolve(object),
          void 0,
          (error) => reject(error)
        );
    }, void 0, (error) => reject(error));
  });
}

function loadMaterials(
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

function isMaterialWithMap(
  material: THREE.Material
): material is THREE.MeshPhongMaterial | THREE.MeshStandardMaterial {
  return (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhongMaterial
  );
}

function fbxLoader(
  asset: Systems.Asset,
  context: Systems.AssetLoaderContext
): Promise<THREE.Group<THREE.Object3DEventMap>> {
  const { manager } = context;

  const loader = new FBXLoader(manager)
    .setPath(asset.path);

  return new Promise((resolve, reject) => {
    loader.load(
      asset.basename,
      (object) => {
        object.name = asset.name;
        resolve(object);
      },
      void 0,
      (error) => reject(error)
    );
  });
}
