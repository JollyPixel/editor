// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoadContext,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import type { MTLLoader } from "three/addons/loaders/MTLLoader.js";

// Import Internal Dependencies
import { parse } from "../../core/utils/path.ts";

// CONSTANTS
const kMaterialLibrary = /^[ \t]*mtllib (.+)$/gm;
const kMaterialUse = /^[ \t]*usemtl\s/m;
const kTextureExtensions = [".png", ".jpg", ".jpeg", ".webp"];

export type Model = {
  object: THREE.Group<THREE.Object3DEventMap>;
  animations: THREE.AnimationClip[];
};

export interface ModelParseOptions {
  /**
   * Folder the file's external resources (textures, buffers, `.mtl` libraries)
   * resolve against.
   * @default ""
   */
  resourcePath?: string;
  manager?: THREE.LoadingManager;
  /**
   * Image applied to an `.obj` file that names no material (no `usemtl`
   * line), resolved against `resourcePath`. Other formats ignore it.
   */
  texture?: string;
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
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<Model> {
    const source = parse(record.path.toString());
    const { catalog } = context.assets;

    try {
      const content = await new THREE.FileLoader(this.#manager)
        .setResponseType("arraybuffer")
        .loadAsync(source.dir + source.base);

      return await parseModel(
        new Uint8Array(content as ArrayBuffer),
        source.base,
        {
          resourcePath: source.dir,
          manager: this.#manager,
          texture: modelTextureNames(source.base).find(
            (name) => catalog.findByPath(source.dir + name) !== undefined
          )
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
}

export function modelTextureNames(
  fileName: string
): string[] {
  const source = parse(fileName);
  if (source.ext !== ".obj") {
    return [];
  }

  return kTextureExtensions.map((extension) => source.name + extension);
}

export async function parseModel(
  content: Uint8Array,
  fileName: string,
  options: ModelParseOptions = {}
): Promise<Model> {
  const {
    resourcePath = "",
    manager = THREE.DefaultLoadingManager,
    texture
  } = options;
  const source = parse(fileName);

  switch (source.ext) {
    case ".obj":
      return parseObject(
        content,
        source.name,
        resourcePath,
        manager,
        texture
      );
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
  resourcePath: string,
  manager: THREE.LoadingManager,
  texture: string | undefined
): Promise<Model> {
  const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
  const text = new TextDecoder().decode(content);
  const loader = new OBJLoader(manager);
  const materials = await loadMaterialLibraries(text, resourcePath, manager);
  if (materials !== null) {
    loader.setMaterials(materials);
  }
  const object = loader.parse(text);
  object.name = name;
  if (texture !== undefined && !kMaterialUse.test(text)) {
    paintObject(object, loadTexture(resourcePath + texture, manager));
  }

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

async function loadMaterialLibraries(
  text: string,
  resourcePath: string,
  manager: THREE.LoadingManager
): Promise<MTLLoader.MaterialCreator | null> {
  const libraries = Array.from(
    text.matchAll(kMaterialLibrary),
    (match) => resourcePath + match[1].trim()
  );
  if (libraries.length === 0) {
    return null;
  }

  const { MTLLoader } = await import("three/addons/loaders/MTLLoader.js");
  const loaded = await Promise.all(libraries.map(async(url) => {
    try {
      const library = await new THREE.FileLoader(manager).loadAsync(url);

      return new MTLLoader(manager).parse(
        String(library),
        THREE.LoaderUtils.extractUrlBase(url)
      );
    }
    catch {
      return null;
    }
  }));
  const creators = loaded.filter((creator) => creator !== null);
  if (creators.length === 0) {
    return null;
  }

  const [materials, ...others] = creators.map(preloadMaterials);
  for (const other of others) {
    Object.assign(materials.materials, other.materials);
  }

  return materials;
}

function loadTexture(
  url: string,
  manager: THREE.LoadingManager
): THREE.Texture {
  const texture = new THREE.TextureLoader(manager).load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;

  return texture;
}

function paintObject(
  object: THREE.Object3D,
  texture: THREE.Texture
): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(child.material) ?
      child.material :
      [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshPhongMaterial) {
        material.map = texture;
        material.needsUpdate = true;
      }
    }
  });
}

function preloadMaterials(
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
