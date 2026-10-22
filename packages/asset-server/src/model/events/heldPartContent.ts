// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { parseAssetEvent } from "./AssetEvents.ts";
import type { AssetInlineContent } from "./AssetEvents.schema.ts";

export type AssetPartReader = Pick<EventStore.EventReader, "get">;

export function heldPartContent(
  reader: AssetPartReader | undefined,
  assetId: string,
  at: number,
  partId: string
): AssetInlineContent {
  const event = reader?.get(assetId, at);
  const parsed = event === undefined ? null : parseAssetEvent(event);
  const data = parsed?.ok === true ? parsed.val.eventData : null;
  const entry = data !== null && "parts" in data ?
    data.parts?.[partId] :
    undefined;
  if (entry === undefined || !("content" in entry)) {
    throw new Error(
      `Part "${partId}" of asset "${assetId}" is missing from version ${at}.`
    );
  }

  return entry.content;
}
