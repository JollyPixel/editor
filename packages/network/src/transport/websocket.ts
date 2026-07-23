// Import Node.js Dependencies
import type {
  IncomingMessage,
  Server
} from "node:http";
import type { Http2SecureServer } from "node:http2";
import type { Duplex } from "node:stream";
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import {
  WebSocketServer,
  type WebSocket
} from "ws";
import pino, { type Logger } from "pino";

// Import Internal Dependencies
import type { NetworkServer } from "../NetworkServer.ts";
import type { ClientHandle } from "../types.ts";

export interface WebsocketTransportOptions {
  /**
   * WebSocket upgrade path, kept distinct from Vite's own HMR socket so both
   * can share the dev server's HTTP port.
   *
   * @default "/ws-sync"
   */
  path?: string;

  httpServer: Server | Http2SecureServer;
  server: NetworkServer;
  logger?: Logger;
}

/**
 * Pure ws-server plumbing: forwards raw connect/disconnect/message events
 * into a NetworkServer. Carries no knowledge of namespaces or plugins.
 */
export class WebsocketTransport {
  static DefaultPath = "/ws-sync";

  #server: NetworkServer;
  #logger: Logger;

  constructor(
    options: WebsocketTransportOptions
  ) {
    const {
      path = WebsocketTransport.DefaultPath,
      httpServer,
      server,
      logger = pino({ name: "network" })
    } = options;
    this.#server = server;
    this.#logger = logger;

    // `noServer: true` + a manually filtered "upgrade" listener (rather
    // than passing `server` + `path` straight to WebSocketServer) is
    // required to share Vite's httpServer safely.
    const wss = new WebSocketServer({
      noServer: true
    });

    wss.on("error", (error) => this.#logger.error({ err: error }, "server error"));

    function onUpgrade(
      req: IncomingMessage,
      socket: Duplex,
      head: Buffer
    ): void {
      const queryIndex = (req.url ?? "").indexOf("?");
      const pathname = queryIndex === -1 ? req.url : req.url?.slice(0, queryIndex);
      if (pathname !== path) {
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
    httpServer.on("upgrade", onUpgrade);

    wss.on("connection", this.#onWebsocketClientConnect.bind(this));

    // Vite restarts its HTTP server in place on a config change (and
    // reruns this hook against a fresh WebSocketServer each time). An
    // open WebSocket upgrade counts as an active connection on the
    // underlying http.Server, so leftover clients block `httpServer.close()`
    // from ever completing — the next `.listen()` on the same port then
    // fails with EADDRINUSE. Force-closing this server's own clients here
    // guarantees the old server actually releases the port.
    httpServer.once("close", () => {
      httpServer.off("upgrade", onUpgrade);
      for (const client of wss.clients) {
        client.terminate();
      }
      wss.close();
    });

    this.#logger.info(`WebSocket transport listening on ${path}`);
  }

  #onWebsocketClientConnect(
    socket: WebSocket
  ): void {
    const clientId = randomUUID();
    const handle: ClientHandle = {
      id: clientId,
      send: (data) => socket.send(JSON.stringify(data))
    };

    this.#server.handleConnect(handle);

    socket.on("message", (raw) => {
      this.#server.handleMessage(clientId, JSON.parse(raw.toString()));
    });
    socket.on("close", () => this.#server.handleDisconnect(clientId));
    socket.on("error", (error) => this.#logger.error({ err: error }, "client socket error"));
  }
}
