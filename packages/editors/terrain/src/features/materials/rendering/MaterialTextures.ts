// Import Third-party Dependencies
import type {
  TerrainDocument,
  TerrainMaterialData
} from "@jolly-pixel/asset.terrain/client";
import {
  MATERIAL_MAPS,
  type MaterialImage,
  type MaterialMap,
  type TerrainView
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TextureDocument } from "../model/TextureDocument.ts";

// CONSTANTS
const kMaterialActions = new Set([
  "material-added",
  "material-updated",
  "material-removed",
  "texture-size-changed"
]);

export interface DecodedImage extends MaterialImage {
  close(): void;
}

export interface TextureLease {
  readonly document: Pick<TextureDocument, "bytes" | "subscribe">;
  readonly ready: Promise<void>;

  release(): void;
}

export interface MaterialTexturesOptions {
  document: Pick<TerrainDocument, "materials" | "subscribe">;
  view: Pick<
    TerrainView,
    "materialTextureSize" | "materialChanged" | "materialRemoved" | "writeMaterialMap"
  >;
  lease(assetId: string): TextureLease;
  decode(bytes: Uint8Array, size: number): Promise<DecodedImage>;
  failed?(assetId: string, error: unknown): void;
}

interface MapState {
  readonly slot: number;
  readonly map: MaterialMap;
  assetId: string | null;
  generation: number;
}

interface HeldTexture {
  readonly lease: TextureLease;
  readonly users: Set<MapState>;
  readonly unsubscribe: () => void;
}

export class MaterialTextures {
  #options: MaterialTexturesOptions;
  #maps = new Map<string, MapState>();
  #slots = new Set<number>();
  #textures = new Map<string, HeldTexture>();
  #unsubscribe: Array<() => void>;
  #disposed = false;

  constructor(
    options: MaterialTexturesOptions
  ) {
    this.#options = options;
    const { document } = options;
    this.#unsubscribe = [
      document.subscribe("change", ({ command }) => {
        if (kMaterialActions.has(command.action)) {
          this.#sync();
        }
      }),
      document.subscribe("reset", () => this.#sync())
    ];
    this.#sync();
  }

  dispose(): void {
    this.#disposed = true;
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
    for (const assetId of [...this.#textures.keys()]) {
      this.#drop(assetId);
    }
    this.#maps.clear();
  }

  #sync(): void {
    const { view, document } = this.#options;
    const resized = view.materialTextureSize !== document.materials.textureSize;
    if (resized) {
      view.materialTextureSize = document.materials.textureSize;
    }

    const materials = new Map(
      document.materials.materials().map((material) => [material.slot, material])
    );
    for (const slot of this.#slots) {
      if (!materials.has(slot)) {
        this.#slots.delete(slot);
        for (const map of MATERIAL_MAPS) {
          this.#assign(slot, map, null, false);
        }
        view.materialRemoved(slot);
      }
    }
    for (const material of materials.values()) {
      this.#slots.add(material.slot);
      view.materialChanged(material.slot, {
        tiling: material.tiling,
        triplanar: material.triplanar,
        stochastic: material.stochastic,
        heightBlend: material.heightBlend
      });
      for (const map of MATERIAL_MAPS) {
        this.#assign(material.slot, map, mapAsset(material, map), resized);
      }
    }
  }

  #assign(
    slot: number,
    map: MaterialMap,
    assetId: string | null,
    rewrite: boolean
  ): void {
    const key = `${slot}:${map}`;
    let state = this.#maps.get(key);
    if (state === undefined) {
      state = { slot, map, assetId: null, generation: 0 };
      this.#maps.set(key, state);
    }
    if (state.assetId === assetId && !rewrite) {
      return;
    }

    if (state.assetId !== assetId) {
      if (state.assetId !== null) {
        this.#release(state.assetId, state);
      }
      state.assetId = assetId;
      if (assetId !== null) {
        this.#hold(assetId, state);
      }
    }
    if (assetId === null && !this.#slots.has(slot)) {
      state.generation++;
      this.#maps.delete(key);

      return;
    }
    void this.#write(state);
  }

  async #write(
    state: MapState
  ): Promise<void> {
    const generation = ++state.generation;
    const { view, decode, failed } = this.#options;
    const { assetId, slot, map } = state;
    const current = () => !this.#disposed &&
      state.generation === generation &&
      this.#slots.has(slot);
    if (assetId === null) {
      view.writeMaterialMap(slot, map, null);

      return;
    }

    const texture = this.#textures.get(assetId)!;
    try {
      await texture.lease.ready;
      const { bytes } = texture.lease.document;
      if (!current()) {
        return;
      }
      if (bytes === null) {
        view.writeMaterialMap(slot, map, null);

        return;
      }

      const image = await decode(bytes, view.materialTextureSize);
      try {
        if (current()) {
          view.writeMaterialMap(slot, map, image);
        }
      }
      finally {
        image.close();
      }
    }
    catch (error) {
      if (current()) {
        view.writeMaterialMap(slot, map, null);
        failed?.(assetId, error);
      }
    }
  }

  #hold(
    assetId: string,
    state: MapState
  ): void {
    const held = this.#textures.get(assetId);
    if (held !== undefined) {
      held.users.add(state);

      return;
    }

    const lease = this.#options.lease(assetId);
    const users = new Set([state]);
    this.#textures.set(assetId, {
      lease,
      users,
      unsubscribe: lease.document.subscribe("reset", () => {
        for (const user of users) {
          void this.#write(user);
        }
      })
    });
  }

  #release(
    assetId: string,
    state: MapState
  ): void {
    const held = this.#textures.get(assetId);
    held?.users.delete(state);
    if (held?.users.size === 0) {
      this.#drop(assetId);
    }
  }

  #drop(
    assetId: string
  ): void {
    const held = this.#textures.get(assetId);
    if (held !== undefined) {
      this.#textures.delete(assetId);
      held.unsubscribe();
      held.lease.release();
    }
  }
}

export function decodeMaterialImage(
  bytes: Uint8Array,
  size: number
): Promise<DecodedImage> {
  return createImageBitmap(new Blob([bytes.slice()]), {
    resizeWidth: size,
    resizeHeight: size,
    resizeQuality: "high",
    premultiplyAlpha: "none",
    colorSpaceConversion: "none"
  });
}

function mapAsset(
  material: TerrainMaterialData,
  map: MaterialMap
): string | null {
  return material[map]?.id ?? null;
}
