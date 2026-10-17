// Import Node.js Dependencies
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  MessageProtocol,
  Server,
  commandVariant,
  withCommandHeader,
  type ClientConnection,
  type PeerIdentity,
  type ServerConnection
} from "@jolly-pixel/network";
import { mulberry32 } from "@jolly-pixel/bench";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  createAssetBackend,
  silentLogger,
  writeData,
  type AssetBackend,
  type AssetCommandHeader,
  type AssetCommands,
  type AssetEventDataMap,
  type AssetKindHandler,
  type SnapshotPolicy
} from "../src/index.ts";
import { encodeBase64 } from "../src/utils/base64.ts";

// CONSTANTS
export const GRID_KIND = "grid";
export const GRID_PAINTED = "grid.painted";
export const BINARY_KIND = "binary";
export const IDLE_SNAPSHOT: SnapshotPolicy = {
  delay: 3_600_000,
  maxDelay: 3_600_000
};

const kBinaryBytes = 64;
const kSceneEvery = 10;
const kSceneDependencies = 8;
const kSeedActor: EventStore.Actor = {
  type: "system",
  source: "bench"
};
const kGridProtocol = new MessageProtocol(z.union([
  withCommandHeader(commandVariant("paint", {
    index: z.int().check(z.minimum(0)),
    value: z.int().check(z.minimum(0), z.maximum(255)),
    sentAt: z.optional(z.number())
  }))
]));
const kGridSnapshotSchema = z.object({
  cells: z.string()
});

export type StoreKind = "memory" | "sqlite";

export interface GridState {
  cells: Uint8Array;
}

export interface GridCommand extends AssetCommandHeader {
  action: "paint";
  index: number;
  value: number;
  sentAt?: number;
}

export interface GridOptions {
  contentBytes: number;
  snapshot?: SnapshotPolicy;
}

export function gridHandler(
  options: GridOptions
): AssetKindHandler<GridState, GridCommand> {
  const { contentBytes } = options;
  const commands: AssetCommands<GridState, GridCommand> = {
    eventType: GRID_PAINTED,
    protocol: kGridProtocol,
    apply(state, command) {
      state.cells[command.index % state.cells.length] = command.value;
    },
    live(binding) {
      return {
        snapshotSchema: kGridSnapshotSchema,
        snapshot: () => {
          return { cells: encodeBase64(binding.state.cells) };
        },
        arbitrate: (command) => {
          return { command };
        }
      };
    }
  };

  return {
    kind: GRID_KIND,
    extensions: { ".grid": "application/octet-stream" },
    snapshot: options.snapshot,
    commands,
    create: () => {
      return { cells: new Uint8Array(contentBytes) };
    },
    load: (state, content) => {
      state.cells = content.slice();
    },
    clear: (state) => {
      state.cells = new Uint8Array(contentBytes);
    },
    serialize: (state) => Promise.resolve(state.cells.slice())
  };
}

export function paintCommand(
  step: number,
  clientId = "author"
): GridCommand {
  return {
    action: "paint",
    clientId,
    seq: step,
    timestamp: 1_700_000_000_000,
    index: (step * 31) % 4_096,
    value: step % 256
  };
}

export function createBytes(
  length: number,
  seed: number
): Uint8Array {
  const random = mulberry32(seed);
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index++) {
    bytes[index] = Math.floor(random() * 256);
  }

  return bytes;
}

export function gridAssetId(
  index: number
): string {
  return `grid-${index}`;
}

export function binaryAssetId(
  index: number
): string {
  return `asset-${index}`;
}

export function gridRoom(
  assetId: string
): string {
  return `${GRID_KIND}:${assetId}`;
}

export function createIdentity(
  subject: string
): PeerIdentity {
  return {
    subject,
    role: "editor"
  };
}

export interface BenchBackendOptions {
  assets: number;
  grids: number;
  contentBytes: number;
  store?: StoreKind;
  snapshot?: SnapshotPolicy;
}

export interface BenchBackend extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  readonly source: MemoryAssetSource;
}

export async function benchBackend(
  options: BenchBackendOptions
): Promise<BenchBackend> {
  const location = options.store === "sqlite" ?
    fs.mkdtempSync(path.join(os.tmpdir(), "asset-server-bench-")) :
    null;
  const eventStore = location === null ?
    EventStore.persistence.memory<AssetEventDataMap>() :
    await EventStore.persistence.sqlite<AssetEventDataMap>(
      path.join(location, "events.db")
    );
  await seed(eventStore, options);

  const source = new MemoryAssetSource();
  const backend = await createAssetBackend({
    source,
    eventStore,
    handlers: [
      gridHandler({ contentBytes: options.contentBytes })
    ],
    snapshot: options.snapshot,
    reconcileOnStart: false,
    watch: false,
    logger: silentLogger()
  });
  await backend.flush();

  return {
    backend,
    eventStore,
    source,
    async [Symbol.asyncDispose]() {
      await backend.close();
      eventStore.close();
      if (location !== null) {
        removeStoreDirectory(location);
      }
    }
  };
}

async function seed(
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>,
  options: BenchBackendOptions
): Promise<void> {
  for (let index = 0; index < options.assets; index++) {
    const assetId = binaryAssetId(index);
    eventStore.writer.append({
      assetType: BINARY_KIND,
      assetId,
      eventType: ASSET_CREATED,
      eventData: await writeData(
        `assets/${Math.floor(index / 100)}/file-${index}.bin`,
        BINARY_KIND,
        createBytes(kBinaryBytes, index),
        sceneDependencies(index)
      ),
      actor: kSeedActor
    });
  }
  for (let index = 0; index < options.grids; index++) {
    eventStore.writer.append({
      assetType: GRID_KIND,
      assetId: gridAssetId(index),
      eventType: ASSET_CREATED,
      eventData: await writeData(
        `grids/grid-${index}.grid`,
        GRID_KIND,
        createBytes(options.contentBytes, index)
      ),
      actor: kSeedActor
    });
  }
}

function sceneDependencies(
  index: number
): AssetReferenceData[] {
  if (index % kSceneEvery !== kSceneEvery - 1) {
    return [];
  }

  return Array.from({ length: kSceneDependencies }, (_, offset) => {
    return {
      id: binaryAssetId(index - offset - 1),
      kind: BINARY_KIND
    };
  });
}

function removeStoreDirectory(
  location: string
): void {
  for (const file of fs.readdirSync(location)) {
    fs.unlinkSync(path.join(location, file));
  }
  fs.rmdirSync(location);
}

export class SinkHandle implements ClientConnection {
  readonly id: string;
  bytes = 0;
  messages = 0;

  constructor(
    id: string
  ) {
    this.id = id;
  }

  sendSerialized(
    json: string
  ): void {
    this.bytes += json.length;
    this.messages++;
  }

  close(): void {
    return;
  }
}

export interface BenchPeer {
  readonly handle: SinkHandle;
  readonly connection: ServerConnection;
}

export function connectPeer(
  server: Server,
  clientId: string
): BenchPeer {
  const handle = new SinkHandle(clientId);

  return {
    handle,
    connection: server.connect(handle, createIdentity(clientId))
  };
}

export async function joinRoom(
  peer: BenchPeer,
  room: string
): Promise<void> {
  await peer.connection.receive(JSON.stringify({
    room,
    kind: "join"
  }));
}

export async function leaveRoom(
  peer: BenchPeer,
  room: string
): Promise<void> {
  await peer.connection.receive(JSON.stringify({
    room,
    kind: "leave"
  }));
}

export function benchServer(
  backend: AssetBackend,
  graceMs?: number
): Server {
  const server = new Server({ logger: silentLogger() });
  backend.attach(server, { graceMs });

  return server;
}
