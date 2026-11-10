// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AnyAssetKindHandler,
  AssetCommands,
  AssetKindHandler
} from "./AssetKindHandler.ts";
import type { AssetCommandHeader } from "./AssetLiveProtocol.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  isAssetEventType,
  parseAssetEvent,
  type AssetWriteData
} from "../events/AssetEvents.ts";
import { decodeContent } from "../events/inlineContent.ts";
import type { AssetHeldParts } from "../events/AssetPartContents.ts";

export function foldAssetEvent<
  TState,
  TCommand extends AssetCommandHeader,
  TRelay extends object
>(
  handler: AssetKindHandler<TState, TCommand, TRelay>,
  state: TState,
  event: EventStore.Event,
  held?: AssetHeldParts
): TCommand | null {
  if (isAssetEventType(event.eventType)) {
    foldLifecycleEvent(handler, state, event, held);

    return null;
  }

  const { commands } = handler;
  if (
    commands === undefined ||
    event.eventType !== commands.eventType
  ) {
    return null;
  }

  const command = MessageParser.fromProtocol<TCommand>(commands.protocol)
    .parse(storedCommand(commands, event));
  if (!command.ok) {
    return null;
  }

  commands.apply(state, command.val.message);

  return command.val.message;
}

export function storedCommand(
  commands: Pick<AssetCommands, "upcast">,
  event: EventStore.Event
): unknown {
  return commands.upcast === undefined ?
    event.eventData :
    commands.upcast(event.eventData);
}

function foldLifecycleEvent(
  handler: AnyAssetKindHandler,
  state: unknown,
  event: EventStore.Event,
  held: AssetHeldParts | undefined
): void {
  const parsed = parseAssetEvent(event);
  if (!parsed.ok) {
    return;
  }

  const assetEvent = parsed.val;
  switch (assetEvent.eventType) {
    case ASSET_CREATED:
    case ASSET_UPDATED:
      handler.load(
        state,
        decodeContent(assetEvent.eventData.content)
      );
      loadParts(handler, state, assetEvent.eventData, event.assetId, held);
      break;
    case ASSET_DELETED:
      handler.clear(state);
      break;
    default:
      break;
  }
}

function loadParts(
  handler: AnyAssetKindHandler,
  state: unknown,
  data: AssetWriteData,
  assetId: string,
  held: AssetHeldParts | undefined
): void {
  if (handler.parts === undefined || data.parts === undefined) {
    return;
  }

  for (const [partId, entry] of Object.entries(data.parts)) {
    if ("content" in entry) {
      handler.parts.load(state, partId, decodeContent(entry.content));
      continue;
    }

    const content = held?.get(partId);
    if (content === undefined) {
      throw new Error(
        `Part "${partId}" of asset "${assetId}" is held at version ${entry.at}; load it with loadHeldParts.`
      );
    }
    handler.parts.load(state, partId, content);
  }
}
