// Import Node.js Dependencies
import http from "node:http";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import {
  ACCOUNTS_URL_PATH,
  type JoinMode
} from "@jolly-pixel/accounts";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  ServerBackend,
  type ServerBackendOptions
} from "../server/node/ServerBackend.ts";
import type {
  GamePlayer,
  PlayerPageSource
} from "../game/node/GamePlayer.ts";
import { NO_SHELL_PREFERENCES } from "../preferences/PreferenceScopes.ts";
import type { Project } from "../project/node/Project.ts";
import { ProjectHosting } from "../projects/node/ProjectHosting.ts";
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
  ServerBackendOptions, "requestsPerMinute" | "trustProxy" | "compression"
> {
  /**
   * @default "member"
   */
  defaultRole?: string;
  masterPassword?: string;
  /**
   * @default "open"
   */
  join?: JoinMode;
  throttle?: NonNullable<ServerBackendOptions["accounts"]>["throttle"];
}

export interface ListenBackendOptions extends ServeBackendOptions, Pick<
  ServerBackendOptions, "seed"
> {
  /**
   * @default NO_SHELL_PREFERENCES
   */
  preferences?: ServerBackendOptions["preferences"];
}

export async function listenBackend(
  project: Project,
  options: ListenBackendOptions
): Promise<ServedBackend> {
  const { join = "open" } = options;
  if (project.access.join !== join) {
    await project.file.replace({
      access: {
        ...project.access.toJSON(),
        join
      }
    });
  }
  const backend = await ServerBackend.open({
    hosting: ProjectHosting.single(project.file.root),
    openProject: async() => project,
    inMemory: true,
    seed: options.seed,
    player: kUnbuiltPlayer,
    playPage: kUnbuiltPlayer,
    preferences: options.preferences ?? NO_SHELL_PREFERENCES,
    requestsPerMinute: options.requestsPerMinute,
    trustProxy: options.trustProxy,
    compression: options.compression,
    accountsPolicy: {
      defaultRole: options.defaultRole ?? "member"
    },
    accounts: {
      throttle: options.throttle,
      masterPassword: options.masterPassword
    }
  });
  const server = http.createServer((request, response) => {
    backend.middleware(request, response, () => {
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
