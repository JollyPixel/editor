// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  isMaterialCommand,
  type TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import { MATERIAL_MAPS } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type {
  TextureLease,
  TextureLeases
} from "./TextureLeases.ts";

export type MaterialThumbnailsEvents = {
  change: () => void;
};

export interface MaterialThumbnailsOptions {
  document: Pick<TerrainDocument, "materials" | "subscribe">;
  leases: Pick<TextureLeases, "hold">;
  createUrl(bytes: Uint8Array): string;
  revokeUrl(url: string): void;
}

interface HeldThumbnail {
  readonly lease: TextureLease;
  url: string | null;
}

export class MaterialThumbnails extends Emitter<MaterialThumbnailsEvents> {
  #options: MaterialThumbnailsOptions;
  #held = new Map<string, HeldThumbnail>();
  #unsubscribe: Array<() => void>;

  constructor(
    options: MaterialThumbnailsOptions
  ) {
    super();
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

  url(
    assetId: string | null | undefined
  ): string | null {
    return assetId === null || assetId === undefined ?
      null :
      this.#held.get(assetId)?.url ?? null;
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
    for (const assetId of [...this.#held.keys()]) {
      this.#drop(assetId);
    }
  }

  #sync(): void {
    const wanted = new Set<string>();
    for (const material of this.#options.document.materials.materials()) {
      for (const map of MATERIAL_MAPS) {
        const id = material[map]?.id;
        if (id !== undefined) {
          wanted.add(id);
        }
      }
    }

    for (const assetId of [...this.#held.keys()]) {
      if (!wanted.has(assetId)) {
        this.#drop(assetId);
      }
    }
    for (const assetId of wanted) {
      if (!this.#held.has(assetId)) {
        this.#hold(assetId);
      }
    }
  }

  #hold(
    assetId: string
  ): void {
    const lease = this.#options.leases.hold(assetId, () => this.#refresh(assetId));
    this.#held.set(assetId, { lease, url: null });
    lease.ready.then(
      () => this.#refresh(assetId),
      () => undefined
    );
  }

  #refresh(
    assetId: string
  ): void {
    const held = this.#held.get(assetId);
    if (held === undefined) {
      return;
    }

    const { bytes } = held.lease.document;
    if (held.url !== null) {
      this.#options.revokeUrl(held.url);
    }
    held.url = bytes === null ? null : this.#options.createUrl(bytes);
    this.emit("change");
  }

  #drop(
    assetId: string
  ): void {
    const held = this.#held.get(assetId);
    if (held === undefined) {
      return;
    }

    this.#held.delete(assetId);
    held.lease.release();
    if (held.url !== null) {
      this.#options.revokeUrl(held.url);
    }
    this.emit("change");
  }
}
