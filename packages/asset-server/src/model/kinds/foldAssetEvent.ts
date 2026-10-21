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
import type { AssetInlineContent } from "../events/AssetEvents.schema.ts";
import { decodeContent } from "../events/inlineContent.ts";

export type AssetPartReader = Pick<EventStore.EventReader, "get">;

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

  for (const [partId, entry] of Object.entries(data.parts)) {
    const content = "content" in entry ?
      entry.content :
      heldPartContent(reader, assetId, entry.at, partId);
    handler.parts.load(state, partId, decodeContent(content));
  }
}

function heldPartContent(
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
