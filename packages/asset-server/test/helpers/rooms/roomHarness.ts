// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { Server, type ServerConnection } from "@jolly-pixel/network";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  AssetTags,
  CatalogProjection,
  registerAssetRooms,
  type AssetKindHandler
} from "#src/index.ts";
import { syncHarness, type SyncHarness } from "../backend.ts";
import {
  counterHandler,
  liveCounterHandler,
  type CounterState
} from "../kinds.ts";
import { bytes } from "../bytes.ts";
import { recordingLogger } from "../logger.ts";
import { recordingClient, type RecordingClient } from "../rooms.ts";

// CONSTANTS
export const ROOM_ACTOR: EventStore.Actor = {
  type: "user",
  id: "alice"
};

type CounterKind = "live" | "plain";

const counterKinds: Record<CounterKind, () => AssetKindHandler<CounterState>> = {
  live: () => liveCounterHandler({ delay: 0, maxDelay: 0 }),
  plain: () => counterHandler()
};

export interface RoomHarness extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly server: Server;
  readonly catalog: CatalogProjection;
  readonly tags: AssetTags;
  readonly assetId: string;
  readonly clients: Map<string, RecordingClient>;
  readonly refusals: string[];
  join(clientId: string, room?: string): Promise<ServerConnection>;
  send(clientId: string, payload: unknown): Promise<void>;
}

export interface RoomHarnessOptions {
  graceMs?: number;
  kind?: CounterKind;
  handler?: AssetKindHandler<CounterState>;
  extraHandlers?: AssetKindHandler[];
}

export async function roomHarness(
  options: RoomHarnessOptions = {}
): Promise<RoomHarness> {
  const { graceMs = 1_000, kind = "live" } = options;
  const sync = await syncHarness({
    handlers: [
      options.handler ?? counterKinds[kind](),
      ...options.extraHandlers ?? []
    ],
    snapshot: { delay: 0, maxDelay: 0 }
  });

  const created = (await sync.writer.create({
    path: "a.counter",
    data: bytes("0"),
    actor: ROOM_ACTOR
  })).unwrap();
  await sync.projector.flush();

  const catalog = new CatalogProjection({ projector: sync.projector });
  catalog.load();
  catalog.start();

  const server = new Server({
    roomGraceMs: graceMs
  });
  const { logger, records } = recordingLogger();
  async function flush(
    assetId: string
  ): Promise<void> {
    await sync.scheduler.flush(assetId);
    await sync.projector.flush(assetId);
  }
  const tags = new AssetTags({
    eventStore: sync.eventStore,
    projector: sync.projector,
    writer: sync.writer,
    flush,
    objects: sync.objects
  });
  registerAssetRooms({
    server,
    events: sync.eventStore.writer,
    kinds: sync.kinds,
    catalog,
    states: sync.states,
    flush,
    tags,
    logger
  });

  const clients = new Map<string, RecordingClient>();
  const connections = new Map<string, ServerConnection>();

  return {
    sync,
    server,
    catalog,
    tags,
    clients,
    assetId: created.assetId,
    get refusals() {
      return records
        .filter((record) => record.message === "asset room refused")
        .map((record) => record.metadata.reason as string);
    },
    async join(
      clientId,
      room = new AssetRoom("counter", created.assetId).toString()
    ) {
      const handle = recordingClient(clientId);
      clients.set(clientId, handle);
      const connection = server.connect(handle, { subject: handle.id, role: "default" });
      connections.set(clientId, connection);
      await connection.receive({ room, kind: "join" });

      return connection;
    },
    async send(clientId, payload) {
      await connections.get(clientId)?.receive({
        room: new AssetRoom("counter", created.assetId).toString(),
        kind: "message",
        payload
      });
    },
    async [Symbol.asyncDispose]() {
      await server.close();
      catalog.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}
