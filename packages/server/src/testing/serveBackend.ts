// Import Node.js Dependencies
import http from "node:http";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  StudioBackend,
  type StudioBackendOptions
} from "../server/node/StudioBackend.ts";
import type {
  GamePlayer,
  PlayerPageSource
} from "../game/node/GamePlayer.ts";
import { chainMiddleware } from "../http/node/Middleware.ts";
import { ManifestRoute } from "../project/node/ManifestRoute.ts";
import { NO_SHELL_PREFERENCES } from "../preferences/PreferenceScopes.ts";
import type { StudioProject } from "../project/node/StudioProject.ts";
import {
  browser,
  type Browser
} from "./browser.ts";

// CONSTANTS
export const PASSED_ON_STATUS = 418;
const kUnbuiltPlayer: GamePlayer & PlayerPageSource = {
  bundle: () => Promise.reject(new Error("a test backend builds no game")),
  html: () => Promise.reject(new Error("a test backend builds no player"))
};

export interface ServedBackend extends AsyncDisposable {
  url: URL;
  accountsUrl: URL;
  socketUrl: string;
  browser(): Browser;
}

export interface ServeBackendOptions extends Pick<
  StudioBackendOptions, "requestsPerMinute" | "trustProxy" | "compression"
> {
  /**
   * @default "member"
   */
  defaultRole?: string;
  masterPassword?: string;
  /**
   * @default false
   */
  accessRequests?: boolean;
  throttle?: NonNullable<StudioBackendOptions["accounts"]>["throttle"];
}

export interface ListenBackendOptions extends ServeBackendOptions, Pick<
  StudioBackendOptions, "seed"
> {
  /**
   * @default NO_SHELL_PREFERENCES
   */
  preferences?: StudioBackendOptions["preferences"];
}

export async function listenBackend(
  project: StudioProject,
  options: ListenBackendOptions
): Promise<ServedBackend> {
  if (options.accessRequests === true) {
    await project.file.replace({
      access: {
        ...project.access.toJSON(),
        accessRequests: true
      }
    });
  }
  const backend = await StudioBackend.open(project, {
    inMemory: true,
    seed: options.seed,
    player: kUnbuiltPlayer,
    playPage: kUnbuiltPlayer,
    preferences: options.preferences ?? NO_SHELL_PREFERENCES,
    requestsPerMinute: options.requestsPerMinute,
    trustProxy: options.trustProxy,
    compression: options.compression,
    accounts: {
      defaultRole: options.defaultRole ?? "member",
      throttle: options.throttle,
      masterPassword: options.masterPassword
    }
  });
  const routes = chainMiddleware(
    backend.middleware,
    new ManifestRoute(project).middleware
  );
  const server = http.createServer((request, response) => {
    routes(request, response, () => {
      response.statusCode = PASSED_ON_STATUS;
      response.end();
    });
  });
  backend.attach(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  const url = new URL(`http://127.0.0.1:${port}/`);
  const accountsUrl = new URL(`.${ACCOUNTS_URL_PATH}`, url);

  return {
    url,
    accountsUrl,
    socketUrl: `ws://127.0.0.1:${port}${DEFAULT_WEBSOCKET_PATH}`,
    browser: () => browser(accountsUrl),
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
      await backend[Symbol.asyncDispose]();
    }
  };
}
