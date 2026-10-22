// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_CREATED,
  ASSET_EVENT_PREFIX,
  ASSET_UPDATED,
  parseAssetEvent,
  partRefs
} from "./AssetEvents.ts";

export function retainedPartEvents(
  eventStore: Pick<EventStore.EventStore, "reader" | "tags">,
  assetId?: string
): EventStore.EventPosition[] {
  const checkpoints = eventStore.reader.listFromCheckpoints({
    checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES,
    eventTypePrefix: ASSET_EVENT_PREFIX,
    ...(assetId === undefined ? {} : { assetId })
  });
  const tagged = eventStore.tags
    .list(assetId)
    .map((tag) => eventStore.reader.get(tag.assetId, tag.eventVersion));

  const kept: EventStore.EventPosition[] = [];
  for (const event of [...checkpoints, ...tagged]) {
    if (event === undefined) {
      continue;
    }

    const parsed = parseAssetEvent(event);
    if (
      !parsed.ok ||
      (
        parsed.val.eventType !== ASSET_CREATED &&
        parsed.val.eventType !== ASSET_UPDATED
      )
    ) {
      continue;
    }

    for (const { at } of partRefs(parsed.val.eventData, event.eventVersion).values()) {
      kept.push({
        assetId: event.assetId,
        eventVersion: at
      });
    }
  }

  return kept;
}
