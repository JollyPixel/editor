// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { AssetReferenceData } from "@jolly-pixel/asset";
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

// Import Internal Dependencies
import { StudioAccess } from "#src/node/project/StudioAccess.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

export const GAME_ACCESS = StudioAccess.from({
  defaultRole: "player",
  roles: {
    player: {
      "*.$join": "write",
      "*": "read"
    },
    tester: {
      "texture:*": "void",
      "*.$join": "write",
      "*": "read"
    },
    publisher: {
      "studio.$export": "write",
      "*.$join": "write",
      "*": "read"
    }
  },
  accessRequests: false
}, "project.json");

export function uses(
  ...references: AssetReferenceData[]
): string {
  return JSON.stringify({ uses: references });
}

function usingKind(
  kind: string,
  extension: string
): AssetKindHandler<BinaryAssetState> {
  return {
    ...binaryAssetKind,
    kind,
    extensions: { [extension]: "application/json" },
    dependencies: (state) => (state.bytes.byteLength === 0 ?
      [] :
      JSON.parse(new TextDecoder().decode(state.bytes)).uses ?? [])
  };
}

function scriptKind(): AssetKindHandler<BinaryAssetState> {
  return {
    ...binaryAssetKind,
    kind: "script",
    extensions: { ".ts": "text/plain" },
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

export function gameAccount(
  role: string
): Account {
  return {
    id: role,
    username: role,
    role,
    owner: false
  };
}

export interface GameProject extends AsyncDisposable {
  readonly backend: AssetBackend;
  create(path: string, content: string): Promise<string>;
}

export async function gameProject(): Promise<GameProject> {
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source: new MemoryAssetSource(),
    eventStore,
    handlers: [
      textureAssetKind(),
      usingKind("scene", ".scene.json"),
      usingKind("blockset", ".blockset.json"),
      {
        ...usingKind("voxelmap", ".voxelmap.json"),
        build: undefined
      },
      {
        ...binaryAssetKind,
        kind: "model",
        extensions: { ".obj": "model/obj" }
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
    async [Symbol.asyncDispose]() {
      await backend.close();
      eventStore.close();
    }
  };
}
