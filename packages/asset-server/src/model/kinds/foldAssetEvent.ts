// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AnyAssetKindHandler,
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
import {
  AssetPartContents,
  type AssetPartReader
} from "../events/AssetPartContents.ts";

export function foldAssetEvent<
  TState,
  TCommand extends AssetCommandHeader,
  TRelay extends object
>(
  handler: AssetKindHandler<TState, TCommand, TRelay>,
  state: TState,
  event: EventStore.Event,
  parts?: AssetPartReader
): TCommand | null {
  if (isAssetEventType(event.eventType)) {
    foldLifecycleEvent(handler, state, event, parts);

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
    .parse(event.eventData);
  if (!command.ok) {
    return null;
  }

  commands.apply(state, command.val.message);

  return command.val.message;
}

function foldLifecycleEvent(
  handler: AnyAssetKindHandler,
  state: unknown,
  event: EventStore.Event,
  parts: AssetPartReader | undefined
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
      loadParts(handler, state, assetEvent.eventData, event.assetId, parts);
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
  reader: AssetPartReader | undefined
): void {
  if (handler.parts === undefined || data.parts === undefined) {
    return;
  }

  let held: AssetPartContents | null = null;
  for (const [partId, entry] of Object.entries(data.parts)) {
    if ("content" in entry) {
      handler.parts.load(state, partId, decodeContent(entry.content));
      continue;
    }
    if (reader === undefined) {
      throw new Error(
        `Part "${partId}" of asset "${assetId}" is held at version ${entry.at}; pass an event reader.`
      );
    }

    held ??= new AssetPartContents(reader, assetId);
    handler.parts.load(state, partId, held.read(partId, entry.at));
  }
}
