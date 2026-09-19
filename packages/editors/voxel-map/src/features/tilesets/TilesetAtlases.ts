// Import Third-party Dependencies
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  TilesetStore,
  WorldStore
} from "../../app/state/index.ts";
import { TilesetAtlasBridge } from "../texture/bridge/TilesetAtlasBridge.ts";
import type {
  TilesetTexture,
  TilesetTextures
} from "./TilesetTextures.ts";
import type { TilesetEntry } from "./tilesetEntries.ts";

export interface TilesetAtlasesOptions {
  engine: VoxelEngine;
  store: TilesetStore;
  textures: TilesetTextures;
  worldStore: WorldStore;
}

interface AtlasBinding {
  readonly assetId: string | null;
  readonly texture: TilesetTexture;
  readonly bridge: TilesetAtlasBridge;
}

export class TilesetAtlases {
  readonly #engine: VoxelEngine;
  readonly #store: TilesetStore;
  readonly #textures: TilesetTextures;
  readonly #worldStore: WorldStore;
  readonly #bindings = new Map<string, AtlasBinding>();
  readonly #unsubscribe: () => void;

  constructor(
    options: TilesetAtlasesOptions
  ) {
    this.#engine = options.engine;
    this.#store = options.store;
    this.#textures = options.textures;
    this.#worldStore = options.worldStore;

    this.#unsubscribe = this.#store.watch("change", this.reconcile);
    this.reconcile();
  }

  get textures(): TilesetTextures {
    return this.#textures;
  }

  has(
    tilesetId: string
  ): boolean {
    return this.#bindings.has(tilesetId);
  }

  readonly reconcile = (): void => {
    const kept = new Set<string>();
    for (const entry of this.#store.entries) {
      const tilesetId = entry.definition.id;
      const binding = this.#bindings.get(tilesetId);
      if (binding !== undefined && binding.assetId === entry.assetId) {
        binding.bridge.update(entry.definition);
        kept.add(tilesetId);
        continue;
      }

      if (binding !== undefined) {
        this.#unbind(tilesetId, binding);
      }
      if (this.#bind(entry)) {
        kept.add(tilesetId);
      }
    }

    for (const [tilesetId, binding] of this.#bindings) {
      if (!kept.has(tilesetId)) {
        this.#unbind(tilesetId, binding);
      }
    }
  };

  dispose(): void {
    this.#unsubscribe();
    for (const [tilesetId, binding] of this.#bindings) {
      this.#unbind(tilesetId, binding);
    }
  }

  #bind(
    entry: TilesetEntry
  ): boolean {
    let texture: TilesetTexture | null;
    try {
      texture = this.#textures.open(entry);
    }
    catch (error) {
      console.error(
        `TilesetAtlases: cannot open tileset "${entry.definition.id}"`,
        error
      );

      return false;
    }
    if (texture === null) {
      return false;
    }

    this.#bindings.set(entry.definition.id, {
      assetId: entry.assetId,
      texture,
      bridge: new TilesetAtlasBridge({
        engine: this.#engine,
        document: texture.document,
        definition: entry.definition,
        worldStore: this.#worldStore
      })
    });

    return true;
  }

  #unbind(
    tilesetId: string,
    binding: AtlasBinding
  ): void {
    this.#bindings.delete(tilesetId);
    binding.bridge.destroy();
    binding.texture.release();
  }
}
