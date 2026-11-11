// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_EVENT_PREFIX,
  partRefs
} from "./AssetEvents.ts";
import { parseWriteEvent } from "./parseWriteEvent.ts";

export async function retainedPartEvents(
  eventStore: Pick<EventStore.EventStore, "reader" | "tags">,
  assetId?: string
): Promise<EventStore.EventPosition[]> {
  const checkpoints = await eventStore.reader.listFromCheckpoints({
    checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES,
    eventTypePrefix: ASSET_EVENT_PREFIX,
    ...(assetId === undefined ? {} : { assetId })
  });
  const tagged = await Promise.all(
    (await eventStore.tags.list(assetId))
      .map((tag) => eventStore.reader.get(tag.assetId, tag.eventVersion))
  );

  const kept: EventStore.EventPosition[] = [];
  for (const event of [...checkpoints, ...tagged]) {
    const written = parseWriteEvent(event);
    if (written === null) {
      continue;
    }

    for (const { at } of partRefs(written.eventData, written.eventVersion).values()) {
      kept.push({
        assetId: written.assetId,
        eventVersion: at
      });
    }
  }

  return kept;
}
