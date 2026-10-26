// Import Third-party Dependencies
import type {
  TerrainDocument,
  TerrainLayerData
} from "@jolly-pixel/asset.terrain/client";
import {
  LAYER_MAPS,
  type LayerImage,
  type LayerMap,
  type TerrainView
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TextureDocument } from "../model/TextureDocument.ts";

// CONSTANTS
const kLayerActions = new Set([
  "layer-added",
  "layer-updated",
  "layer-removed",
  "texture-size-changed"
]);

export interface DecodedImage extends LayerImage {
  close(): void;
}

export interface TextureLease {
  readonly document: Pick<TextureDocument, "bytes" | "subscribe">;
  readonly ready: Promise<void>;

  release(): void;
}

export interface LayerTexturesOptions {
  document: Pick<TerrainDocument, "layers" | "subscribe">;
  view: Pick<
    TerrainView,
    "layerTextureSize" | "layerChanged" | "layerRemoved" | "writeLayerMap"
  >;
  lease(assetId: string): TextureLease;
  decode(bytes: Uint8Array, size: number): Promise<DecodedImage>;
  failed?(assetId: string, error: unknown): void;
}

interface MapState {
  readonly slot: number;
  readonly map: LayerMap;
  assetId: string | null;
  generation: number;
}

interface HeldTexture {
  readonly lease: TextureLease;
  readonly users: Set<MapState>;
  readonly unsubscribe: () => void;
}

export class LayerTextures {
  #options: LayerTexturesOptions;
  #maps = new Map<string, MapState>();
  #slots = new Set<number>();
  #textures = new Map<string, HeldTexture>();
  #unsubscribe: Array<() => void>;
  #disposed = false;

  constructor(
    options: LayerTexturesOptions
  ) {
    this.#options = options;
    const { document } = options;
    this.#unsubscribe = [
      document.subscribe("change", ({ command }) => {
        if (kLayerActions.has(command.action)) {
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
    const resized = view.layerTextureSize !== document.layers.textureSize;
    if (resized) {
      view.layerTextureSize = document.layers.textureSize;
    }

    const layers = new Map(document.layers.layers().map((layer) => [layer.slot, layer]));
    for (const slot of this.#slots) {
      if (!layers.has(slot)) {
        this.#slots.delete(slot);
        for (const map of LAYER_MAPS) {
          this.#assign(slot, map, null, false);
        }
        view.layerRemoved(slot);
      }
    }
    for (const layer of layers.values()) {
      this.#slots.add(layer.slot);
      view.layerChanged(layer.slot, { tiling: layer.tiling });
      for (const map of LAYER_MAPS) {
        this.#assign(layer.slot, map, mapAsset(layer, map), resized);
      }
    }
  }

  #assign(
    slot: number,
    map: LayerMap,
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
      view.writeLayerMap(slot, map, null);

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
        view.writeLayerMap(slot, map, null);

        return;
      }

      const image = await decode(bytes, view.layerTextureSize);
      try {
        if (current()) {
          view.writeLayerMap(slot, map, image);
        }
      }
      finally {
        image.close();
      }
    }
    catch (error) {
      if (current()) {
        view.writeLayerMap(slot, map, null);
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

export function decodeLayerImage(
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
  layer: TerrainLayerData,
  map: LayerMap
): string | null {
  return layer[map]?.id ?? null;
}
