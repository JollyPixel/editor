// Import Internal Dependencies
import type { Server } from "../server/Server.ts";
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType
} from "../client/Client.ts";
import {
  UNAUTHORIZED_CLOSE_CODE,
  UNAUTHORIZED_CLOSE_REASON
} from "./constants.ts";

// CONSTANTS
const kLoopbackUrl = "loopback:";
const kNormalCloseCode = 1000;

type SocketListener = (event: ClientSocketEvent) => void;

export interface LoopbackTransportOptions {
  server: Server;
}

/**
 * Connects clients to a server living in the same process, without a
 * network socket. Envelopes are serialized and delivered asynchronously,
 * as they are over a WebSocket.
 */
export class LoopbackTransport {
  #server: Server;

  constructor(
    options: LoopbackTransportOptions
  ) {
    this.#server = options.server;
  }

  connect(): ClientSocket {
    const server = this.#server;
    const clientId = crypto.randomUUID();
    const listeners = new Map<ClientSocketEventType, SocketListener[]>();
    let connected = false;
    let closed = false;

    function emit(
      type: ClientSocketEventType,
      event: ClientSocketEvent = {}
    ): void {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    }

    function close(
      event: ClientSocketEvent
    ): void {
      if (closed) {
        return;
      }
      closed = true;
      if (connected) {
        void server.handleDisconnect(clientId);
      }
      queueMicrotask(() => emit("close", event));
    }

    void Promise
      .resolve()
      .then(() => server.authenticate({
        clientId,
        url: kLoopbackUrl,
        headers: {}
      }))
      .catch((error): null => {
        server.logger.withError(error).error("authentication provider failed");

        return null;
      })
      .then((identity) => {
        if (closed) {
          return;
        }
        if (identity === null) {
          close({
            code: UNAUTHORIZED_CLOSE_CODE,
            reason: UNAUTHORIZED_CLOSE_REASON
          });

          return;
        }

        connected = true;
        server.handleConnect(
          {
            id: clientId,
            send: (data) => {
              const raw = JSON.stringify(data);
              queueMicrotask(() => {
                if (!closed) {
                  emit("message", { data: raw });
                }
              });
            }
          },
          identity
        );
        emit("open");
      });

    return {
      send: (data) => {
        if (connected && !closed) {
          void server.handleMessage(clientId, data);
        }
      },
      close: () => close({
        code: kNormalCloseCode,
        reason: ""
      }),
      addEventListener: (type, listener) => {
        const registered = listeners.get(type) ?? [];
        registered.push(listener);
        listeners.set(type, registered);
      }
    };
  }
}
