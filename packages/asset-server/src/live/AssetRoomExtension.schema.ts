// Import Third-party Dependencies
import {
  CATCH_UP_EVENT,
  MessageProtocol,
  SNAPSHOT_EVENT,
  withEvent,
  type NetworkSyncMessage,
  type Schema
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  ASSET_ROOM_DELETED,
  ASSET_ROOM_MAX_PARTS_PER_MESSAGE,
  ASSET_ROOM_PARTS,
  ASSET_ROOM_REJECTED,
  ASSET_ROOM_SUBSCRIBE_PARTS,
  ASSET_ROOM_UNSUBSCRIBE_PARTS
} from "../model/kinds/AssetLiveProtocol.ts";
import { ASSET_PART_ID_PATTERN } from "../model/events/AssetEvents.schema.ts";

// CONSTANTS
const kNonNegativeInt = z.int().check(z.minimum(0));
const kAcksSchema = z.record(z.string(), kNonNegativeInt);

const kAssetRoomDeletedSchema = z.object({
  type: z.literal(ASSET_ROOM_DELETED)
});

const kAssetRoomRejectedSchema = z.object({
  type: z.literal(ASSET_ROOM_REJECTED),
  reason: z.string()
});

const kPartIdsSchema = z.array(
  z.string().check(z.regex(ASSET_PART_ID_PATTERN))
).check(z.maxLength(ASSET_ROOM_MAX_PARTS_PER_MESSAGE));

export const ASSET_ROOM_PART_REQUESTS = [
  ASSET_ROOM_SUBSCRIBE_PARTS,
  ASSET_ROOM_UNSUBSCRIBE_PARTS
] as const;

export const assetRoomResumeSchema = z.object({
  clientId: z.string(),
  version: z.optional(kNonNegativeInt)
});

type SyncMessageType = Exclude<
  NetworkSyncMessage<unknown, unknown>["type"],
  "catch-up"
>;

const kSyncOptionalProperties: Record<
  SyncMessageType,
  z.core.$ZodLooseShape
> = {
  snapshot: {
    version: z.optional(kNonNegativeInt),
    acks: z.optional(kAcksSchema),
    refused: z.optional(kNonNegativeInt)
  },
  command: {
    version: z.optional(kNonNegativeInt)
  },
  correction: {
    acks: z.optional(kAcksSchema),
    refused: z.optional(kNonNegativeInt)
  }
};

export function assetRoomOutboundProtocol(
  command: MessageProtocol,
  snapshot: Schema,
  relay: readonly Schema[] = [],
  part?: Schema
): MessageProtocol {
  return new MessageProtocol(
    z.union([
      syncVariant(SNAPSHOT_EVENT, "snapshot", snapshot),
      ...command.variants.map(
        ({ event, schema }) => syncVariant(event, "command", schema)
      ),
      ...command.variants.map(
        ({ event, schema }) => syncVariant(event, "correction", schema)
      ),
      catchUpVariant(command),
      kAssetRoomDeletedSchema,
      kAssetRoomRejectedSchema,
      ...part === undefined ? [] : [partsVariant(part)],
      ...relay
    ]),
    {
      discriminator: "type"
    }
  );
}

export function assetRoomInboundProtocol(
  command: MessageProtocol,
  relay: readonly Schema[],
  parted = false
): MessageProtocol {
  if (relay.length === 0 && !parted) {
    return command;
  }

  const requests = parted ?
    ASSET_ROOM_PART_REQUESTS.map((tag) => z.object({
      [command.discriminator]: z.literal(tag),
      parts: kPartIdsSchema
    })) :
    [];

  return new MessageProtocol(
    z.union([
      ...command.variants.map(({ schema }) => schema),
      ...relay,
      ...requests
    ]),
    {
      discriminator: command.discriminator
    }
  );
}

function partsVariant(
  part: Schema
): Schema {
  return z.object({
    type: z.literal(ASSET_ROOM_PARTS),
    version: kNonNegativeInt,
    parts: z.record(z.string(), z.nullable(part))
  });
}

function syncVariant(
  event: string,
  type: SyncMessageType,
  data: Schema
): Schema {
  return withEvent(z.object({
    type: z.literal(type),
    data,
    ...kSyncOptionalProperties[type]
  }), event);
}

function catchUpVariant(
  command: MessageProtocol
): Schema {
  const items = command.variants.length === 0 ?
    z.unknown() :
    z.union(command.variants.map(({ schema }) => schema));

  return withEvent(z.object({
    type: z.literal("catch-up"),
    data: z.array(items),
    version: kNonNegativeInt,
    acks: z.optional(kAcksSchema)
  }), CATCH_UP_EVENT);
}
