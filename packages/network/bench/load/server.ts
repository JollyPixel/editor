// Import Node.js Dependencies
import http from "node:http";

// Import Third-party Dependencies
import {
  loadServerConfig,
  runLoadServer
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  EchoExtension,
  GATED_RIGHTS,
  silentLogger
} from "../_fixtures.ts";
import {
  roomName,
  type LoadServerConfig
} from "./protocol.ts";
import {
  DEFAULT_WEBSOCKET_PATH,
  Server
} from "../../src/index.ts";
import { WebsocketTransport } from "../../src/node.ts";

const config = loadServerConfig<LoadServerConfig>();
const server = new Server({
  logger: silentLogger(),
  ...(config.rights ? {
    rights: GATED_RIGHTS,
    defaultRole: "editor"
  } : {})
});
for (let index = 0; index < config.rooms; index++) {
  server.register(new EchoExtension({
    variants: config.variants,
    roomId: roomName(index),
    snapshotBytes: config.snapshotBytes
  }));
}

const httpServer = http.createServer();
const transport = new WebsocketTransport({
  path: DEFAULT_WEBSOCKET_PATH,
  httpServer,
  server,
  compression: config.compression,
  heartbeatMs: 0
});

runLoadServer(httpServer, async() => {
  transport[Symbol.dispose]();
  httpServer.close();
  await server.close();
});
