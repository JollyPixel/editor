// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  SchemaParser,
  type Infer,
  type PeerIdentity,
  type ValidationError
} from "@jolly-pixel/network";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import {
  assetContentSchema,
  assetDeletedDataSchema,
  assetPartSchema,
  assetRenamedDataSchema,
  assetWriteDataSchema,
  type AssetInlineContent
} from "./AssetEvents.schema.ts";
import { encodeContent } from "./inlineContent.ts";
import { contentHash } from "../../common/contentHash.ts";

// CONSTANTS
export const ASSET_EVENT_PREFIX = "asset.";

const kSnapshotSource = "snapshot";

const kWriteDataParser = new SchemaParser(assetWriteDataSchema);
const kRenamedDataParser = new SchemaParser(assetRenamedDataSchema);
const kDeletedDataParser = new SchemaParser(assetDeletedDataSchema);

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

export const SNAPSHOT_ACTOR: EventStore.Actor = {
  type: "system",
  source: kSnapshotSource
};

export type { AssetInlineContent };

export type AssetContent = Infer<typeof assetContentSchema>;

export type AssetPartEntry = Infer<typeof assetPartSchema>;

export interface AssetPartRef {
  readonly hash: string;
  readonly size: number;
  readonly at: number;
}

export interface AssetPartsWrite {
  readonly written: ReadonlyMap<string, Uint8Array>;
  readonly kept?: ReadonlyMap<string, AssetPartRef>;
}

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

export type AssetEventRejection =
  | { reason: "foreign"; }
  | { reason: "malformed"; errors: readonly ValidationError[]; }
  | { reason: "unsupported"; detail: string; };

export function isAssetEventType(
  eventType: string
): boolean {
  return eventType.startsWith(ASSET_EVENT_PREFIX);
}

export function isStateNeutral(
  event: EventStore.Event
): boolean {
  return event.eventType === ASSET_RENAMED || (
    event.actor.type === "system" &&
    event.actor.source === kSnapshotSource
  );
}

export function toActor(
  identity: PeerIdentity
): EventStore.Actor {
  return {
    type: "user",
    id: identity.subject
  };
}

export function parseAssetEvent(
  event: EventStore.Event
): Result<AssetEvent, AssetEventRejection> {
  switch (event.eventType) {
    case ASSET_CREATED:
    case ASSET_UPDATED:
      return parseWriteEvent(event.eventType, event);
    case ASSET_RENAMED: {
      const result = kRenamedDataParser.parse(event.eventData);

      return result.ok ?
        Ok({
          ...event,
          eventType: ASSET_RENAMED,
          eventData: result.val
        }) :
        Err(malformed(result.val));
    }
    case ASSET_DELETED: {
      const result = kDeletedDataParser.parse(event.eventData);

      return result.ok ?
        Ok({
          ...event,
          eventType: ASSET_DELETED,
          eventData: result.val
        }) :
        Err(malformed(result.val));
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
  const result = kWriteDataParser.parse(event.eventData);
  if (!result.ok) {
    return Err(malformed(result.val));
  }

  const { content } = result.val;
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
      ...result.val,
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

export function partRefs(
  data: AssetWriteData,
  eventVersion: number
): Map<string, AssetPartRef> {
  const refs = new Map<string, AssetPartRef>();
  for (const [partId, entry] of Object.entries(data.parts ?? {})) {
    refs.set(partId, {
      hash: entry.hash,
      size: entry.size,
      at: "at" in entry ? entry.at : eventVersion
    });
  }

  return refs;
}

export async function writeData(
  path: string,
  kind: string,
  data: Uint8Array,
  dependencies: readonly AssetReferenceData[] = [],
  parts?: AssetPartsWrite
): Promise<AssetWriteData> {
  const size = data.byteLength;
  const content = encodeContent(data);
  const references = dependencies.map((reference) => {
    return {
      id: reference.id,
      kind: reference.kind
    };
  });

  return {
    path,
    kind,
    hash: await contentHash(data),
    size,
    content,
    ...(parts === undefined ? {} : { parts: await partEntries(parts) }),
    dependencies: references
  };
}

async function partEntries(
  parts: AssetPartsWrite
): Promise<Record<string, AssetPartEntry>> {
  const entries: Record<string, AssetPartEntry> = {};
  for (const [partId, ref] of parts.kept ?? []) {
    entries[partId] = {
      hash: ref.hash,
      size: ref.size,
      at: ref.at
    };
  }
  for (const [partId, data] of parts.written) {
    entries[partId] = {
      hash: await contentHash(data),
      size: data.byteLength,
      content: encodeContent(data)
    };
  }

  return entries;
}

