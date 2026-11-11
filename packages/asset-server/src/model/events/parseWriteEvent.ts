// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_UPDATED,
  parseAssetEvent,
  type AssetEvent
} from "./AssetEvents.ts";

export type AssetWriteEvent = Extract<
  AssetEvent,
  { eventType: typeof ASSET_CREATED | typeof ASSET_UPDATED; }
>;

export function parseWriteEvent(
  event: EventStore.Event | undefined
): AssetWriteEvent | null {
  if (event === undefined) {
    return null;
  }

  const parsed = parseAssetEvent(event);
  if (!parsed.ok) {
    return null;
  }

  const { val } = parsed;

  return val.eventType === ASSET_CREATED || val.eventType === ASSET_UPDATED ?
    val :
    null;
}
