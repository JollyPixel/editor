// Import Node.js Dependencies
import type {
  IncomingMessage,
  Server as HttpServer
} from "node:http";
import type { Http2SecureServer } from "node:http2";
import type { Duplex } from "node:stream";
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import {
  WebSocketServer,
  type WebSocket
} from "ws";

// Import Internal Dependencies
import type { Server } from "../server/Server.ts";
import type { Logger } from "../server/logger.ts";
import type { PeerIdentity } from "../server/auth/AuthenticationProvider.ts";
import {
  UNAUTHORIZED_CLOSE_CODE,
  UNAUTHORIZED_CLOSE_REASON,
  WEBSOCKET_PROTOCOL
} from "./constants.ts";
import type { ClientHandle } from "./ClientHandle.ts";

export interface WebsocketTransportOptions {
  /**
   * WebSocket upgrade path, matched exactly against the request pathname.
   * Upgrades on other paths are left to other listeners, such as Vite HMR.
   */
  path: string;
  /**
   * HTTP server whose "upgrade" events are handled.
   * Closing it terminates every connected client.
   */
  httpServer: HttpServer | Http2SecureServer;
  /**
   * Server that authenticates upgrades and receives client connections,
   * messages and disconnects. Its logger is reused by the transport.
   */
  server: Server;
}

export class WebsocketTransport {
  #server: Server;
  #logger: Logger;
  #path: string;
  #wss: WebSocketServer;

  constructor(
    options: WebsocketTransportOptions
  ) {
    const {
      path,
      httpServer,
      server
    } = options;
    this.#server = server;
    this.#logger = server.logger;
    this.#path = path;

    // Manual upgrade filtering requires `noServer` mode.
    this.#wss = new WebSocketServer({
      noServer: true,
      handleProtocols(protocols) {
        return protocols.has(WEBSOCKET_PROTOCOL)
          ? WEBSOCKET_PROTOCOL
          : false;
      }
    });
    this.#wss.on(
      "error",
      (error) => this.#logger.withError(error).error("server error")
    );

    httpServer.on(
      "upgrade",
      this.#onUpgrade
    );
    httpServer.once(
      "close",
      () => this.#onHttpServerClose(httpServer)
    );

    this.#logger.info(`WebSocket transport listening on ${path}`);
  }

  #onUpgrade = (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): void => {
    const queryIndex = (req.url ?? "").indexOf("?");
    const pathname = queryIndex === -1
      ? req.url
      : req.url?.slice(0, queryIndex);
    if (pathname !== this.#path) {
      return;
    }

    const clientId = randomUUID();

    void this.#server
      .authenticate({
        clientId,
        url: req.url ?? "",
        headers: req.headers
      })
      .then((identity) => {
        this.#wss.handleUpgrade(req, socket, head, (ws) => {
          if (identity === null) {
            ws.close(
              UNAUTHORIZED_CLOSE_CODE,
              UNAUTHORIZED_CLOSE_REASON
            );

            return;
          }

          this.#onWebsocketClientConnect(
            ws,
            clientId,
            identity
          );
        });
      });
  };

  #onHttpServerClose(
    httpServer: HttpServer | Http2SecureServer
  ): void {
    httpServer.off(
      "upgrade",
      this.#onUpgrade
    );
    for (const client of this.#wss.clients) {
      client.terminate();
    }
    this.#wss.close();
  }

  #onWebsocketClientConnect(
    socket: WebSocket,
    clientId: string,
    identity: PeerIdentity
  ): void {
    const handle: ClientHandle = {
      id: clientId,
      send(data) {
        socket.send(JSON.stringify(data));
      }
    };

    this.#server.handleConnect(
      handle,
      identity
    );

    socket.on("message", (raw) => {
      this.#server.handleMessage(
        clientId,
        raw.toString()
      );
    });
    socket.on(
      "close",
      () => this.#server.handleDisconnect(clientId)
    );
    socket.on(
      "error",
      (error) => this.#logger
        .withError(error)
        .error("client socket error")
    );
  }
}
