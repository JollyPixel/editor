// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  TEXTURE_KIND,
  type AssetRoomNotice
} from "@jolly-pixel/asset-server";
import { resolveBinarySnapshot } from "@jolly-pixel/asset-server/client";
import type { AssetLease } from "@jolly-pixel/editor.host";
import type {
  SceneAssetContext,
  SceneAssetResolver,
  SceneAssetUpdates
} from "@jolly-pixel/editor.host/scene";
import { SnapshotDocument } from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";
import * as THREE from "three/webgpu";

export class TextureDocument extends SnapshotDocument<
  Uint8Array,
  Uint8Array | null
> {
  constructor() {
    super(null, (bytes) => (bytes.byteLength === 0 ? null : bytes));
  }
}

interface LoadedTexture {
  lease: AssetLease<TextureDocument>;
  texture: THREE.Texture | null;
  revision: number;
  unsubscribe: () => void;
}

// CONSTANTS
export const TEXTURE_DOCUMENT_KIND: CommandDocumentKind<
  typeof TEXTURE_KIND,
  TextureDocument,
  AssetRoomNotice
> = commandDocumentKind({
  kind: TEXTURE_KIND,
  createDocument: () => new TextureDocument(),
  keys: () => [],
  resolveSnapshot: resolveBinarySnapshot
});

export class SceneTextures implements SceneAssetResolver<THREE.Texture> {
  #session: SceneAssetContext;
  #updates: SceneAssetUpdates;
  #textures = new Map<string, LoadedTexture>();
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
  ): THREE.Texture | null {
    return this.#open(reference.id).texture;
  }

  dispose(): void {
    this.#disposed = true;
    for (const { lease, texture, unsubscribe } of this.#textures.values()) {
      unsubscribe();
      texture?.dispose();
      lease.release();
    }
    this.#textures.clear();
  }

  #open(
    assetId: string
  ): LoadedTexture {
    let loaded = this.#textures.get(assetId);
    if (loaded === undefined) {
      const lease = this.#session.assets.open(TEXTURE_DOCUMENT_KIND, assetId);
      const entry: LoadedTexture = {
        lease,
        texture: null,
        revision: 0,
        unsubscribe: () => undefined
      };
      loaded = entry;
      this.#textures.set(assetId, entry);
      lease.ready.then(
        () => {
          if (this.#disposed) {
            return;
          }
          entry.unsubscribe = lease.document.subscribe("reset", () => this.#load(entry));
          this.#load(entry);
        },
        () => undefined
      );
    }

    return loaded;
  }

  #load(
    entry: LoadedTexture
  ): void {
    const bytes = entry.lease.document.value;
    if (bytes === null) {
      return;
    }

    const revision = ++entry.revision;
    decodeTexture(bytes).then(
      (texture) => {
        if (this.#disposed || revision !== entry.revision) {
          texture.dispose();

          return;
        }
        const previous = entry.texture;
        entry.texture = texture;
        this.#updates.loaded();
        previous?.dispose();
      },
      () => undefined
    );
  }
}

async function decodeTexture(
  bytes: Uint8Array
): Promise<THREE.Texture> {
  const url = URL.createObjectURL(new Blob([bytes.slice()]));
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }
  finally {
    URL.revokeObjectURL(url);
  }
}
