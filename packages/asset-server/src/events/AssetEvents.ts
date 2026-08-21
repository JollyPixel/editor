// Import Node.js Dependencies
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { ASSET_EVENT_PREFIX } from "../constants.ts";

export const ASSET_CREATED = `${ASSET_EVENT_PREFIX}created` as const;
export const ASSET_UPDATED = `${ASSET_EVENT_PREFIX}updated` as const;
export const ASSET_RENAMED = `${ASSET_EVENT_PREFIX}renamed` as const;
export const ASSET_DELETED = `${ASSET_EVENT_PREFIX}deleted` as const;

export type AssetEventType =
  | typeof ASSET_CREATED
  | typeof ASSET_UPDATED
  | typeof ASSET_RENAMED
  | typeof ASSET_DELETED;

/**
 * Lifecycle content stored inline or by durable reference.
 *
 * Version 1 supports inline content only but reserves the reference shape.
 */
export type AssetContent =
  | { type: "inline"; encoding: "base64"; data: string; }
  | { type: "ref"; hash: string; size: number; };

/**
 * Shared payload for create and update events.
 */
export interface AssetWriteData {
  readonly path: string;
  readonly kind: string;
  readonly hash: string;
  readonly size: number;
  readonly content: AssetContent;
}

export type AssetCreatedData = AssetWriteData;
export type AssetUpdatedData = AssetWriteData;

export interface AssetRenamedData {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly hash: string;
}

export interface AssetDeletedData {
  readonly path: string;
  readonly kind: string;
}

export type AssetEventData =
  | AssetWriteData
  | AssetRenamedData
  | AssetDeletedData;

/**
 * Binds each lifecycle event type to the payload it carries.
 */
export type AssetEventDataMap = {
  [ASSET_CREATED]: AssetCreatedData;
  [ASSET_UPDATED]: AssetUpdatedData;
  [ASSET_RENAMED]: AssetRenamedData;
  [ASSET_DELETED]: AssetDeletedData;
};

/**
 * A stored Event whose `eventData` is known to match its `eventType`.
 *
 * `isAssetEvent` is the only way to obtain one, so readers fold validated
 * payloads instead of asserting their shape.
 */
export type AssetEvent = {
  [K in keyof AssetEventDataMap]: EventStore.Event & {
    eventType: K;
    eventData: AssetEventDataMap[K];
  };
}[keyof AssetEventDataMap];

export function isAssetEventType(
  eventType: string
): boolean {
  return eventType.startsWith(ASSET_EVENT_PREFIX);
}

/**
 * Validates that an event's payload matches its lifecycle type.
 *
 * Events arrive from persistence as parsed JSON, so the payload is checked
 * rather than asserted. Domain events and malformed lifecycle payloads both
 * return `false`; callers skip them.
 */
export function isAssetEvent(
  event: EventStore.Event
): event is AssetEvent {
  switch (event.eventType) {
    case ASSET_CREATED:
    case ASSET_UPDATED:
      return isAssetWriteData(event.eventData);
    case ASSET_RENAMED:
      return isAssetRenamedData(event.eventData);
    case ASSET_DELETED:
      return isAssetDeletedData(event.eventData);
    default:
      return false;
  }
}

function isRecord(
  input: unknown
): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isAssetContent(
  input: unknown
): input is AssetContent {
  if (!isRecord(input)) {
    return false;
  }
  if (input.type === "inline") {
    return input.encoding === "base64" && typeof input.data === "string";
  }

  return input.type === "ref" &&
    typeof input.hash === "string" &&
    typeof input.size === "number";
}

function isAssetWriteData(
  input: unknown
): input is AssetWriteData {
  return isRecord(input) &&
    typeof input.path === "string" &&
    typeof input.kind === "string" &&
    typeof input.hash === "string" &&
    typeof input.size === "number" &&
    isAssetContent(input.content);
}

function isAssetRenamedData(
  input: unknown
): input is AssetRenamedData {
  return isRecord(input) &&
    typeof input.from === "string" &&
    typeof input.to === "string" &&
    typeof input.kind === "string" &&
    typeof input.hash === "string";
}

function isAssetDeletedData(
  input: unknown
): input is AssetDeletedData {
  return isRecord(input) &&
    typeof input.path === "string" &&
    typeof input.kind === "string";
}

export function encodeContent(
  data: Uint8Array
): AssetContent {
  return {
    type: "inline",
    encoding: "base64",
    data: Buffer.from(
      data.buffer,
      data.byteOffset,
      data.byteLength
    ).toString("base64")
  };
}

export function decodeContent(
  content: AssetContent
): Uint8Array {
  if (content.type === "ref") {
    throw new Error(
      "Content references are not supported yet; expected inline content."
    );
  }

  return new Uint8Array(
    Buffer.from(content.data, "base64")
  );
}
