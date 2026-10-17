// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import {
  Extension,
  type ClientHandle,
  type MessageProtocols,
  type PeerIdentity,
  type RoomBroadcast,
  type RoomContext,
  type RoomPeer
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { catalogProtocols } from "./protocol.schema.ts";
import {
  CATALOG_CHANGED,
  CATALOG_REJECTED,
  CATALOG_SNAPSHOT,
  CATALOG_VIEW_ROOM,
  type CatalogChange,
  type CatalogCommand,
  type CatalogMessage
} from "./client/protocol.ts";
import type { DependencyMap } from "./client/DependencyIndex.ts";
import type { CatalogProjection } from "./CatalogProjection.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED
} from "../events/AssetEvents.ts";

export type CatalogViewScope = (
  identity: PeerIdentity
) => string | null;

export interface CatalogViewExtensionOptions {
  catalog: CatalogProjection;
  scope: CatalogViewScope;
  id?: string;
}

interface CatalogView {
  readonly viewers: Map<string, RoomBroadcast>;
  visible: Set<string>;
}

export class CatalogViewExtension extends Extension<CatalogCommand> {
  readonly id: string;
  readonly name = CATALOG_VIEW_ROOM;
  readonly protocols: MessageProtocols = catalogProtocols;

  #catalog: CatalogProjection;
  #scope: CatalogViewScope;
  #views = new Map<string, CatalogView>();

  constructor(
    options: CatalogViewExtensionOptions
  ) {
    super();

    this.id = options.id ?? CATALOG_VIEW_ROOM;
    this.#catalog = options.catalog;
    this.#scope = options.scope;
    this.#catalog.on("changed", this.#onChanged);
  }

  override onClientConnect(
    client: ClientHandle,
    peer: RoomPeer,
    context: RoomContext
  ): void {
    const root = this.#scope(peer.identity);
    const visible = root === null ?
      new Set<string>() :
      this.#join(root, client.id, context.room).visible;

    context.room.sendTo(client.id, {
      type: CATALOG_SNAPSHOT,
      manifest: {
        version: 1,
        assets: Array.from(visible).flatMap(
          (assetId) => this.#catalog.record(assetId)?.toJSON() ?? []
        )
      },
      dependencies: this.#dependenciesWithin(visible),
      folders: []
    } satisfies CatalogMessage);
  }

  override onClientDisconnect(
    clientId: string
  ): void {
    for (const [root, view] of this.#views) {
      if (view.viewers.delete(clientId)) {
        if (view.viewers.size === 0) {
          this.#views.delete(root);
        }

        return;
      }
    }
  }

  override onMessage(
    clientId: string,
    command: CatalogCommand,
    context: RoomContext
  ): void {
    context.room.sendTo(clientId, {
      type: CATALOG_REJECTED,
      requestId: command.requestId,
      command: command.type,
      reason: "the catalog view is read-only"
    } satisfies CatalogMessage);
  }

  override dispose(): void {
    this.#catalog.off("changed", this.#onChanged);
    this.#views.clear();
  }

  readonly #onChanged = (
    change: CatalogChange
  ): void => {
    for (const [root, view] of this.#views) {
      const visible = this.#catalog.reachableFrom(root);
      const changes = this.#projectChanges(change, view.visible, visible);
      view.visible = visible;
      if (changes.length === 0) {
        continue;
      }

      const message = {
        type: CATALOG_CHANGED,
        changes
      } satisfies CatalogMessage;
      for (const [clientId, room] of view.viewers) {
        room.sendTo(clientId, message);
      }
    }
  };

  #join(
    root: string,
    clientId: string,
    room: RoomBroadcast
  ): CatalogView {
    let view = this.#views.get(root);
    if (view === undefined) {
      view = {
        viewers: new Map(),
        visible: this.#catalog.reachableFrom(root)
      };
      this.#views.set(root, view);
    }
    view.viewers.set(clientId, room);

    return view;
  }

  #projectChanges(
    change: CatalogChange,
    before: ReadonlySet<string>,
    after: ReadonlySet<string>
  ): CatalogChange[] {
    const changes: CatalogChange[] = [];
    if (after.has(change.assetId) || before.has(change.assetId)) {
      changes.push(after.has(change.assetId) || change.record === null ?
        change :
        this.#hidden(change.assetId));
    }
    for (const assetId of after) {
      const record = this.#catalog.record(assetId);
      if (
        record !== undefined &&
        !before.has(assetId) &&
        assetId !== change.assetId
      ) {
        changes.push(this.#shown(record));
      }
    }
    for (const assetId of before) {
      if (!after.has(assetId) && assetId !== change.assetId) {
        changes.push(this.#hidden(assetId));
      }
    }

    return changes;
  }

  #shown(
    record: AssetRecord
  ): CatalogChange {
    const { dependencies } = this.#catalog;
    const assetId = record.id.value;

    return {
      eventType: ASSET_CREATED,
      assetId,
      record: record.toJSON(),
      ...(dependencies.has(assetId) ?
        { dependencies: dependencies.listDependencies(assetId) } :
        {})
    };
  }

  #hidden(
    assetId: string
  ): CatalogChange {
    return {
      eventType: ASSET_DELETED,
      assetId,
      record: null
    };
  }

  #dependenciesWithin(
    visible: ReadonlySet<string>
  ): DependencyMap {
    const { dependencies } = this.#catalog;
    const within: Record<string, DependencyMap[string]> = {};
    for (const assetId of visible) {
      if (dependencies.has(assetId)) {
        within[assetId] = dependencies.listDependencies(assetId);
      }
    }

    return within;
  }
}
