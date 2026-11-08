// Import Third-party Dependencies
import type { AssetPreview } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { AssetPreviewTarget } from "../../catalog/AssetSummary.ts";
import type { KindPreview } from "../../../shared/ProjectManifest.ts";

// CONSTANTS
const kDefaultCapacity = 32;

export interface PreviewSource {
  preview(
    assetId: string
  ): Promise<AssetPreview | null>;
}

export type PreviewSources = Readonly<Record<KindPreview, PreviewSource>>;

export class AssetPreviewCache {
  #sources: PreviewSources;
  #capacity: number;
  #urls = new Map<string, string | null>();
  #pending = new Map<string, Promise<string | null>>();
  #disposed = false;

  constructor(
    sources: PreviewSources,
    capacity = kDefaultCapacity
  ) {
    this.#sources = { ...sources };
    this.#capacity = capacity;
  }

  load(
    target: AssetPreviewTarget
  ): Promise<string | null> {
    const key = `${target.assetId}@${target.revision ?? ""}`;
    const cached = this.#urls.get(key);
    if (cached !== undefined) {
      this.#urls.delete(key);
      this.#urls.set(key, cached);

      return Promise.resolve(cached);
    }

    const pending = this.#pending.get(key) ??
      this.#fetch(this.#sources[target.source], target.assetId, key);
    this.#pending.set(key, pending);

    return pending;
  }

  dispose(): void {
    this.#disposed = true;
    for (const url of this.#urls.values()) {
      revoke(url);
    }
    this.#urls.clear();
    this.#pending.clear();
  }

  async #fetch(
    source: PreviewSource,
    assetId: string,
    key: string
  ): Promise<string | null> {
    try {
      const preview = await source.preview(assetId);
      if (this.#disposed) {
        return null;
      }

      const url = preview === null ?
        null :
        URL.createObjectURL(
          new Blob([preview.bytes.slice()], { type: preview.type })
        );
      this.#store(key, url);

      return url;
    }
    finally {
      this.#pending.delete(key);
    }
  }

  #store(
    key: string,
    url: string | null
  ): void {
    this.#urls.set(key, url);
    for (const [oldest, evicted] of this.#urls) {
      if (this.#urls.size <= this.#capacity) {
        break;
      }
      this.#urls.delete(oldest);
      revoke(evicted);
    }
  }
}

function revoke(
  url: string | null
): void {
  if (url !== null) {
    URL.revokeObjectURL(url);
  }
}
