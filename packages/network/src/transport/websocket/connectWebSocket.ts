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
   * A ws: or wss: URL, or an http: or https: URL whose scheme becomes ws:
   * or wss:.
   * @default `${wss|ws}://${location.host}/ws-sync`
   */
  url?: string | URL;
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

function webSocketUrl(
  url: string | URL
): string {
  const parsed = new URL(url);
  if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  }
  else if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  }

  return parsed.href;
}

function defaultUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${location.host}${DEFAULT_WEBSOCKET_PATH}`;
}

export function connectWebSocket(
  options: WebSocketConnectOptions = {}
): ClientSocket {
  const socket = new WebSocket(
    options.url === undefined ? defaultUrl() : webSocketUrl(options.url),
    buildProtocols(options.credential)
  );
  socket.binaryType = "arraybuffer";

  return socket;
}
