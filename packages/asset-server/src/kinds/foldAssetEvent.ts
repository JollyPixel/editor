// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { AssetKindHandler } from "./AssetKindHandler.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  parseAssetEvent
} from "../events/AssetEvents.ts";
import { decodeContent } from "../events/inlineContent.ts";
import { parseAssetCommand } from "./parseAssetCommand.ts";

export function foldAssetEvent<TState, TCommand>(
  handler: AssetKindHandler<TState, TCommand>,
  state: TState,
  event: EventStore.Event
): void {
  const parsed = parseAssetEvent(event);
  if (parsed.ok) {
    const assetEvent = parsed.val;
    switch (assetEvent.eventType) {
      case ASSET_CREATED:
      case ASSET_UPDATED:
        handler.load(
          state,
          decodeContent(assetEvent.eventData.content)
        );
        break;
      case ASSET_DELETED:
        handler.clear(state);
        break;
      default:
        break;
    }

    return;
  }

  const { commands } = handler;
  if (
    commands === undefined ||
    event.eventType !== commands.eventType
  ) {
    return;
  }

  const command = parseAssetCommand(commands, event.eventData);
  if (command !== null) {
    commands.apply(state, command);
  }
}
