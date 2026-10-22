// Import Node.js Dependencies
import http from "node:http";

// Import Third-party Dependencies
import { parseSetCookie } from "cookie";
import { AccountsClient } from "@jolly-pixel/accounts";

export interface Browser {
  client: AccountsClient;
  cookies: Map<string, string>;
  fetch: typeof fetch;
}

export interface RawRequest {
  method: string;
  headers?: Record<string, string>;
  body: string | Uint8Array;
}

export function requestStatus(
  url: URL,
  options: RawRequest
): Promise<number | undefined> {
  const { promise, resolve, reject } = Promise.withResolvers<number | undefined>();
  const request = http.request(url, {
    method: options.method,
    headers: options.headers
  }, (response) => {
    response.resume();
    resolve(response.statusCode);
  });
  request.on("error", reject);
  request.write(options.body);
  request.end();

  return promise;
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
