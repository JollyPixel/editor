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
} from "../../server/StudioBackend.ts";
import { MASTER_PASSWORD_ENV } from "../../server/AccountsAccess.ts";
import { StudioAccess } from "../../server/project/StudioAccess.ts";
import {
  STUDIO_ROOT,
  StudioProject
} from "../../server/project/StudioProject.ts";
import {
  browser,
  type Browser
} from "./browser.ts";

// CONSTANTS
export const PASSED_ON_STATUS = 418;

export interface ServedBackend extends AsyncDisposable {
  url: URL;
  accountsUrl: URL;
  socketUrl: string;
  browser(): Browser;
}

export interface ServeBackendOptions extends Pick<
  StudioBackendOptions, "requestsPerMinute" | "trustProxy"
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

export async function serveBackend(
  options: ServeBackendOptions = {}
): Promise<ServedBackend> {
  const project = await StudioProject.open(
    StudioProject.resolveRoot(STUDIO_ROOT, {}),
    {
      inMemory: true
    }
  );
  if (options.accessRequests === true) {
    project.replaceAccess(StudioAccess.from({
      ...project.access.toJSON(),
      accessRequests: true
    }, "project.json"));
  }
  const backend = await StudioBackend.open(project, {
    inMemory: true,
    requestsPerMinute: options.requestsPerMinute,
    trustProxy: options.trustProxy,
    accounts: {
      defaultRole: options.defaultRole ?? "member",
      throttle: options.throttle,
      env: {
        [MASTER_PASSWORD_ENV]: options.masterPassword
      }
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
