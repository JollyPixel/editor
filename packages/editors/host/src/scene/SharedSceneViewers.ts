// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { SceneAssetResolver } from "./SceneComponentPackage.ts";

export interface SharedSceneViewer {
  release(): void;
}

export type SceneViewerHold = (
  detach: () => void
) => () => void;

export interface SharedSceneViewersOptions<TViewer, TSource> {
  open(
    assetId: string
  ): TViewer;
  source(
    viewer: TViewer,
    hold: SceneViewerHold
  ): TSource;
}

interface SharedViewer<TViewer> {
  viewer: TViewer;
  views: number;
}

export class SharedSceneViewers<
  TViewer extends SharedSceneViewer,
  TSource
> implements SceneAssetResolver<TSource> {
  readonly #options: SharedSceneViewersOptions<TViewer, TSource>;
  readonly #viewers = new Map<string, SharedViewer<TViewer>>();
  #disposed = false;

  constructor(
    options: SharedSceneViewersOptions<TViewer, TSource>
  ) {
    this.#options = options;
  }

  resolve(
    reference: AssetReferenceData
  ): TSource {
    const assetId = reference.id;
    const shared = this.#shared(assetId);

    return this.#options.source(shared.viewer, (detach) => {
      shared.views++;

      return () => {
        detach();
        shared.views--;
        queueMicrotask(() => this.#releaseUnused(assetId, shared));
      };
    });
  }

  dispose(): void {
    this.#disposed = true;
    for (const shared of this.#viewers.values()) {
      shared.viewer.release();
    }
    this.#viewers.clear();
  }

  #shared(
    assetId: string
  ): SharedViewer<TViewer> {
    let shared = this.#viewers.get(assetId);
    if (shared === undefined) {
      shared = {
        viewer: this.#options.open(assetId),
        views: 0
      };
      this.#viewers.set(assetId, shared);
    }

    return shared;
  }

  #releaseUnused(
    assetId: string,
    shared: SharedViewer<TViewer>
  ): void {
    if (
      this.#disposed ||
      shared.views > 0 ||
      this.#viewers.get(assetId) !== shared
    ) {
      return;
    }

    this.#viewers.delete(assetId);
    shared.viewer.release();
  }
}
