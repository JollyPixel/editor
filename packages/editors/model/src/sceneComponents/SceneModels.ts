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

interface OpenModel {
  preview: ModelPreview | null;
  readonly settled: Promise<void>;
}

export class SceneModels implements SceneAssetResolver<Model> {
  #session: SceneAssetContext;
  #updates: SceneAssetUpdates;
  #models = new Map<string, OpenModel>();
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
    return this.#open(reference.id).preview?.model ?? null;
  }

  ready(
    reference: AssetReferenceData
  ): Promise<void> {
    return this.#open(reference.id).settled;
  }

  dispose(): void {
    this.#disposed = true;
    for (const unfollow of this.#unfollows) {
      unfollow();
    }
    for (const lease of this.#leases) {
      lease.release();
    }
    this.#models.clear();
  }

  #open(
    assetId: string
  ): OpenModel {
    const open = this.#models.get(assetId);
    if (open !== undefined) {
      return open;
    }

    const lease = this.#session.assets.open(MODEL_FILE_DOCUMENT_KIND, assetId);
    const entry: OpenModel = {
      preview: null,
      settled: lease.ready.then(
        () => this.#follow(assetId, entry, lease.document)
      )
    };
    entry.settled.catch(() => undefined);
    this.#models.set(assetId, entry);
    this.#leases.push(lease);

    return entry;
  }

  #follow(
    assetId: string,
    entry: OpenModel,
    document: ModelFileDocument
  ): Promise<void> {
    if (this.#disposed) {
      throw new Error("The scene models were disposed.");
    }
    const { catalog } = this.#session;
    const targetRecord = catalog.record(assetId);
    if (targetRecord === undefined) {
      throw new Error(`No catalog record for model "${assetId}".`);
    }

    const preview = new ModelPreview(
      new ModelFile({ targetRecord, catalog }, document),
      catalog
    );
    let model = preview.model;
    const unsubscribe = preview.subscribe("change", () => {
      if (preview.model !== model) {
        model = preview.model;
        this.#updates.loaded();
      }
    });
    const unfollow = preview.follow();
    entry.preview = preview;
    this.#unfollows.push(() => {
      unsubscribe();
      unfollow();
    });

    return settled(preview);
  }
}

function settled(
  preview: ModelPreview
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  function settle(): void {
    const { view } = preview;
    if (view.status === "loading") {
      return;
    }
    stop();
    if (view.status === "failed") {
      reject(new Error(view.error));
    }
    else {
      resolve();
    }
  }
  const stop = preview.subscribe("change", settle);
  settle();

  return promise;
}
