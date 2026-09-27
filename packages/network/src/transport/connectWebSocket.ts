// Import Internal Dependencies
import {
  DEFAULT_WEBSOCKET_PATH,
  WEBSOCKET_AUTH_PROTOCOL_PREFIX,
  WEBSOCKET_PROTOCOL
} from "./constants.ts";
import type { ClientSocket } from "./ClientSocket.ts";

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

function base64url(
  value: string
): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function protocolsFor(
  credential: string | undefined
): string[] {
  return credential === undefined ?
    [WEBSOCKET_PROTOCOL] :
    [WEBSOCKET_PROTOCOL, WEBSOCKET_AUTH_PROTOCOL_PREFIX + base64url(credential)];
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
    protocolsFor(options.credential)
  );
}
