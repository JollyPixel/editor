// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  type AssetEvent,
  type AssetInlineContent
} from "../events/AssetEvents.ts";

/**
 * Physical state one asset stream asks for. `null` means "absent".
 */
export interface AssetProjection {
  readonly path: string;
  readonly kind: string;
  readonly hash: string;
  readonly content: AssetInlineContent;
}

export function applyProjection(
  projection: AssetProjection | null,
  event: AssetEvent
): AssetProjection | null {
  switch (event.eventType) {
    case ASSET_CREATED:
    case ASSET_UPDATED: {
      const { eventData } = event;

      return {
        path: eventData.path,
        kind: eventData.kind,
        hash: eventData.hash,
        content: eventData.content
      };
    }
    case ASSET_RENAMED: {
      if (projection === null) {
        return null;
      }

      return {
        ...projection,
        path: event.eventData.to
      };
    }
    case ASSET_DELETED:
      return null;
    default:
      return unhandled(event);
  }
}

function unhandled(
  event: never
): never {
  throw new TypeError(
    `Unhandled asset event type: ${JSON.stringify(event)}`
  );
}
