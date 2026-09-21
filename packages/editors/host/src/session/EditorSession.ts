// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  CATALOG_ROOM,
  CatalogClient
} from "@jolly-pixel/asset-server/catalog/client";
import * as network from "@jolly-pixel/network/client";
import {
  promptPeerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { EditorLaunch } from "../launch/EditorLaunch.ts";
import {
  AssetLeases,
  type RoomSource
} from "./AssetLeases.ts";
import type {
  AssetDependency,
  AssetLease,
  AssetModelKind,
  AssetRoomLease
} from "./AssetLease.ts";
import {
  CatalogSessionArchive,
  type SessionArchive
} from "./SessionArchive.ts";
import type { SessionWorkspace } from "./SessionWorkspace.ts";

// CONSTANTS
export const IDENTITY_STORAGE_KEY = "jolly-pixel:username";

export type EditorSessionEvents = {
  "dependency-added": (dependency: AssetDependency) => void;
  "dependency-removed": (reference: AssetReferenceData) => void;
};

export interface EditorSessionClient extends RoomSource {
  destroy(): void;
}

export interface EditorIdentityOptions {
  title: string;
}

export interface EditorSessionTarget {
  launch: EditorLaunch;
  accepts: string;
  kinds: Iterable<AssetModelKind<unknown>>;
}

export interface EditorSessionOptions extends EditorSessionTarget {
  identity: EditorIdentityOptions;
}

export interface EditorSessionConnectOptions extends EditorSessionTarget {
  identity: PeerIdentity;
  client: EditorSessionClient;
  workspace?: SessionWorkspace;
}

export interface EditorSessionParts extends EditorSessionConnectOptions {
  catalog: CatalogClient;
}

interface SessionDependency {
  readonly lease: AssetLease<unknown>;
  readonly view: AssetDependency;
}

export class EditorSession extends Emitter<EditorSessionEvents> {
  static async open(
    options: EditorSessionOptions
  ): Promise<EditorSession> {
    const identity = await promptPeerIdentity({
      title: options.identity.title,
      storageKey: IDENTITY_STORAGE_KEY
    });

    return EditorSession.connect({
      ...options,
      identity,
      client: new network.Client({
        profile: toPeerMetadata(identity)
      })
    });
  }

  static async connect(
    options: EditorSessionConnectOptions
  ): Promise<EditorSession> {
    const { client } = options;
    const catalog = new CatalogClient(client.room(CATALOG_ROOM));

    let session: EditorSession;
    try {
      await catalog.ready;
      session = new EditorSession({
        ...options,
        catalog
      });
    }
    catch (error) {
      catalog.dispose();
      client.destroy();

      throw error;
    }

    try {
      await Promise.all(
        Array.from(session.dependencies(), (lease) => lease.ready)
      );
    }
    catch (error) {
      session.dispose();

      throw error;
    }

    return session;
  }

  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly workspace: SessionWorkspace | null;
  readonly archive: SessionArchive;
  readonly assets: AssetLeases;
  readonly target: AssetRoomLease;

  #client: EditorSessionClient;
  #kinds = new Map<string, AssetModelKind<unknown>>();
  #dependencies = new Map<string, SessionDependency>();
  #disposed = false;

  readonly #onCatalogChange = (): void => {
    this.#syncDependencies();
  };

  constructor(
    options: EditorSessionParts
  ) {
    super();
    this.identity = options.identity;
    this.catalog = options.catalog;
    this.workspace = options.workspace ?? null;
    this.archive = new CatalogSessionArchive({
      catalog: this.catalog,
      canImport: this.workspace?.persistent ?? true
    });
    this.#client = options.client;
    for (const kind of options.kinds) {
      this.#kinds.set(kind.kind, kind);
    }

    this.assets = new AssetLeases({
      rooms: this.#client,
      records: this.catalog
    });
    try {
      this.target = this.assets.openRoom(
        options.accepts,
        options.launch.target.value
      );
      this.#syncDependencies();
    }
    catch (error) {
      this.assets.dispose();

      throw error;
    }
    this.catalog.on("change", this.#onCatalogChange);
    this.catalog.on("dependencies", this.#onCatalogChange);
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
    this.catalog.off("dependencies", this.#onCatalogChange);
    this.#dependencies.clear();
    this.assets.dispose();
    this.catalog.dispose();
    this.#client.destroy();
  }

  #syncDependencies(): void {
    if (this.#disposed) {
      return;
    }
    const wanted = new Map<string, AssetModelKind<unknown>>();
    for (const reference of this.catalog.closureOf(this.target.record.id)) {
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
        const { record, room, model, ready } = lease;
        added.set(assetId, {
          lease,
          view: Object.freeze({
            record,
            room,
            model,
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
