// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type { EditorLaunch } from "../launch/index.ts";
import type { AssetLeases } from "../lease/AssetLeases.ts";
import type {
  AssetDependency,
  AssetLease,
  AssetDocumentKind,
  AssetRoomLease
} from "../lease/AssetLease.ts";
import type { ConnectionStatus } from "../connection/ConnectionStatus.ts";
import type { SessionArchive } from "./SessionArchive.ts";
import type { SessionConnection } from "./SessionConnection.ts";
import type { OfflineMode } from "../connection/OfflineMode.ts";

export type EditorSessionEvents = {
  "dependency-added": (dependency: AssetDependency) => void;
  "dependency-removed": (reference: AssetReferenceData) => void;
};

export interface EditorSessionTarget {
  launch: EditorLaunch;
  accepts: string;
  kinds: Iterable<AssetDocumentKind<unknown>>;
  /**
   * @default a logger with every namespace disabled
   */
  logger?: HostLogger;
}

export interface EditorSessionParts extends Omit<EditorSessionTarget, "logger"> {
  connection: SessionConnection;
}

interface SessionDependency {
  readonly lease: AssetLease<unknown>;
  readonly view: AssetDependency;
}

export class EditorSession extends Emitter<EditorSessionEvents> {
  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly offline: OfflineMode | null;
  readonly archive: SessionArchive;
  readonly assets: AssetLeases;
  readonly connectionStatus: ConnectionStatus | null;
  readonly tag: string | null;
  readonly target: AssetRoomLease;
  readonly targetReady: Promise<void>;

  readonly #kinds = new Map<string, AssetDocumentKind<unknown>>();
  readonly #held: AssetRoomLease[] = [];
  #dependencies = new Map<string, SessionDependency>();
  #disposed = false;

  readonly #onCatalogChange = (): void => {
    this.#syncDependencies();
  };

  constructor(
    options: EditorSessionParts
  ) {
    super();

    const { launch, connection } = options;
    this.identity = connection.identity;
    this.catalog = connection.catalog;
    this.offline = connection.offline;
    this.archive = connection.archive;
    this.assets = connection.assets;
    this.connectionStatus = connection.connectionStatus;
    this.tag = launch.tag;
    for (const kind of options.kinds) {
      this.#kinds.set(kind.kind, kind);
    }

    const assetId = launch.target.value;
    let target: AssetRoomLease | null = null;
    try {
      const kind = this.#kinds.get(options.accepts);
      if (kind === undefined) {
        target = this.assets.openRoom(
          options.accepts,
          assetId,
          this.tag
        );
        this.targetReady = Promise.resolve();
      }
      else {
        const lease = this.assets.open(kind, assetId, this.tag);
        target = lease;
        this.targetReady = lease.ready;
      }
      this.target = target;
      this.#syncDependencies();
    }
    catch (error) {
      target?.release();

      throw error;
    }

    this.catalog.on("change", this.#onCatalogChange);
  }

  get targetRecord(): AssetRecordData {
    return this.catalog.record(this.target.record.id) ?? this.target.record;
  }

  targetLease<TDocument, TCommand, TMessage>(
    kind: AssetDocumentKind<TDocument, TCommand, TMessage>
  ): AssetLease<TDocument, TCommand, TMessage> {
    return this.#hold(() => this.assets.open(
      kind,
      this.target.record.id,
      this.tag
    ));
  }

  lease<TDocument, TCommand, TMessage>(
    kind: AssetDocumentKind<TDocument, TCommand, TMessage>,
    assetId: string
  ): AssetLease<TDocument, TCommand, TMessage> {
    return this.#hold(() => this.assets.open(kind, assetId));
  }

  * dependencies(): IterableIterator<AssetDependency> {
    for (const { view } of this.#dependencies.values()) {
      yield view;
    }
  }

  dependency(
    assetId: string
  ): AssetDependency | undefined {
    return this.#dependencies.get(assetId)?.view;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.catalog.off("change", this.#onCatalogChange);
    for (const { lease } of this.#dependencies.values()) {
      lease.release();
    }
    this.#dependencies.clear();
    for (const lease of this.#held.splice(0)) {
      lease.release();
    }
    this.target.release();
  }

  #hold<TLease extends AssetRoomLease>(
    open: () => TLease
  ): TLease {
    if (this.#disposed) {
      throw new Error("The editor session was disposed.");
    }

    const lease = open();
    this.#held.push(lease);

    return lease;
  }

  #syncDependencies(): void {
    if (this.#disposed) {
      return;
    }

    const wanted = new Map<string, AssetDocumentKind<unknown>>();
    const { dependencies } = this.catalog;
    for (const reference of dependencies.transitiveDependencies(this.target.record.id)) {
      const record = this.catalog.record(reference.id);
      const kind = this.#kinds.get(reference.kind);
      if (record?.kind === reference.kind && kind !== undefined) {
        wanted.set(reference.id, kind);
      }
    }

    const added = new Map<string, SessionDependency>();
    try {
      for (const [assetId, kind] of wanted) {
        if (this.#dependencies.has(assetId)) {
          continue;
        }
        const lease = this.assets.open(kind, assetId);
        const { record, room, document, ready } = lease;
        added.set(assetId, {
          lease,
          view: Object.freeze({
            record,
            room,
            document,
            ready
          })
        });
      }
    }
    catch (error) {
      for (const { lease } of added.values()) {
        lease.release();
      }

      throw error;
    }

    const removed: AssetReferenceData[] = [];
    for (const [assetId, { lease }] of this.#dependencies) {
      if (!wanted.has(assetId)) {
        this.#dependencies.delete(assetId);
        lease.release();
        removed.push({
          id: assetId,
          kind: lease.record.kind
        });
      }
    }

    for (const [assetId, dependency] of added) {
      this.#dependencies.set(assetId, dependency);
    }

    for (const reference of removed) {
      if (this.#disposed) {
        return;
      }
      this.emit("dependency-removed", reference);
    }

    for (const [assetId, dependency] of added) {
      if (this.#disposed) {
        return;
      }
      if (this.#dependencies.get(assetId) === dependency) {
        this.emit("dependency-added", dependency.view);
      }
    }
  }
}
