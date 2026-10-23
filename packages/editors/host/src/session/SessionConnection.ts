// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import { Systems } from "@jolly-pixel/engine";
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import { AssetLeases } from "../lease/AssetLeases.ts";
import type { PendingOutboxes } from "../lease/outbox/PendingOutboxes.ts";
import {
  ConnectionStatus,
  type ServerConnection
} from "../connection/ConnectionStatus.ts";
import type { OfflineMode } from "../connection/OfflineMode.ts";
import type {
  EditorSessionClient,
  StandaloneConnection
} from "../connection/StandaloneConnection.ts";
import {
  EditorSession,
  type EditorSessionTarget
} from "./EditorSession.ts";
import {
  CATALOG_TIMEOUT_MS,
  openCatalog
} from "../connection/openCatalog.ts";
import {
  CatalogSessionArchive,
  type SessionArchive
} from "./SessionArchive.ts";

export interface SessionConnectionConnectOptions extends StandaloneConnection {
  /**
   * @default a logger with every namespace disabled
   */
  logger?: HostLogger;
}

export interface SessionConnectionOptions {
  identity: PeerIdentity;
  catalog: CatalogClient;
  client: EditorSessionClient;
  offline?: OfflineMode;
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
        server === null ? undefined : CATALOG_TIMEOUT_MS,
        options.openCatalog
      )
    );

    return new SessionConnection({
      identity: options.identity,
      catalog,
      client,
      offline: options.offline,
      server,
      outboxes: await options.openOutboxes?.() ?? null
    });
  }

  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly offline: OfflineMode | null;
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
    this.offline = options.offline ?? null;
    this.archive = new CatalogSessionArchive({
      catalog: this.catalog,
      canImport: this.offline?.persistent ?? true
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
