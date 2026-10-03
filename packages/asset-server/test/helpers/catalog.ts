// Import Node.js Dependencies
import { once } from "node:events";
import http from "node:http";

// Import Third-party Dependencies
import {
  Client,
  LoopbackTransport,
  Server,
  type ServerOptions
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  silentLogger,
  type AssetBackend,
  type CatalogCommand
} from "#src/index.ts";
import { CatalogClient } from "#src/catalog/client/index.ts";
import { createCatalogHandler } from "#src/node.ts";
import {
  catalogBackend,
  syncHarness,
  type SyncHarness
} from "./backend.ts";
import {
  recordingClient,
  recordingRoom,
  roomPeer,
  type DirectMessage,
  type RecordingRoom
} from "./rooms.ts";

export interface CatalogCommands extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly room: RecordingRoom;
  send(command: CatalogCommand): Promise<void>;
  lastDirect(): DirectMessage | undefined;
}

export async function catalogCommands(
  maxContentBytes?: number
): Promise<CatalogCommands> {
  const sync = await syncHarness();
  const projection = new CatalogProjection({
    eventStore: sync.eventStore
  });
  projection.load();
  projection.start();

  const extension = new CatalogExtension({
    backend: catalogBackend(sync, projection),
    maxContentBytes
  });
  const room = recordingRoom();
  extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);

  return {
    sync,
    room,
    send: (command) => extension.onMessage("A", command, room.context),
    lastDirect: () => room.direct.at(-1),
    async [Symbol.asyncDispose]() {
      extension.dispose();
      projection.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}

export interface CatalogConnection extends AsyncDisposable {
  readonly catalog: CatalogClient;
}

export async function connectCatalog(
  backend: AssetBackend,
  options: ServerOptions = {}
): Promise<CatalogConnection> {
  const server = new Server({
    ...options,
    logger: silentLogger()
  });
  const detach = backend.attach(server);
  const transport = new LoopbackTransport({ server });
  const client = new Client({
    socket: () => transport.connect()
  });
  const catalog = await CatalogClient.connect(client);

  return {
    catalog,
    async [Symbol.asyncDispose]() {
      catalog.dispose();
      client.destroy();
      detach();
      await server.close();
    }
  };
}

export interface CatalogHttpServer extends AsyncDisposable {
  readonly origin: string;
}

export async function serveCatalog(
  projection: CatalogProjection
): Promise<CatalogHttpServer> {
  const handler = createCatalogHandler({ projection });
  const server = http.createServer((request, response) => {
    handler(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as { port: number; };

  return {
    origin: `http://127.0.0.1:${port}`,
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  };
}
