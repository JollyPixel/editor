// Import Third-party Dependencies
import {
  isMaterialCommand,
  type TerrainDocument,
  type TerrainMaterialData
} from "@jolly-pixel/asset.terrain/client";
import {
  MATERIAL_MAPS,
  type MaterialImage,
  type MaterialMap,
  type TerrainView
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type {
  TextureLease,
  TextureLeases
} from "../model/TextureLeases.ts";

export interface DecodedImage extends MaterialImage {
  close(): void;
}

export interface MaterialTexturesOptions {
  document: Pick<TerrainDocument, "materials" | "subscribe">;
  view: Pick<
    TerrainView,
    "materialTextureSize" | "materialChanged" | "materialRemoved" | "writeMaterialMap"
  >;
  leases: Pick<TextureLeases, "hold">;
  decode(bytes: Uint8Array, size: number): Promise<DecodedImage>;
  failed?(assetId: string, error: unknown): void;
}

interface MapState {
  readonly slot: number;
  readonly map: MaterialMap;
  texture: HeldTexture | null;
  generation: number;
}

interface HeldTexture {
  readonly assetId: string;
  readonly lease: TextureLease;
}

export class MaterialTextures {
  #options: MaterialTexturesOptions;
  #maps = new Map<string, MapState>();
  #slots = new Set<number>();
  #unsubscribe: Array<() => void>;
  #disposed = false;

  constructor(
    options: MaterialTexturesOptions
  ) {
    this.#options = options;
    const { document } = options;
    this.#unsubscribe = [
      document.subscribe("change", ({ command }) => {
        if (isMaterialCommand(command)) {
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
    for (const state of this.#maps.values()) {
      state.texture?.lease.release();
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
          this.#assign(slot, map, null);
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
        this.#assign(material.slot, map, mapAsset(material, map));
      }
    }
    if (resized) {
      for (const state of this.#maps.values()) {
        void this.#write(state);
      }
    }
  }

  #assign(
    slot: number,
    map: MaterialMap,
    assetId: string | null
  ): void {
    const key = `${slot}:${map}`;
    let state = this.#maps.get(key);
    if (state === undefined) {
      state = { slot, map, texture: null, generation: 0 };
      this.#maps.set(key, state);
    }
    if ((state.texture?.assetId ?? null) === assetId) {
      return;
    }

    const held = state;
    held.texture?.lease.release();
    held.texture = assetId === null ?
      null :
      { assetId, lease: this.#options.leases.hold(assetId, () => void this.#write(held)) };
    if (assetId === null && !this.#slots.has(slot)) {
      held.generation++;
      this.#maps.delete(key);

      return;
    }
    void this.#write(held);
  }

  async #write(
    state: MapState
  ): Promise<void> {
    const generation = ++state.generation;
    const { view, decode, failed } = this.#options;
    const { texture, slot, map } = state;
    const current = () => !this.#disposed &&
      state.generation === generation &&
      this.#slots.has(slot);
    if (texture === null) {
      view.writeMaterialMap(slot, map, null);

      return;
    }

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
        failed?.(texture.assetId, error);
      }
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
