// Import Third-party Dependencies
import { encodeBase64Url } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  DEFAULT_WEBSOCKET_PATH,
  WEBSOCKET_AUTH_PROTOCOL_PREFIX,
  WEBSOCKET_PROTOCOL
} from "./constants.ts";
import type { ClientSocket } from "../ClientSocket.ts";

// CONSTANTS
const kUtf8 = new TextEncoder();

export interface WebSocketConnectOptions {
  /**
   * @default `${wss|ws}://${location.host}/ws-sync`
   */
  url?: string;
  /**
   * Opaque credential offered during the handshake.
   */
  credential?: string;
}

function buildProtocols(
  credential: string | undefined
): string[] {
  if (credential === undefined) {
    return [WEBSOCKET_PROTOCOL];
  }
  const encoded = encodeBase64Url(kUtf8.encode(credential));

  return [WEBSOCKET_PROTOCOL, WEBSOCKET_AUTH_PROTOCOL_PREFIX + encoded];
}

function defaultUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${location.host}${DEFAULT_WEBSOCKET_PATH}`;
}

export function connectWebSocket(
  options: WebSocketConnectOptions = {}
): ClientSocket {
  return new WebSocket(
    options.url ?? defaultUrl(),
    buildProtocols(options.credential)
  );
}
