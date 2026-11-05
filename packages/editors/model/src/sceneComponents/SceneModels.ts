// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  modelFileDocumentKind,
  type ModelFileDocument
} from "@jolly-pixel/asset.model/client";
import type { AssetLease } from "@jolly-pixel/editor.host";
import type {
  SceneAssetContext,
  SceneAssetResolver,
  SceneAssetUpdates
} from "@jolly-pixel/editor.host/scene";
import type { Model } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { ModelFile } from "../file/ModelFile.ts";
import { ModelPreview } from "../preview/ModelPreview.ts";

// CONSTANTS
export const MODEL_FILE_DOCUMENT_KIND = modelFileDocumentKind();

export class SceneModels implements SceneAssetResolver<Model> {
  #session: SceneAssetContext;
  #updates: SceneAssetUpdates;
  #previews = new Map<string, ModelPreview | null>();
  #leases: AssetLease<ModelFileDocument>[] = [];
  #unfollows: (() => void)[] = [];
  #disposed = false;

  constructor(
    session: SceneAssetContext,
    updates: SceneAssetUpdates
  ) {
    this.#session = session;
    this.#updates = updates;
  }

  resolve(
    reference: AssetReferenceData
  ): Model | null {
    if (!this.#previews.has(reference.id)) {
      this.#open(reference.id);
    }

    return this.#previews.get(reference.id)?.model ?? null;
  }

  dispose(): void {
    this.#disposed = true;
    for (const unfollow of this.#unfollows) {
      unfollow();
    }
    for (const lease of this.#leases) {
      lease.release();
    }
    this.#previews.clear();
  }

  #open(
    assetId: string
  ): void {
    const lease = this.#session.assets.open(MODEL_FILE_DOCUMENT_KIND, assetId);
    this.#previews.set(assetId, null);
    this.#leases.push(lease);
    lease.ready.then(
      () => this.#follow(assetId, lease.document),
      () => undefined
    );
  }

  #follow(
    assetId: string,
    document: ModelFileDocument
  ): void {
    const { catalog } = this.#session;
    const targetRecord = catalog.record(assetId);
    if (this.#disposed || targetRecord === undefined) {
      return;
    }

    const preview = new ModelPreview(
      new ModelFile({ targetRecord, catalog }, document)
    );
    let model = preview.model;
    const unsubscribe = preview.subscribe("change", () => {
      if (preview.model !== model) {
        model = preview.model;
        this.#updates.loaded();
      }
    });
    const unfollow = preview.follow();
    this.#previews.set(assetId, preview);
    this.#unfollows.push(() => {
      unsubscribe();
      unfollow();
    });
  }
}
