// Import Node.js Dependencies
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import {
  Validator,
  type Infer,
  type ValidationError
} from "ata-validator";

// Import Internal Dependencies
import {
  assetContentSchema,
  assetDeletedDataSchema,
  assetRenamedDataSchema,
  assetWriteDataSchema
} from "./AssetEvents.schema.ts";
import { ASSET_EVENT_PREFIX } from "../constants.ts";

// CONSTANTS
const kValidatorOptions = { useDefaults: false };
const kWriteDataValidator = new Validator(
  assetWriteDataSchema,
  kValidatorOptions
);
const kRenamedDataValidator = new Validator(
  assetRenamedDataSchema,
  kValidatorOptions
);
const kDeletedDataValidator = new Validator(
  assetDeletedDataSchema,
  kValidatorOptions
);

export const ASSET_CREATED = `${ASSET_EVENT_PREFIX}created` as const;
export const ASSET_UPDATED = `${ASSET_EVENT_PREFIX}updated` as const;
export const ASSET_RENAMED = `${ASSET_EVENT_PREFIX}renamed` as const;
export const ASSET_DELETED = `${ASSET_EVENT_PREFIX}deleted` as const;

export type AssetEventType =
  | typeof ASSET_CREATED
  | typeof ASSET_UPDATED
  | typeof ASSET_RENAMED
  | typeof ASSET_DELETED;

export const ASSET_CHECKPOINT_EVENT_TYPES: readonly AssetEventType[] = [
  ASSET_CREATED,
  ASSET_UPDATED,
  ASSET_DELETED
];

export type AssetContent = Infer<typeof assetContentSchema>;

export type AssetInlineContent = Extract<
  AssetContent,
  { type: "inline"; }
>;

/**
 * Shared payload for create and update events.
 */
export type AssetWriteData = Readonly<
  & Omit<Infer<typeof assetWriteDataSchema>, "content">
  & { content: AssetInlineContent; }
>;

export type AssetCreatedData = AssetWriteData;
export type AssetUpdatedData = AssetWriteData;

export type AssetRenamedData = Readonly<
  Infer<typeof assetRenamedDataSchema>
>;

export type AssetDeletedData = Readonly<
  Infer<typeof assetDeletedDataSchema>
>;

export type AssetEventData =
  | AssetWriteData
  | AssetRenamedData
  | AssetDeletedData;

export type AssetEventDataMap = {
  [ASSET_CREATED]: AssetCreatedData;
  [ASSET_UPDATED]: AssetUpdatedData;
  [ASSET_RENAMED]: AssetRenamedData;
  [ASSET_DELETED]: AssetDeletedData;
};

export type AssetEvent = EventStore.TypedEvent<AssetEventDataMap>;

/**
 * Why an event on an asset stream did not yield an asset event.
 *
 * `foreign` means the event belongs to another domain and is none of our
 * business. `malformed` and `unsupported` both mean an asset event we cannot
 * project, and are worth reporting.
 */
export type AssetEventRejection =
  | { reason: "foreign"; }
  | { reason: "malformed"; errors: readonly ValidationError[]; }
  | { reason: "unsupported"; detail: string; };

export function isAssetEventType(
  eventType: string
): boolean {
  return eventType.startsWith(ASSET_EVENT_PREFIX);
}

export function parseAssetEvent(
  event: EventStore.Event
): Result<AssetEvent, AssetEventRejection> {
  switch (event.eventType) {
    case ASSET_CREATED:
    case ASSET_UPDATED:
      return parseWriteEvent(event.eventType, event);
    case ASSET_RENAMED: {
      const result = kRenamedDataValidator.validate(event.eventData);

      return result.valid ?
        Ok({
          ...event,
          eventType: ASSET_RENAMED,
          eventData: result.data
        }) :
        Err(malformed(result.errors));
    }
    case ASSET_DELETED: {
      const result = kDeletedDataValidator.validate(event.eventData);

      return result.valid ?
        Ok({
          ...event,
          eventType: ASSET_DELETED,
          eventData: result.data
        }) :
        Err(malformed(result.errors));
    }
    default:
      return Err({ reason: "foreign" });
  }
}

export function describeRejection(
  rejection: AssetEventRejection
): string {
  switch (rejection.reason) {
    case "foreign":
      return "event belongs to another domain";
    case "unsupported":
      return rejection.detail;
    default:
      return rejection.errors
        .map((error) => `${error.instancePath || "/"} ${error.message}`)
        .join("; ");
  }
}

function parseWriteEvent(
  eventType: typeof ASSET_CREATED | typeof ASSET_UPDATED,
  event: EventStore.Event
): Result<AssetEvent, AssetEventRejection> {
  const result = kWriteDataValidator.validate(event.eventData);
  if (!result.valid) {
    return Err(malformed(result.errors));
  }

  const { content } = result.data;
  if (content.type !== "inline") {
    return Err({
      reason: "unsupported",
      detail: "content references are not supported yet"
    });
  }

  return Ok({
    ...event,
    eventType,
    eventData: {
      ...result.data,
      content
    }
  });
}

function malformed(
  errors: readonly ValidationError[]
): AssetEventRejection {
  return {
    reason: "malformed",
    errors
  };
}

export function encodeContent(
  data: Uint8Array
): AssetInlineContent {
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
  content: AssetInlineContent
): Uint8Array {
  return new Uint8Array(
    Buffer.from(content.data, "base64")
  );
}
