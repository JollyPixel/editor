// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoadContext,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import { pathUtils } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  parseModel,
  type Model
} from "./parseModel.ts";

// CONSTANTS
const kTextureExtensions = [".png", ".jpg", ".jpeg", ".webp"];

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
    const source = pathUtils.parse(record.path.toString());
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
  const source = pathUtils.parse(fileName);
  if (source.ext !== ".obj") {
    return [];
  }

  return kTextureExtensions.map((extension) => source.name + extension);
}
