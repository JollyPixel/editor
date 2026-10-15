// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import { Systems } from "@jolly-pixel/engine";
import * as network from "@jolly-pixel/network/client";
import {
  promptPeerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type { ShellChannel } from "../launch/index.ts";
import {
  AssetLeases,
  type RoomSource
} from "../lease/AssetLeases.ts";
import { PendingOutboxes } from "../lease/PendingOutboxes.ts";
import {
  ConnectionStatus,
  type ServerConnection
} from "./ConnectionStatus.ts";
import type { SessionWorkspace } from "../workspace/SessionWorkspace.ts";
import {
  EditorSession,
  type EditorSessionTarget
} from "./EditorSession.ts";
import {
  CATALOG_TIMEOUT_MS,
  openCatalog,
  type CatalogOpener
} from "./openCatalog.ts";
import {
  CatalogSessionArchive,
  type SessionArchive
} from "./SessionArchive.ts";

// CONSTANTS
export const IDENTITY_STORAGE_KEY = "jolly-pixel:username";

export interface EditorSessionClient extends RoomSource {
  destroy(): void;
}

export interface EditorIdentityOptions {
  title: string;
}

interface SessionConnectionBase {
  /**
   * @default a logger with every namespace disabled
   */
  logger?: HostLogger;
}

export interface SessionConnectionOpenOptions extends SessionConnectionBase {
  identity: EditorIdentityOptions;
  /**
   * @default null
   */
  shell?: ShellChannel | null;
  /**
   * @default joins the catalog room on the connection client
   */
  openCatalog?: CatalogOpener;
}

export interface SessionConnectionConnectOptions extends SessionConnectionBase {
  identity: PeerIdentity;
  client: EditorSessionClient;
  /**
   * @default joins the catalog room on `client`
   */
  openCatalog?: CatalogOpener;
  workspace?: SessionWorkspace;
  catalogTimeoutMs?: number;
  /**
   * The client again, when it connects straight to the server: the toolbar
   * shows when it drops, and pending changes are kept across page loads.
   * @default null
   */
  server?: ServerConnection | null;
}

export interface SessionConnectionOptions {
  identity: PeerIdentity;
  catalog: CatalogClient;
  client: EditorSessionClient;
  workspace?: SessionWorkspace;
  /**
   * @default null
   */
  server?: ServerConnection | null;
  /**
   * @default null
   */
  outboxes?: PendingOutboxes | null;
}

export class SessionConnection {
  static async open(
    options: SessionConnectionOpenOptions
  ): Promise<SessionConnection> {
    const {
      shell = null,
      logger = new Systems.Logger()
    } = options;
    const identity = shell?.identity ?? await logger.step(
      "identity",
      () => promptPeerIdentity({
        title: options.identity.title,
        storageKey: IDENTITY_STORAGE_KEY
      })
    );
    const client = new network.Client({
      profile: toPeerProfileMetadata(identity)
    });
    shell?.renewWhenRefused(client);

    return SessionConnection.connect({
      identity,
      client,
      logger,
      openCatalog: options.openCatalog,
      catalogTimeoutMs: CATALOG_TIMEOUT_MS,
      server: client
    });
  }

  static async connect(
    options: SessionConnectionConnectOptions
  ): Promise<SessionConnection> {
    const {
      client,
      server = null,
      logger = new Systems.Logger()
    } = options;
    const catalog = await logger.step(
      "catalog",
      () => openCatalog(
        client,
        options.catalogTimeoutMs,
        options.openCatalog
      )
    );

    return new SessionConnection({
      identity: options.identity,
      catalog,
      client,
      workspace: options.workspace,
      server,
      outboxes: server === null ? null : await PendingOutboxes.open()
    });
  }

  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly workspace: SessionWorkspace | null;
  readonly archive: SessionArchive;
  readonly assets: AssetLeases;
  readonly connectionStatus: ConnectionStatus | null;

  readonly #client: EditorSessionClient;
  readonly #outboxes: PendingOutboxes | null;
  #disposed = false;

  constructor(
    options: SessionConnectionOptions
  ) {
    this.identity = options.identity;
    this.catalog = options.catalog;
    this.workspace = options.workspace ?? null;
    this.archive = new CatalogSessionArchive({
      catalog: this.catalog,
      canImport: this.workspace?.persistent ?? true
    });
    this.#client = options.client;
    this.#outboxes = options.outboxes ?? null;
    this.assets = new AssetLeases({
      rooms: this.#client,
      records: this.catalog,
      outboxes: this.#outboxes
    });
    const { server = null } = options;
    this.connectionStatus = server === null ?
      null :
      new ConnectionStatus({
        client: server,
        changes: this.assets
      });
  }

  async openSession(
    target: EditorSessionTarget
  ): Promise<EditorSession> {
    const {
      logger = new Systems.Logger()
    } = target;
    const session = new EditorSession({
      ...target,
      connection: this
    });
    try {
      await Promise.all([
        logger.step(
          "target",
          () => session.targetReady,
          toTraceMeta(session.target.record)
        ),
        ...Array.from(
          session.dependencies(),
          (dependency) => logger.step(
            "dependency",
            () => dependency.ready,
            toTraceMeta(dependency.record)
          )
        )
      ]);
    }
    catch (error) {
      session.dispose();

      throw error;
    }

    return session;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.connectionStatus?.dispose();
    this.assets.dispose();
    this.catalog.dispose();
    this.#client.destroy();
    void this.#outboxes?.close();
  }
}

function toTraceMeta(
  reference: AssetReferenceData
): Record<string, unknown> {
  return {
    kind: reference.kind,
    id: reference.id
  };
}
