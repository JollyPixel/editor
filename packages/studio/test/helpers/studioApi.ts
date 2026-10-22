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
import {
  AssetServer,
  PackageResolver,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import {
  StudioApi,
  type StudioApiOptions
} from "../../server/api/StudioApi.ts";
import { AssetLog } from "../../server/audit/AssetLog.ts";
import { AuditFeed } from "../../server/audit/AuditFeed.ts";
import { AuditLog } from "../../server/audit/AuditLog.ts";
import { EditorPackages } from "../../server/editors/EditorPackages.ts";
import { ProjectArchive } from "../../server/project/ProjectArchive.ts";
import { ProjectSettings } from "../../server/project/ProjectSettings.ts";
import { StudioProject } from "../../server/project/StudioProject.ts";
import { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import { STUDIO_PREFERENCES } from "../../shared/studioScope.ts";
import { StudioAccess } from "../../server/project/StudioAccess.ts";
import { StudioShares } from "../../server/shares/StudioShares.ts";
import { sharedCatalog } from "./shares.ts";

// CONSTANTS
export const PASSED_ON_STATUS = 418;

export interface StudioApiServer extends AsyncDisposable {
  accounts: Accounts;
  shares: StudioShares;
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

export interface StudioApiAccountsOptions extends Omit<
  AccountsOpenOptions, "roles" | "location"
> {
  /**
   * @default "spectator"
   */
  defaultRole?: string;
  /**
   * Dependency closure of each asset the catalog holds.
   * @default {}
   */
  closures?: Record<string, string[]>;
}

export type StudioApiListenOptions = Omit<
  StudioApiOptions,
  "accounts" | "shares" | "archive" | "settings" | "audit" | "preferences"
> & {
  /**
   * @default new PreferenceScopes([STUDIO_PREFERENCES])
   */
  preferences?: PreferenceScopes;
};

export async function listenStudioApi(
  options: StudioApiAccountsOptions = {},
  apiOptions: StudioApiListenOptions = {}
): Promise<StudioApiServer> {
  const {
    defaultRole = "spectator",
    closures = {},
    ...accountsOptions
  } = options;
  const accounts = await Accounts.open({
    ...accountsOptions,
    roles: new AccountRoles({
      roles: [
        "member",
        "spectator"
      ],
      defaultRole
    })
  });
  const project = new StudioProject(
    new ProjectFile("project", { version: 1 }, { inMemory: true }),
    new EditorPackages([]),
    new ProjectKinds([], new PackageResolver("project")),
    StudioAccess.read({ version: 1 }, "project.json")
  );
  const shares = new StudioShares({
    accounts,
    project,
    catalog: Promise.resolve(sharedCatalog(closures))
  });
  const assetServer = await AssetServer.open({
    root: "project",
    inMemory: true
  });
  const audit = await AuditLog.open(null);
  const api = await StudioApi.open({
    preferences: new PreferenceScopes([STUDIO_PREFERENCES]),
    ...apiOptions,
    accounts,
    shares,
    archive: new ProjectArchive({
      project,
      backend: assetServer.backend,
      name: "project"
    }),
    audit: new AuditFeed({
      project,
      assets: new AssetLog(assetServer.eventStore),
      audit,
      account: (accountId) => accounts.account(accountId),
      assetPath: () => undefined
    }),
    settings: new ProjectSettings({
      project,
      accounts,
      server: assetServer.network,
      registry: assetServer.backend.kinds,
      audit
    })
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
    shares,
    url,
    accountsUrl,
    browser: () => browser(accountsUrl),
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
      await api[Symbol.asyncDispose]();
      await assetServer.close();
      audit[Symbol.dispose]();
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
