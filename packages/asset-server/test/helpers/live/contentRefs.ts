// Import Node.js Dependencies
import {
  createServer,
  type Server as HttpServer
} from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";

// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import {
  Client,
  LoopbackTransport,
  type Room
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  binaryAssetKind,
  binaryCommands,
  type AssetKindHandler,
  type BinaryAssetState,
  type ContentRefs
} from "#src/index.ts";
import {
  createContentHandler,
  type ContentHandler
} from "#src/node/contentHandler.ts";
import { bytes } from "../bytes.ts";
import {
  roomHarness,
  type RoomHarness
} from "./roomHarness.ts";

// CONSTANTS
const kRefAbove = 4;
export const LARGE_CONTENT = bytes("large content ".repeat(64));

export function blobHandler(
  compress = false
): AssetKindHandler<BinaryAssetState> {
  return {
    ...binaryAssetKind,
    kind: "blob",
    extensions: {
      ".blob": "application/octet-stream"
    },
    commands: binaryCommands("blob.command", {
      compress,
      refAbove: kRefAbove
    })
  };
}

export interface BlobRoomOptions {
  readonly contentRefs?: ContentRefs;
  readonly compress?: boolean;
}

export function blobRoom(
  data: Uint8Array,
  options: BlobRoomOptions = {}
): Promise<RoomHarness> {
  return roomHarness({
    extraHandlers: [blobHandler(options.compress)],
    contentRefs: options.contentRefs,
    asset: {
      kind: "blob",
      path: "a.blob",
      data
    }
  });
}

export interface ContentServer extends AsyncDisposable {
  readonly origin: string;
}

export function contentServer(
  refs: ContentRefs,
  compression = false
): Promise<ContentServer> {
  return serveContent(createContentHandler(refs, { compression }));
}

export async function serveContent(
  handler: ContentHandler
): Promise<ContentServer> {
  const server: HttpServer = createServer((request, response) => {
    handler(request, response, () => {
      response.statusCode = 418;
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  };
}

export interface JoinedRoom extends Disposable {
  readonly room: Room;
  readonly snapshot: Promise<unknown>;
}

export function joinOverLoopback(
  harness: RoomHarness,
  roomName = new AssetRoom("blob", harness.assetId).toString()
): JoinedRoom {
  const transport = new LoopbackTransport({ server: harness.server });
  const client = new Client({
    socket: () => transport.connect()
  });
  const room = client.room(roomName);
  const snapshot = Promise.withResolvers<unknown>();
  room.on("message", (message) => {
    const { type, data } = message as { type: string; data: unknown; };
    if (type === "snapshot") {
      snapshot.resolve(data);
    }
  });
  room.join();

  return {
    room,
    snapshot: snapshot.promise,
    [Symbol.dispose]() {
      client.destroy();
    }
  };
}

export function lastSnapshot(
  harness: RoomHarness,
  clientId: string
): unknown {
  const snapshots = harness.clients.get(clientId)!.received
    .map((envelope) => (envelope as { payload?: { type?: string; data?: unknown; }; }).payload)
    .filter((payload) => payload?.type === "snapshot");

  return snapshots.at(-1)?.data;
}

export function fetchFrom(
  t: TestContext,
  origin: string
): void {
  const realFetch = globalThis.fetch;
  t.mock.method(
    globalThis,
    "fetch",
    (input: string, init?: RequestInit) => realFetch(new URL(input, origin), init)
  );
}
