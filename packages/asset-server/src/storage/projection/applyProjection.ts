// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  partRefs,
  type AssetEvent,
  type AssetPartRef
} from "../../model/events/AssetEvents.ts";

export interface AssetProjection {
  readonly path: string;
  readonly kind: string;
  readonly hash: string;
  readonly dependencies?: readonly AssetReferenceData[];
  readonly parts?: ReadonlyMap<string, AssetPartRef>;
  readonly revision?: string;
}

export function applyProjection(
  projection: AssetProjection | null,
  event: AssetEvent
): AssetProjection | null {
  switch (event.eventType) {
    case ASSET_CREATED:
    case ASSET_UPDATED: {
      const { eventData } = event;
      const dependencies = eventData.dependencies ?? projection?.dependencies;

      return {
        path: eventData.path,
        kind: eventData.kind,
        hash: eventData.hash,
        ...(dependencies === undefined ? {} : { dependencies }),
        ...(eventData.parts === undefined ?
          {} :
          {
            parts: partRefs(eventData, event.eventVersion),
            revision: `${eventData.hash}@${event.eventVersion}`
          })
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
