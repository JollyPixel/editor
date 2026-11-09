// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import type { AssetPreviewTarget } from "../../catalog/AssetSummary.ts";
import type { AssetPreviewCache } from "./AssetPreviewCache.ts";

export class AssetPreviewController {
  #host: Pick<ReactiveControllerHost, "requestUpdate">;
  #previews: AssetPreviewCache | null = null;
  #target: AssetPreviewTarget | null = null;
  #url: string | null = null;
  #loading = false;

  constructor(
    host: Pick<ReactiveControllerHost, "requestUpdate">
  ) {
    this.#host = host;
  }

  get url(): string | null {
    return this.#url;
  }

  get loading(): boolean {
    return this.#loading;
  }

  show(
    previews: AssetPreviewCache | null,
    target: AssetPreviewTarget | null
  ): void {
    const sameCache = previews === this.#previews;
    const sameAsset = target?.assetId === this.#target?.assetId;
    if (sameCache && sameAsset && target?.revision === this.#target?.revision) {
      return;
    }

    if (!sameCache || !sameAsset) {
      this.#display(null);
    }
    this.#previews = previews;
    this.#target = target;
    this.#loading = false;
    if (previews === null || target === null) {
      return;
    }

    this.#loading = true;
    void this.#load(previews, target);
  }

  async #load(
    previews: AssetPreviewCache,
    target: AssetPreviewTarget
  ): Promise<void> {
    const url = await previews.load(target).catch(() => null);
    if (previews === this.#previews && target === this.#target) {
      this.#loading = false;
      this.#url = url;
      this.#host.requestUpdate();
    }
  }

  #display(
    url: string | null
  ): void {
    if (url !== this.#url) {
      this.#url = url;
      this.#host.requestUpdate();
    }
  }
}
