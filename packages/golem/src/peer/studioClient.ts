// Import Node.js Dependencies
import { Console } from "node:console";

// Import Third-party Dependencies
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { GolemTarget } from "./GolemConnectOptions.ts";
import { GolemDisconnectedError } from "./errors/GolemDisconnectedError.ts";
import { GolemTokenRefusedError } from "./errors/GolemTokenRefusedError.ts";

export interface StudioClient {
  client: network.Client;
  revoked: AbortSignal;
}

export function studioClient(
  target: GolemTarget
): StudioClient {
  const client = new network.Client({
    logger: network.consoleLogger(new Console({
      stdout: process.stderr
    })),
    socket: () => network.connectWebSocket({
      url: studioSocketUrl(target.url),
      credential: target.token
    })
  });
  const revoked = new AbortController();
  client.on("unauthorized", (reason) => {
    revoked.abort(
      reason === network.DISCONNECTED_CLOSE_REASON ?
        new GolemDisconnectedError() :
        new GolemTokenRefusedError()
    );
  });

  return {
    client,
    revoked: revoked.signal
  };
}

function studioSocketUrl(
  studioUrl: URL
): string {
  const url = new URL(`.${DEFAULT_WEBSOCKET_PATH}`, studioUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.href;
}
