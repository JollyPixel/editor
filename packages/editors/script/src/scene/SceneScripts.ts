// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  ScriptOutlineFeed,
  SCRIPT_KIND,
  textDocumentKind,
  type ScriptDocument,
  type ScriptOutline
} from "@jolly-pixel/asset.script/client";
import type { AssetLease } from "@jolly-pixel/editor.host";
import type {
  SceneAssetContext,
  SceneAssetResolver,
  SceneAssetUpdates
} from "@jolly-pixel/editor.host/scene";

// CONSTANTS
export const SCRIPT_DOCUMENT_KIND = textDocumentKind(SCRIPT_KIND);

interface OpenScript {
  lease: AssetLease<ScriptDocument>;
  feed: ScriptOutlineFeed;
}

export class SceneScripts implements SceneAssetResolver<ScriptOutline> {
  #session: SceneAssetContext;
  #updates: SceneAssetUpdates;
  #scripts = new Map<string, OpenScript>();
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
  ): ScriptOutline | null {
    return this.#open(reference.id).feed.outline;
  }

  dispose(): void {
    this.#disposed = true;
    for (const { lease, feed } of this.#scripts.values()) {
      feed.dispose();
      lease.release();
    }
    this.#scripts.clear();
  }

  #open(
    assetId: string
  ): OpenScript {
    let script = this.#scripts.get(assetId);
    if (script === undefined) {
      const lease = this.#session.assets.open(SCRIPT_DOCUMENT_KIND, assetId);
      const feed = new ScriptOutlineFeed(lease.room);
      feed.on("change", () => this.#updates.loaded());
      lease.ready.then(
        () => {
          if (!this.#disposed) {
            feed.request();
          }
        },
        () => undefined
      );
      script = {
        lease,
        feed
      };
      this.#scripts.set(assetId, script);
    }

    return script;
  }
}
