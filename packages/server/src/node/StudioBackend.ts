// Import Node.js Dependencies
import type { Server as HttpServer } from "node:http";
import type { Http2SecureServer } from "node:http2";
import path from "node:path";

// Import Third-party Dependencies
import {
  CatalogViewExtension,
  MAX_CATALOG_MESSAGE_BYTES,
  type AssetSeedMap
} from "@jolly-pixel/asset-server";
import { AssetServer } from "@jolly-pixel/asset-server/node";
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import {
  ACCOUNTS_STATE_IGNORES,
  openStudioAccounts,
  type StudioAccountsOptions
} from "./accounts/openStudioAccounts.ts";
import {
  StudioApi,
  type TrustProxy
} from "./http/StudioApi.ts";
import type { Middleware } from "./http/Middleware.ts";
import { AssetLog } from "./audit/AssetLog.ts";
import {
  EditorPageFolders,
  type EditorPageSource
} from "./editors/EditorPageFolders.ts";
import { AuditFeed } from "./audit/AuditFeed.ts";
import {
  AUDIT_DATABASE_FILE,
  AUDIT_STATE_IGNORES,
  AuditLog
} from "./audit/AuditLog.ts";
import type { GamePlayer } from "./game/BuiltPlayer.ts";
import { GameExport } from "./game/GameExport.ts";
import { StudioGame } from "./game/StudioGame.ts";
import { AgentChatExtension } from "./golem/AgentChatExtension.ts";
import { ProjectArchive } from "./project/ProjectArchive.ts";
import { ProjectSettings } from "./project/ProjectSettings.ts";
import type { StudioProject } from "./project/StudioProject.ts";
import { SharePage } from "./shares/SharePage.ts";
import { StudioShares } from "./shares/StudioShares.ts";
import {
  PreferenceScopes,
  type ShellPreferences
} from "../preferences/PreferenceScopes.ts";

// CONSTANTS
const kRoomGraceMs = 5 * 60_000;
const kSocketCompression = {
  threshold: 1024
};
const kMaxBufferedBytes = MAX_CATALOG_MESSAGE_BYTES + 32 * 1024 * 1024;

export interface StudioBackendOptions {
  /**
   * Keeps the assets in memory instead of the project root.
   * @default false
   */
  inMemory?: boolean;
  accounts?: Omit<StudioAccountsOptions, "inMemory">;
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
  /**
   * Where `/view/<token>` reads each editor's page.
   * @default EditorPageFolders.packages()
   */
  editorPages?: EditorPageSource;
  /**
   * Deflates socket messages over 1 KiB, and content fetched over HTTP whose
   * kind compresses. It pays on slow links and costs time on loopback.
   * @default false
   */
  compression?: boolean;
  /**
   * The built player that game exports ship.
   */
  player: GamePlayer;
  /**
   * The preference scopes of the shell, which the preferences API accepts
   * besides the scopes of the project editors.
   */
  preferences: ShellPreferences;
  /**
   * Documents written when the project holds no file at their path.
   * @default {}
   */
  seed?: AssetSeedMap;
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
    options: StudioBackendOptions
  ): Promise<StudioBackend> {
    await using opening = new AsyncDisposableStack();
    const accounts = opening.use(await openStudioAccounts(project, {
      ...options.accounts,
      inMemory: options.inMemory
    }));
    const audit = opening.use(await AuditLog.open(
      options.inMemory ?
        null :
        path.join(project.file.root, STATE_DIRECTORY, AUDIT_DATABASE_FILE)
    ));
    opening.defer(accounts.watchActivity((activity) => {
      audit.recordAccount(activity).catch((error: unknown) => {
        console.error(error);
      });
    }));
    const compression = options.compression === true;
    const assetServer = await AssetServer.open({
      root: project.file.root,
      ignore: project.assetIgnores(),
      inMemory: options.inMemory,
      handlers: project.kinds.handlers(),
      seed: options.seed,
      roomGraceMs: kRoomGraceMs,
      rights: project.access.rights,
      defaultRole: accounts.roles.defaultRole,
      auth: accounts,
      extensions: [
        accounts.extension,
        new AgentChatExtension()
      ],
      backend: {
        stateIgnores: [
          ...ACCOUNTS_STATE_IGNORES,
          ...AUDIT_STATE_IGNORES
        ]
      },
      admits: (identity, room) => shares.admits(identity, room),
      content: {
        compression
      }
    });
    opening.defer(() => assetServer.close());
    const shares = new StudioShares({
      accounts,
      project,
      catalog: assetServer.backend.catalog
    });
    assetServer.network.register(new CatalogViewExtension({
      catalog: assetServer.backend.catalog,
      scope: (identity) => shares.scope(identity)
    }));

    const api = opening.use(await StudioApi.open({
      accounts,
      shares,
      settings: new ProjectSettings({
        project,
        accounts,
        server: assetServer.network,
        registry: assetServer.backend.kinds,
        audit,
        accountsPolicy: options.accounts
      }),
      audit: new AuditFeed({
        project,
        assets: new AssetLog(assetServer.eventStore),
        audit,
        account: (accountId) => accounts.account(accountId),
        agentToken: (subject) => accounts.agentTokens.bySubject(subject),
        assetPath: (assetId) => assetServer.backend.catalog.record(assetId)?.path.toString()
      }),
      archive: new ProjectArchive({
        project,
        backend: assetServer.backend
      }),
      game: new StudioGame({
        project,
        backend: assetServer.backend
      }),
      gameExport: new GameExport({
        project,
        backend: assetServer.backend,
        player: options.player
      }),
      preferences: new PreferenceScopes(
        options.preferences,
        project.editors.editorScopes()
      ),
      requestsPerMinute: options.requestsPerMinute,
      trustProxy: options.trustProxy
    }));

    return new StudioBackend(
      opening.move(),
      assetServer,
      compression,
      api,
      new SharePage({
        shares,
        editors: project.editors,
        pages: options.editorPages ?? EditorPageFolders.packages()
      })
    );
  }

  readonly middleware: Middleware;

  #resources: AsyncDisposableStack;
  #assetServer: AssetServer;
  #compression: boolean;
  #transports = new DisposableStack();

  private constructor(
    resources: AsyncDisposableStack,
    assetServer: AssetServer,
    compression: boolean,
    api: StudioApi,
    sharePage: SharePage
  ) {
    this.#resources = resources;
    this.#assetServer = assetServer;
    this.#compression = compression;
    this.middleware = (request, response, next) => {
      assetServer.contentHandler(request, response, () => {
        api.middleware(request, response, () => {
          sharePage.middleware(request, response, next);
        });
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
      server: this.#assetServer.network,
      compression: this.#compression ?
        kSocketCompression :
        undefined,
      maxPayload: MAX_CATALOG_MESSAGE_BYTES,
      maxBufferedBytes: kMaxBufferedBytes,
      allowedHosts: options.allowedHosts
    }));
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.#transports.dispose();
    await this.#resources.disposeAsync();
  }
}
