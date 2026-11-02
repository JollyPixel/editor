// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  fontDocumentKind,
  type FontDocument,
  type Typeface
} from "@jolly-pixel/asset.font/client";
import type { AssetLease } from "@jolly-pixel/editor.host";
import type {
  SceneAssetContext,
  SceneAssetResolver,
  SceneAssetUpdates
} from "@jolly-pixel/editor.host/scene";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";

// CONSTANTS
export const FONT_DOCUMENT_KIND = fontDocumentKind();

interface LoadedFont {
  lease: AssetLease<FontDocument>;
  font: Font | null;
}

export class SceneFonts implements SceneAssetResolver<Font> {
  #session: SceneAssetContext;
  #updates: SceneAssetUpdates;
  #fonts = new Map<string, LoadedFont>();
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
  ): Font | null {
    return this.#font(reference.id).font;
  }

  dispose(): void {
    this.#disposed = true;
    for (const { lease } of this.#fonts.values()) {
      lease.release();
    }
    this.#fonts.clear();
  }

  #font(
    assetId: string
  ): LoadedFont {
    let loaded = this.#fonts.get(assetId);
    if (loaded === undefined) {
      const lease = this.#session.assets.open(FONT_DOCUMENT_KIND, assetId);
      const entry: LoadedFont = {
        lease,
        font: null
      };
      loaded = entry;
      this.#fonts.set(assetId, entry);
      lease.ready.then(
        () => this.#load(entry),
        () => undefined
      );
    }

    return loaded;
  }

  #load(
    entry: LoadedFont
  ): void {
    const { typeface } = entry.lease.document;
    if (this.#disposed || typeface === null) {
      return;
    }

    entry.font = createFont(typeface);
    this.#updates.loaded();
  }
}

function createFont(
  typeface: Typeface
): Font {
  return new Font({
    ...typeface,
    original_font_information: {}
  });
}
