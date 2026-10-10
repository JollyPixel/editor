// Import Node.js Dependencies
import http from "node:http";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import { parseSetCookie } from "cookie";
import {
  ACCOUNTS_URL_PATH,
  AccountsClient
} from "@jolly-pixel/accounts";
import {
  Accounts,
  AccountRoles,
  type AccountsOpenOptions
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  StudioApi,
  type StudioApiOptions
} from "../../server/api/StudioApi.ts";

// CONSTANTS
export const PASSED_ON_STATUS = 418;

export interface StudioApiServer extends AsyncDisposable {
  accounts: Accounts;
  url: URL;
  accountsUrl: URL;
  browser(): Browser;
}

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

export type StudioApiAccountsOptions = Omit<AccountsOpenOptions, "roles" | "location">;

export type StudioApiListenOptions = Omit<StudioApiOptions, "accounts">;

export async function listenStudioApi(
  options: StudioApiAccountsOptions = {},
  apiOptions: StudioApiListenOptions = {}
): Promise<StudioApiServer> {
  const accounts = await Accounts.open({
    ...options,
    roles: new AccountRoles({
      roles: [
        "member",
        "spectator"
      ],
      defaultRole: "spectator"
    })
  });
  const api = await StudioApi.open({
    ...apiOptions,
    accounts
  });
  const server = http.createServer((request, response) => {
    api.middleware(request, response, () => {
      response.statusCode = PASSED_ON_STATUS;
      response.end();
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;
  const url = new URL(`http://127.0.0.1:${port}/`);
  const accountsUrl = new URL(ACCOUNTS_URL_PATH, url);

  return {
    accounts,
    url,
    accountsUrl,
    browser: () => browser(accountsUrl),
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
      await api[Symbol.asyncDispose]();
      accounts[Symbol.dispose]();
    }
  };
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

function browser(
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
