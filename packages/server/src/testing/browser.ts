// Import Third-party Dependencies
import { parseSetCookie } from "cookie";
import { AccountsClient } from "@jolly-pixel/accounts";
import { WEBSOCKET_PROTOCOL } from "@jolly-pixel/network";
import type { ClientSocket } from "@jolly-pixel/network/client";

export interface Browser {
  client: AccountsClient;
  cookies: Map<string, string>;
  fetch: typeof fetch;
}

export function browser(
  url: URL
): Browser {
  const cookies = new Map<string, string>();
  async function jarFetch(
    input: string | URL | Request,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (cookies.size > 0) {
      headers.set(
        "cookie",
        Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ")
      );
    }
    const response = await fetch(input, {
      ...init,
      headers
    });
    for (const header of response.headers.getSetCookie()) {
      const cookie = parseSetCookie(header);
      if (cookie.value === undefined || cookie.value === "" || cookie.maxAge === 0) {
        cookies.delete(cookie.name);
      }
      else {
        cookies.set(cookie.name, cookie.value);
      }
    }

    return response;
  }

  return {
    client: new AccountsClient({
      url,
      fetch: jarFetch
    }),
    cookies,
    fetch: jarFetch
  };
}

type CookieWebSocket = new (
  url: string,
  init: {
    protocols: string[];
    headers: Record<string, string>;
  }
) => WebSocket;

export function signedInSocket(
  url: string,
  account: Browser
): ClientSocket {
  const NodeWebSocket = WebSocket as unknown as CookieWebSocket;
  const socket = new NodeWebSocket(url, {
    protocols: [WEBSOCKET_PROTOCOL],
    headers: {
      cookie: Array.from(
        account.cookies,
        ([name, value]) => `${name}=${value}`
      ).join("; ")
    }
  });
  socket.binaryType = "arraybuffer";

  return socket;
}
