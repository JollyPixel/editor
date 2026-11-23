// Import Third-party Dependencies
import {
  binaryAssetKind,
  createAssetBackend,
  textureAssetKind,
  type AssetBackend,
  type AssetKindHandler,
  type BinaryAssetState
} from "@jolly-pixel/asset-server";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "offline"
};

export interface OfflineGame extends AsyncDisposable {
  readonly backend: AssetBackend;
  create(path: string, content: string): Promise<string>;
  revision(assetId: string): string;
}

function scriptKind(): AssetKindHandler<BinaryAssetState> {
  return {
    ...binaryAssetKind,
    kind: "script",
    extensions: {
      ".ts": "text/plain"
    },
    build: {
      type: "text/javascript",
      build: (state) => (
        new TextDecoder().decode(state.bytes).includes("lodash") ?
          Promise.reject(new Error("\"lodash\" cannot be imported")) :
          Promise.resolve(state.bytes)
      )
    }
  };
}

export async function offlineGame(): Promise<OfflineGame> {
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source: new MemoryAssetSource(),
    eventStore,
    handlers: [
      textureAssetKind(),
      {
        ...binaryAssetKind,
        kind: "scene",
        extensions: { ".scene.json": "application/json" }
      },
      scriptKind()
    ],
    reconcile: {
      watch: false
    }
  });

  return {
    backend,
    async create(path, content) {
      const created = await backend.writer.create({
        path,
        data: new TextEncoder().encode(content),
        actor: kActor
      });

      return created.unwrap().assetId;
    },
    revision(assetId) {
      const revision = backend.catalog.record(assetId)?.revision;
      if (revision === undefined) {
        throw new Error(`"${assetId}" has no revision`);
      }

      return revision;
    },
    async [Symbol.asyncDispose]() {
      await backend.close();
      eventStore.close();
    }
  };
}
