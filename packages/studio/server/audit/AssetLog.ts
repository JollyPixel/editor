// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  isAssetEventType,
  parseAssetEvent
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  AuditEntry,
  AuditItem
} from "./AuditEntry.ts";
import { EventPages } from "./EventPages.ts";

// CONSTANTS
const kSnapshotSource = "snapshot";

export class AssetLog {
  #store: EventStore.EventStore;

  constructor(
    store: EventStore.EventStore
  ) {
    this.#store = store;
  }

  * events(
    before: number | undefined
  ): IterableIterator<AuditItem> {
    for (const event of new EventPages(this.#store, before)) {
      yield {
        position: event.eventId,
        at: Date.parse(event.createdAt),
        entry: assetEntry(event)
      };
    }
  }

  * tags(
    before: string | undefined
  ): IterableIterator<AuditItem> {
    const tags = this.#store.tags.list()
      .map((tag) => {
        return {
          tag,
          key: `${tag.createdAt}\u0000${tag.assetId}\u0000${tag.name}`
        };
      })
      .filter(({ key }) => before === undefined || key < before)
      .sort((left, right) => (left.key < right.key ? 1 : -1));

    for (const { tag, key } of tags) {
      const at = Date.parse(tag.createdAt);
      yield {
        position: key,
        at,
        entry: {
          kind: "tag",
          at,
          actor: tag.actor,
          assetId: tag.assetId,
          name: tag.name,
          message: tag.message
        }
      };
    }
  }
}

function assetEntry(
  event: EventStore.Event
): AuditEntry | null {
  const { actor } = event;
  if (actor.type === "system" && actor.source === kSnapshotSource) {
    return null;
  }

  const at = Date.parse(event.createdAt);
  if (!isAssetEventType(event.eventType)) {
    return {
      kind: "edit",
      at,
      actor,
      assetId: event.assetId
    };
  }

  const parsed = parseAssetEvent(event);
  if (!parsed.ok) {
    return null;
  }

  const asset = {
    kind: "asset",
    at,
    actor,
    assetId: event.assetId
  } as const;
  const { val } = parsed;
  switch (val.eventType) {
    case ASSET_CREATED:
      return { ...asset, action: "created", path: val.eventData.path };
    case ASSET_UPDATED:
      return { ...asset, action: "replaced", path: val.eventData.path };
    case ASSET_DELETED:
      return { ...asset, action: "deleted", path: val.eventData.path };
    case ASSET_RENAMED:
      return {
        ...asset,
        action: "renamed",
        path: val.eventData.to,
        previousPath: val.eventData.from
      };
    default:
      return val satisfies never;
  }
}
