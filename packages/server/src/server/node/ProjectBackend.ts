// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";
import path from "node:path";
import type { Duplex } from "node:stream";

// Import Third-party Dependencies
import {
  CatalogViewExtension,
  MAX_CATALOG_MESSAGE_BYTES,
  type AssetSeedMap
} from "@jolly-pixel/asset-server";
import { AssetServer } from "@jolly-pixel/asset-server/node";
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";
import type {
  Accounts,
  AccountsRealm
} from "@jolly-pixel/accounts/node";
import type { Server } from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import type { AccountsPolicy } from "../../accounts/node/AccountsAccess.ts";
import {
  ACCOUNTS_STATE_IGNORES,
  openProjectRealm
} from "../../accounts/node/openServerAccounts.ts";
import { AssetLog } from "../../audit/node/AssetLog.ts";
import { AuditFeed } from "../../audit/node/AuditFeed.ts";
import {
  AUDIT_DATABASE_FILE,
  AUDIT_STATE_IGNORES,
  AuditLog
} from "../../audit/node/AuditLog.ts";
import {
  EditorPageFolders,
  type EditorPageSource
} from "../../editors/node/EditorPageFolders.ts";
import type {
  GamePlayer,
  PlayerPageSource
} from "../../game/GamePlayer.ts";
import { GameExport } from "../../game/node/GameExport.ts";
import { PlayPage } from "../../game/node/PlayPage.ts";
import { ProjectGame } from "../../game/node/ProjectGame.ts";
import { AgentChatExtension } from "../../golem/node/AgentChatExtension.ts";
import {
  chainMiddleware,
  type Middleware
} from "../../http/node/Middleware.ts";
import {
  PreferenceScopes,
  type ShellPreferences
} from "../../preferences/PreferenceScopes.ts";
import { StoredPreferences } from "../../preferences/node/StoredPreferences.ts";
import { ManifestRoute } from "../../project/node/ManifestRoute.ts";
import type { Project } from "../../project/node/Project.ts";
import { ProjectArchive } from "../../project/node/ProjectArchive.ts";
import { ProjectSettings } from "../../project/node/ProjectSettings.ts";
import { ProjectShares } from "../../shares/node/ProjectShares.ts";
import { SharePage } from "../../shares/node/SharePage.ts";

// CONSTANTS
const kRoomGraceMs = 5 * 60_000;
const kSocketCompression = {
  threshold: 1024
};
const kMaxBufferedBytes = MAX_CATALOG_MESSAGE_BYTES + 32 * 1024 * 1024;

export interface ProjectBackendOptions {
  accounts: Accounts;
  accountsPolicy?: AccountsPolicy;
  /**
   * Keeps the assets in memory instead of the project root.
   * @default false
   */
  inMemory?: boolean;
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
   * Host header values accepted on the WebSocket upgrade, besides localhost
   * and IP addresses.
   * @default []
   */
  allowedHosts?: readonly string[] | true;
  player: GamePlayer;
  playPage: PlayerPageSource;
  preferences: ShellPreferences;
  /**
   * @default {}
   */
  seed?: AssetSeedMap;
}

interface ProjectBackendParts {
  project: Project;
  realm: AccountsRealm;
  network: Server;
  transport: WebsocketTransport;
  shares: ProjectShares;
  settings: ProjectSettings;
  audit: AuditFeed;
  archive: ProjectArchive;
  game: ProjectGame;
  gameExport: GameExport;
  preferences: StoredPreferences;
  middleware: Middleware;
  resources: AsyncDisposableStack;
}

export class ProjectBackend implements AsyncDisposable {
  static async open(
    project: Project,
    options: ProjectBackendOptions
  ): Promise<ProjectBackend> {
    const { accounts } = options;
    await using opening = new AsyncDisposableStack();
    const realm = opening.use(
      openProjectRealm(accounts, project, options.accountsPolicy)
    );
    const audit = opening.use(await AuditLog.open(
      options.inMemory ?
        null :
        path.join(project.file.root, STATE_DIRECTORY, AUDIT_DATABASE_FILE)
    ));
    opening.defer(realm.watchActivity((activity) => {
      audit.recordAccount(activity).catch((error: unknown) => {
        console.error(error);
      });
    }));
    const assetServer = await AssetServer.open({
      root: project.file.root,
      ignore: project.assetIgnores(),
      inMemory: options.inMemory,
      handlers: project.kinds.handlers(),
      seed: options.seed,
      roomGraceMs: kRoomGraceMs,
      rights: project.access.rights,
      defaultRole: realm.roles.defaultRole,
      auth: realm,
      extensions: [
        realm.extension,
        new AgentChatExtension()
      ],
      backend: {
        snapshot: project.snapshot,
        stateIgnores: [
          ...ACCOUNTS_STATE_IGNORES,
          ...AUDIT_STATE_IGNORES
        ]
      },
      admits: (identity, room) => shares.admits(identity, room),
      content: {
        compression: options.compression === true
      }
    });
    opening.defer(() => assetServer.close());
    const { backend, network } = assetServer;
    const transport = opening.use(new WebsocketTransport({
      server: network,
      compression: options.compression === true ?
        kSocketCompression :
        undefined,
      maxPayload: MAX_CATALOG_MESSAGE_BYTES,
      maxBufferedBytes: kMaxBufferedBytes,
      allowedHosts: options.allowedHosts
    }));
    const shares = new ProjectShares({
      realm,
      project,
      catalog: backend.catalog
    });
    network.register(new CatalogViewExtension({
      catalog: backend.catalog,
      scope: (identity) => shares.scope(identity)
    }));
    const game = new ProjectGame({
      project,
      backend
    });

    const sharePage = new SharePage({
      shares,
      editors: project.editors,
      pages: options.editorPages ?? EditorPageFolders.packages()
    });
    const playPage = new PlayPage({
      page: options.playPage,
      game,
      realm
    });

    return new ProjectBackend({
      project,
      realm,
      network,
      transport,
      shares,
      game,
      settings: new ProjectSettings({
        project,
        realm,
        server: network,
        backend,
        audit,
        accountsPolicy: options.accountsPolicy
      }),
      audit: new AuditFeed({
        project,
        assets: new AssetLog(assetServer.eventStore),
        audit,
        account: (accountId) => accounts.account(accountId),
        agentToken: (subject) => realm.agentTokens.bySubject(subject),
        assetPath: (assetId) => backend.catalog.record(assetId)?.path.toString()
      }),
      archive: new ProjectArchive({
        project,
        backend
      }),
      gameExport: new GameExport({
        project,
        backend,
        player: options.player
      }),
      preferences: new StoredPreferences(
        accounts,
        new PreferenceScopes(
          options.preferences,
          project.editors.editorScopes()
        )
      ),
      middleware: chainMiddleware(
        assetServer.contentHandler,
        new ManifestRoute(project).middleware,
        sharePage.middleware,
        playPage.middleware
      ),
      resources: opening.move()
    });
  }

  readonly project: Project;
  readonly realm: AccountsRealm;
  readonly network: Server;
  readonly shares: ProjectShares;
  readonly settings: ProjectSettings;
  readonly audit: AuditFeed;
  readonly archive: ProjectArchive;
  readonly game: ProjectGame;
  readonly gameExport: GameExport;
  readonly preferences: StoredPreferences;
  readonly middleware: Middleware;

  #transport: WebsocketTransport;
  #resources: AsyncDisposableStack;

  private constructor(
    parts: ProjectBackendParts
  ) {
    this.project = parts.project;
    this.realm = parts.realm;
    this.network = parts.network;
    this.shares = parts.shares;
    this.settings = parts.settings;
    this.audit = parts.audit;
    this.archive = parts.archive;
    this.game = parts.game;
    this.gameExport = parts.gameExport;
    this.preferences = parts.preferences;
    this.middleware = parts.middleware;
    this.#transport = parts.transport;
    this.#resources = parts.resources;
  }

  handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): void {
    this.#transport.handleUpgrade(request, socket, head);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#resources.disposeAsync();
  }
}
