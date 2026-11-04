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

export interface ModelParseOptions {
  /**
   * Folder the file's external resources (textures, buffers) resolve against.
   * @default ""
   */
  resourcePath?: string;
  manager?: THREE.LoadingManager;
}

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
    const source = parse(record.path.toString());

    try {
      if (source.ext === ".obj") {
        return await this.#loadObjectWithMtl(source);
      }

      const content = await new THREE.FileLoader(this.#manager)
        .setResponseType("arraybuffer")
        .loadAsync(source.dir + source.base);

      return await parseModel(
        new Uint8Array(content as ArrayBuffer),
        source.base,
        {
          resourcePath: source.dir,
          manager: this.#manager
        }
      );
    }
    catch (error: unknown) {
      throw new Error(
        `Failed to load model: ${record.path}`,
        { cause: error }
      );
    }
  }

  async #loadObjectWithMtl(
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
}

export async function parseModel(
  content: Uint8Array,
  fileName: string,
  options: ModelParseOptions = {}
): Promise<Model> {
  const {
    resourcePath = "",
    manager = THREE.DefaultLoadingManager
  } = options;
  const source = parse(fileName);

  switch (source.ext) {
    case ".obj":
      return parseObject(content, source.name, manager);
    case ".fbx":
      return parseFbx(content, source.name, resourcePath, manager);
    case ".glb":
    case ".gltf":
      return parseGltf(content, resourcePath, manager);
    default:
      throw new Error(`Unsupported model type: ${source.ext}`);
  }
}

async function parseObject(
  content: Uint8Array,
  name: string,
  manager: THREE.LoadingManager
): Promise<Model> {
  const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
  const object = new OBJLoader(manager)
    .parse(new TextDecoder().decode(content));
  object.name = name;

  return {
    object,
    animations: []
  };
}

async function parseFbx(
  content: Uint8Array,
  name: string,
  resourcePath: string,
  manager: THREE.LoadingManager
): Promise<Model> {
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const object = new FBXLoader(manager)
    .parse(toArrayBuffer(content), resourcePath);
  object.name = name;

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

async function parseGltf(
  content: Uint8Array,
  resourcePath: string,
  manager: THREE.LoadingManager
): Promise<Model> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/libs/meshopt_decoder.module.js")
  ]);
  const gltf = await new GLTFLoader(manager)
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(toArrayBuffer(content), resourcePath);

  return {
    object: gltf.scene,
    animations: gltf.animations
  };
}

function toArrayBuffer(
  content: Uint8Array
): ArrayBuffer {
  const { buffer } = content;
  if (
    buffer instanceof ArrayBuffer &&
    content.byteOffset === 0 &&
    content.byteLength === buffer.byteLength
  ) {
    return buffer;
  }

  return content.slice().buffer;
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
