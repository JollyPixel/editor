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
  type PerMessageDeflateOptions,
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
import { HandshakePolicy } from "./HandshakePolicy.ts";
import { WebsocketConnection } from "./WebsocketConnection.ts";

// CONSTANTS
const kDefaultCompressionLevel = 3;
const kDefaultCompressionThreshold = 64;
const kDefaultMaxPayload = 16 * 1024 * 1024;
const kDefaultMaxBufferedBytes = 32 * 1024 * 1024;
const kDefaultHeartbeatMs = 30_000;
const kForbiddenResponse = [
  "HTTP/1.1 403 Forbidden",
  "Connection: close",
  "Content-Length: 0",
  "",
  ""
].join("\r\n");

export interface WebsocketCompressionOptions {
  /**
   * zlib level, from 1 (fastest) to 9 (smallest).
   * @default 3
   */
  level?: number;
  /**
   * Messages shorter than this many bytes are sent uncompressed.
   * @default 64
   */
  threshold?: number;
}

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
  /**
   * Negotiates permessage-deflate with clients that offer it.
   * `true` uses the default level and threshold.
   * @default false
   */
  compression?: boolean | WebsocketCompressionOptions;
  /**
   * Host header values accepted on upgrade, against DNS rebinding.
   * IP addresses, `localhost` and `*.localhost` are always accepted.
   * An entry starting with "." also accepts its subdomains.
   * `true` accepts any host.
   * @default []
   */
  allowedHosts?: readonly string[] | true;
  /**
   * Browser origins accepted on upgrade, besides the request's own host.
   * Upgrades without an Origin header, sent by non-browser clients, are
   * accepted. `true` accepts any origin.
   * @default []
   */
  allowedOrigins?: readonly string[] | true;
  /**
   * Largest client message, in bytes. A larger one closes the socket
   * with code 1009.
   * @default 16 MiB
   */
  maxPayload?: number;
  /**
   * Bytes a socket may have queued for sending. Past it, the client is
   * a slow reader and its socket is terminated.
   * @default 32 MiB
   */
  maxBufferedBytes?: number;
  /**
   * Milliseconds between pings. A socket that has not answered the
   * previous ping is terminated. 0 disables pings.
   * @default 30_000
   */
  heartbeatMs?: number;
}

export class WebsocketTransport {
  #server: Server;
  #logger: Logger;
  #path: string;
  #wss: WebSocketServer;
  #policy: HandshakePolicy;
  #maxBufferedBytes: number;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #connections = new Set<WebsocketConnection>();

  constructor(
    options: WebsocketTransportOptions
  ) {
    const {
      path,
      httpServer,
      server,
      compression = false,
      allowedHosts,
      allowedOrigins,
      maxPayload = kDefaultMaxPayload,
      maxBufferedBytes = kDefaultMaxBufferedBytes,
      heartbeatMs = kDefaultHeartbeatMs
    } = options;
    this.#server = server;
    this.#logger = server.logger;
    this.#path = path;
    this.#policy = new HandshakePolicy({
      allowedHosts,
      allowedOrigins
    });
    this.#maxBufferedBytes = maxBufferedBytes;

    // Manual upgrade filtering requires `noServer` mode.
    this.#wss = new WebSocketServer({
      noServer: true,
      maxPayload,
      perMessageDeflate: perMessageDeflate(compression),
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

    if (heartbeatMs > 0) {
      this.#heartbeat = setInterval(
        () => this.#probe(),
        heartbeatMs
      );
      this.#heartbeat.unref();
    }

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

    function destroySocket(): void {
      socket.destroy();
    }
    socket.on("error", destroySocket);

    const remoteAddress = req.socket.remoteAddress;
    const refusal = this.#policy.refusalFor(req.headers);
    if (refusal !== null) {
      this.#logger
        .withMetadata({
          remoteAddress,
          host: req.headers.host,
          origin: req.headers.origin,
          reason: refusal
        })
        .warn("upgrade refused");
      socket.once("finish", destroySocket);
      socket.end(kForbiddenResponse);

      return;
    }

    const clientId = randomUUID();

    void this.#server
      .authenticate({
        clientId,
        url: req.url ?? "",
        headers: req.headers,
        remoteAddress
      })
      .then((identity) => {
        socket.off("error", destroySocket);
        if (socket.destroyed) {
          return;
        }

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
    if (this.#heartbeat !== null) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }
    for (const client of this.#wss.clients) {
      client.terminate();
    }
    this.#wss.close();
  }

  #probe(): void {
    for (const connection of this.#connections) {
      connection.probe();
    }
  }

  #onWebsocketClientConnect(
    socket: WebSocket,
    clientId: string,
    identity: PeerIdentity
  ): void {
    const handle = new WebsocketConnection({
      id: clientId,
      socket,
      logger: this.#logger,
      maxBufferedBytes: this.#maxBufferedBytes,
      onMessage: (json) => serverConnection.receive(json)
    });
    this.#connections.add(handle);
    const serverConnection = this.#server.connect(
      handle,
      identity
    );

    socket.on(
      "message",
      (raw) => handle.receive(raw.toString())
    );
    socket.on(
      "pong",
      () => handle.markAlive()
    );
    socket.on(
      "close",
      () => {
        this.#connections.delete(handle);
        void serverConnection.close();
      }
    );
    socket.on(
      "error",
      (error) => this.#logger
        .withError(error)
        .error("client socket error")
    );
  }
}

function perMessageDeflate(
  compression: boolean | WebsocketCompressionOptions
): false | PerMessageDeflateOptions {
  if (compression === false) {
    return false;
  }

  const {
    level = kDefaultCompressionLevel,
    threshold = kDefaultCompressionThreshold
  } = compression === true ? {} : compression;

  return {
    threshold,
    zlibDeflateOptions: {
      level
    }
  };
}
