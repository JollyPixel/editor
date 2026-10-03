// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetKindHandler } from "./AssetKindHandler.ts";
import type { AssetCommandHeader } from "./AssetLiveProtocol.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  parseAssetEvent
} from "../events/AssetEvents.ts";
import { decodeContent } from "../events/inlineContent.ts";

export function foldAssetEvent<
  TState,
  TCommand extends AssetCommandHeader
>(
  handler: AssetKindHandler<TState, TCommand>,
  state: TState,
  event: EventStore.Event
): TCommand | null {
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

    return null;
  }

  const { commands } = handler;
  if (
    commands === undefined ||
    event.eventType !== commands.eventType
  ) {
    return null;
  }

  const command = MessageParser.of<TCommand>(commands.protocol)
    .parse(event.eventData);
  if (!command.ok) {
    return null;
  }

  commands.apply(state, command.val.message);

  return command.val.message;
}
