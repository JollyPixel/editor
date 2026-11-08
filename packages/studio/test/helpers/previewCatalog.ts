// Import Third-party Dependencies
import type { AssetPreview } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { AssetPreviewTarget } from "../../src/catalog/AssetSummary.ts";
import type { PreviewCatalog } from "../../src/shell/assets/AssetPreviewCache.ts";

interface PendingPreview {
  readonly assetId: string;
  resolve(preview: AssetPreview | null): void;
}

export class FakePreviewCatalog implements PreviewCatalog {
  readonly requests: string[] = [];
  #pending: PendingPreview[] = [];

  preview(
    assetId: string
  ): Promise<AssetPreview | null> {
    this.requests.push(assetId);
    const { promise, resolve } = Promise.withResolvers<AssetPreview | null>();
    this.#pending.push({
      assetId,
      resolve
    });

    return promise;
  }

  async reply(
    assetId: string,
    preview: AssetPreview | null
  ): Promise<void> {
    const index = this.#pending.findIndex((pending) => pending.assetId === assetId);
    if (index === -1) {
      throw new Error(`No preview of "${assetId}" is pending.`);
    }

    const [pending] = this.#pending.splice(index, 1);
    pending.resolve(preview);
    await new Promise(setImmediate);
  }
}

export function pngPreview(
  label: string
): AssetPreview {
  return {
    type: "image/png",
    bytes: new TextEncoder().encode(label)
  };
}

export function previewTarget(
  assetId: string,
  revision = "r1"
): AssetPreviewTarget {
  return {
    assetId,
    revision
  };
}
