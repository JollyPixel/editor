// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  AssetKindMismatchError,
  AssetNotFoundError,
  type AssetRecordData,
  type AssetReferenceData
} from "@jolly-pixel/asset";
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
  AssetLease,
  AssetModelKind,
  AssetRoomLease
} from "./AssetLease.ts";

// CONSTANTS
export const IDENTITY_STORAGE_KEY = "jolly-pixel:username";

export type EditorSessionEvents = {
  "dependency-added": (lease: AssetLease<unknown>) => void;
  "dependency-removed": (reference: AssetReferenceData) => void;
};

export interface EditorSessionClient extends RoomSource {
  destroy(): void;
}

export interface EditorIdentityOptions {
  title: string;
}

export interface EditorSessionConnectOptions {
  launch: EditorLaunch;
  identity: PeerIdentity;
  client: EditorSessionClient;
  kinds: Iterable<AssetModelKind<unknown>>;
  accepts?: string;
}

export interface EditorSessionOptions
  extends Omit<EditorSessionConnectOptions, "identity" | "client"> {
  identity: EditorIdentityOptions;
}

export interface EditorSessionParts {
  identity: PeerIdentity;
  client: EditorSessionClient;
  catalog: CatalogClient;
  kinds: Iterable<AssetModelKind<unknown>>;
  target: AssetRecordData;
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

    let target: AssetRecordData;
    try {
      await catalog.ready;
      target = EditorSession.#resolveTarget(catalog, options);
    }
    catch (error) {
      catalog.dispose();
      client.destroy();

      throw error;
    }

    const session = new EditorSession({
      identity: options.identity,
      client,
      catalog,
      kinds: options.kinds,
      target
    });
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

  static #resolveTarget(
    catalog: CatalogClient,
    options: EditorSessionConnectOptions
  ): AssetRecordData {
    const { launch, accepts } = options;
    const record = catalog.record(launch.target.value);
    if (record === undefined) {
      throw new AssetNotFoundError(launch.target);
    }
    if (accepts !== undefined && record.kind !== accepts) {
      throw new AssetKindMismatchError(launch.target, accepts, record.kind);
    }

    return record;
  }

  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly assets: AssetLeases;
  readonly target: AssetRoomLease;

  #client: EditorSessionClient;
  #kinds = new Map<string, AssetModelKind<unknown>>();
  #dependencies = new Map<string, AssetLease<unknown>>();
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
    this.#client = options.client;
    for (const kind of options.kinds) {
      this.#kinds.set(kind.kind, kind);
    }

    this.assets = new AssetLeases({
      rooms: this.#client,
      records: this.catalog
    });
    this.target = this.assets.openRoom(
      options.target.kind,
      options.target.id
    );

    this.#syncDependencies();
    this.catalog.on("change", this.#onCatalogChange);
    this.catalog.on("dependencies", this.#onCatalogChange);
  }

  dependencies(): IterableIterator<AssetLease<unknown>> {
    return this.#dependencies.values();
  }

  dependency(
    assetId: string
  ): AssetLease<unknown> | undefined {
    return this.#dependencies.get(assetId);
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
    const wanted = new Map<string, AssetModelKind<unknown>>();
    for (const reference of this.catalog.closureOf(this.target.record.id)) {
      const record = this.catalog.record(reference.id);
      const kind = this.#kinds.get(reference.kind);
      if (record?.kind === reference.kind && kind !== undefined) {
        wanted.set(reference.id, kind);
      }
    }

    for (const [assetId, lease] of this.#dependencies) {
      if (!wanted.has(assetId)) {
        this.#dependencies.delete(assetId);
        lease.release();
        this.emit("dependency-removed", {
          id: assetId,
          kind: lease.record.kind
        });
      }
    }

    for (const [assetId, kind] of wanted) {
      if (this.#dependencies.has(assetId)) {
        continue;
      }

      const lease = this.assets.open(kind, assetId);
      this.#dependencies.set(assetId, lease);
      this.emit("dependency-added", lease);
    }
  }
}
