// Import Node.js Dependencies
import fs from "node:fs/promises";
import type {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse
} from "node:http";
import type { Http2SecureServer } from "node:http2";
import path from "node:path";

// Import Third-party Dependencies
import {
  CatalogViewExtension,
  type CatalogProjection
} from "@jolly-pixel/asset-server";
import {
  createAssetWorkspace,
  type AssetWorkspace
} from "@jolly-pixel/asset-server/node";
import type { Accounts } from "@jolly-pixel/accounts/node";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import {
  ACCOUNTS_STATE_IGNORES,
  openStudioAccounts,
  type StudioAccountsOptions
} from "./accounts.ts";
import {
  StudioApi,
  type TrustProxy
} from "./api/StudioApi.ts";
import { ProjectArchive } from "./project/ProjectArchive.ts";
import type { StudioProject } from "./project/StudioProject.ts";
import { SharePage } from "./shares/SharePage.ts";
import { StudioShares } from "./shares/StudioShares.ts";
import { createStudioSeed } from "../src/seed.ts";

// CONSTANTS
const kBlocksetFile = path.join(
  import.meta.dirname,
  "..",
  "public",
  "textures",
  "blockset.png"
);
const kRoomGraceMs = 5 * 60_000;

export type StudioBackendMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface StudioBackendOptions {
  /**
   * Keeps the assets in memory instead of the project root.
   * @default false
   */
  inMemory?: boolean;
  accounts?: StudioAccountsOptions;
  /**
   * @default 300
   */
  requestsPerMinute?: number;
  /**
   * Proxies whose `X-Forwarded-For` and `X-Forwarded-Proto` the API believes:
   * `true` for any, or addresses and CIDR ranges.
   * @default false
   */
  trustProxy?: TrustProxy;
}

export interface StudioBackendAttachOptions {
  /**
   * Host header values accepted on the WebSocket upgrade.
   * @default []
   */
  allowedHosts?: readonly string[] | true;
}

export class StudioBackend implements AsyncDisposable {
  static async open(
    project: StudioProject,
    options: StudioBackendOptions = {}
  ): Promise<StudioBackend> {
    const accounts = await openStudioAccounts(project, options.accounts);
    const catalog = Promise.withResolvers<CatalogProjection>();
    const shares = new StudioShares({
      accounts,
      access: project.access,
      catalog: catalog.promise
    });

    const workspace = await createAssetWorkspace({
      root: project.file.root,
      inMemory: options.inMemory,
      handlers: project.kinds.handlers(),
      seed: await createStudioSeed(
        await fs.readFile(kBlocksetFile)
      ),
      roomGraceMs: kRoomGraceMs,
      rights: project.access.rights,
      defaultRole: accounts.roles.defaultRole,
      auth: accounts,
      extensions: [accounts.extension],
      backend: {
        stateIgnores: ACCOUNTS_STATE_IGNORES
      },
      admits: (identity, room) => shares.admits(identity, room)
    });
    catalog.resolve(workspace.backend.catalog);
    workspace.server.register(new CatalogViewExtension({
      catalog: workspace.backend.catalog,
      scope: (identity) => shares.scope(identity)
    }));

    const api = await StudioApi.open({
      accounts,
      shares,
      archive: new ProjectArchive({
        access: project.access,
        backend: workspace.backend,
        name: path.basename(project.file.root)
      }),
      requestsPerMinute: options.requestsPerMinute,
      trustProxy: options.trustProxy
    });

    return new StudioBackend(
      accounts,
      workspace,
      api,
      new SharePage({
        shares,
        editors: project.editors
      })
    );
  }

  readonly middleware: StudioBackendMiddleware;

  #accounts: Accounts;
  #workspace: AssetWorkspace;
  #api: StudioApi;
  #transports = new DisposableStack();

  private constructor(
    accounts: Accounts,
    workspace: AssetWorkspace,
    api: StudioApi,
    sharePage: SharePage
  ) {
    this.#accounts = accounts;
    this.#workspace = workspace;
    this.#api = api;
    this.middleware = (request, response, next) => {
      api.middleware(request, response, () => {
        sharePage.middleware(request, response, next);
      });
    };
  }

  attach(
    httpServer: HttpServer | Http2SecureServer,
    options: StudioBackendAttachOptions = {}
  ): void {
    this.#transports.use(new WebsocketTransport({
      path: DEFAULT_WEBSOCKET_PATH,
      httpServer,
      server: this.#workspace.server,
      allowedHosts: options.allowedHosts
    }));
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.#transports.dispose();
    await this.#api[Symbol.asyncDispose]();
    await this.#workspace.close();
    this.#accounts[Symbol.dispose]();
  }
}
