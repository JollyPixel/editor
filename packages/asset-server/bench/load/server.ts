// Import Node.js Dependencies
import http from "node:http";

// Import Third-party Dependencies
import {
  loadServerConfig,
  runLoadServer
} from "@jolly-pixel/bench";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import {
  benchBackend,
  benchServer
} from "../_fixtures.ts";
import type { LoadServerConfig } from "./protocol.ts";
import { createCatalogHandler } from "../../src/node.ts";

const config = loadServerConfig<LoadServerConfig>();
const fixture = await benchBackend({
  assets: config.assets,
  grids: config.grids,
  contentBytes: config.contentBytes,
  store: config.store,
  snapshot: {
    delay: config.snapshotDelayMs
  }
});
const server = benchServer(fixture.backend, config.graceMs);
const catalogHandler = createCatalogHandler({
  projection: fixture.backend.catalog
});

const httpServer = http.createServer((request, response) => {
  catalogHandler(request, response, () => {
    response.statusCode = 404;
    response.end();
  });
});
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
  await fixture[Symbol.asyncDispose]();
});
