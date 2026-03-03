// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { TilesetDefinition } from "./TilesetManager.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";

export interface TilesetLoaderOptions {
  manager?: THREE.LoadingManager;
  /**
   * Custom loader implementation.
   * @internal For testing only.
   */
  loader?: {
    loadAsync(url: string): Promise<THREE.Texture<HTMLImageElement>>;
  };
}

export interface TilesetEntry {
  def: TilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
}

/**
 * Pre-loads tileset textures before a `VoxelRenderer` is constructed.
 * Pass the loader instance via `VoxelRendererOptions.tilesetLoader` so all
 * textures register synchronously during construction — no async in lifecycle.
 *
 * @example
 * ```ts
 * const loader = new TilesetLoader();
 * await loader.fromTileDefinition({ id: "default", src: "tileset.png", tileSize: 16 });
 *
 * const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });
 * ```
 */
export class TilesetLoader {
  #loader: {
    loadAsync(url: string): Promise<THREE.Texture<HTMLImageElement>>;
  };
  readonly tilesets = new Map<string, TilesetEntry>();

  constructor(
    options: TilesetLoaderOptions = {}
  ) {
    const { manager, loader } = options;
    this.#loader = loader ?? new THREE.TextureLoader(manager);
  }

  async fromTileDefinition(
    def: TilesetDefinition
  ): Promise<void> {
    if (this.tilesets.has(def.id)) {
      return;
    }
    const texture = await this.#loader.loadAsync(def.src);
    this.tilesets.set(def.id, { def, texture });
  }

  async fromWorld(
    data: VoxelWorldJSON
  ): Promise<void> {
    for (const tilesetDef of data.tilesets) {
      await this.fromTileDefinition(tilesetDef);
    }
  }
}
