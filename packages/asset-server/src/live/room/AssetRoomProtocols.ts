// Import Third-party Dependencies
import {
  CATCH_UP_EVENT,
  MessageProtocol,
  SNAPSHOT_EVENT,
  withEvent,
  type MessageProtocols,
  type NetworkSyncMessage,
  type Schema
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { AssetCommands } from "../../model/kinds/AssetKindHandler.ts";
import type {
  AssetCommandHeader,
  AssetRelaySchemas
} from "../../model/kinds/AssetLiveProtocol.ts";
import { ASSET_PART_ID_PATTERN } from "../../model/events/AssetEvents.schema.ts";
import {
  ASSET_ROOM_DELETED,
  ASSET_ROOM_INLINE_SNAPSHOT,
  ASSET_ROOM_MAX_PARTS_PER_MESSAGE,
  ASSET_ROOM_PARTS,
  ASSET_ROOM_REJECTED,
  ASSET_ROOM_SUBSCRIBE_PARTS,
  ASSET_ROOM_UNSUBSCRIBE_PARTS,
  type AssetPartsRequest
} from "./messages.ts";

export interface AssetRoomMessageProtocols extends MessageProtocols {
  readonly inbound: MessageProtocol;
  readonly outbound: MessageProtocol;
}

interface CompiledProtocols {
  readonly inbound: MessageProtocol;
  readonly command: MessageProtocol;
  readonly relayOutbound: readonly Schema[];
  readonly relayTags: ReadonlySet<string>;
  readonly bySnapshot: Map<
    Schema,
    Map<Schema | null, AssetRoomMessageProtocols>
  >;
}

type SyncMessageType = Exclude<
  NetworkSyncMessage<unknown, unknown>["type"],
  "catch-up"
>;

// CONSTANTS
const kPartRequests = [
  ASSET_ROOM_SUBSCRIBE_PARTS,
  ASSET_ROOM_UNSUBSCRIBE_PARTS
] as const;
const kByCommands = new WeakMap<object, CompiledProtocols>();
const kPartRequestTags = new Set<string>(kPartRequests);
const kRoomRequestTags = new Set<string>([
  ...kPartRequests,
  ASSET_ROOM_INLINE_SNAPSHOT
]);
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

export const assetRoomResumeSchema = z.object({
  clientId: z.string(),
  version: z.optional(kNonNegativeInt)
});

export class AssetRoomProtocols<
  TCommand extends AssetCommandHeader = AssetCommandHeader,
  TRelay extends object = never
> {
  static compile<
    TCommand extends AssetCommandHeader,
    TRelay extends object
  >(
    commands: AssetCommands<unknown, TCommand, TRelay>
  ): AssetRoomProtocols<TCommand, TRelay> {
    return new AssetRoomProtocols(compiledProtocols(commands));
  }

  static validate<
    TCommand extends AssetCommandHeader,
    TRelay extends object
  >(
    commands: AssetCommands<unknown, TCommand, TRelay>
  ): void {
    compiledProtocols(commands);
  }

  readonly inbound: MessageProtocol;

  #compiled: CompiledProtocols;

  private constructor(
    compiled: CompiledProtocols
  ) {
    this.inbound = compiled.inbound;
    this.#compiled = compiled;
  }

  withSnapshot(
    snapshot: Schema,
    part?: Schema
  ): AssetRoomMessageProtocols {
    const { bySnapshot } = this.#compiled;
    let byPart = bySnapshot.get(snapshot);
    if (byPart === undefined) {
      byPart = new Map();
      bySnapshot.set(snapshot, byPart);
    }

    let protocols = byPart.get(part ?? null);
    if (protocols === undefined) {
      protocols = {
        inbound: this.inbound,
        outbound: assetRoomOutboundProtocol(
          this.#compiled.command,
          snapshot,
          this.#compiled.relayOutbound,
          part
        )
      };
      byPart.set(part ?? null, protocols);
    }

    return protocols;
  }

  isPartRequest(
    message: object
  ): message is AssetPartsRequest {
    const tag = this.#tag(message);

    return tag !== null && kPartRequestTags.has(tag);
  }

  isInlineSnapshotRequest(
    message: object
  ): boolean {
    return this.#tag(message) === ASSET_ROOM_INLINE_SNAPSHOT;
  }

  #tag(
    message: object
  ): string | null {
    const tag: unknown = Reflect.get(message, this.inbound.discriminator);

    return typeof tag === "string" ? tag : null;
  }

  routesToRelay(
    message: TCommand | TRelay
  ): message is TRelay {
    const { relayTags } = this.#compiled;
    if (relayTags.size === 0) {
      return false;
    }

    const tag = this.#tag(message);

    return tag !== null && relayTags.has(tag);
  }
}

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
      withEvent(z.object({
        type: z.literal(ASSET_ROOM_INLINE_SNAPSHOT),
        data: snapshot,
        version: z.optional(kNonNegativeInt)
      }), SNAPSHOT_EVENT),
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

function compiledProtocols<
  TCommand extends AssetCommandHeader,
  TRelay extends object
>(
  commands: AssetCommands<unknown, TCommand, TRelay>
): CompiledProtocols {
  let compiled = kByCommands.get(commands);
  if (compiled === undefined) {
    compiled = compileProtocols(commands.protocol, commands.relay);
    kByCommands.set(commands, compiled);
  }

  return compiled;
}

function compileProtocols(
  command: MessageProtocol,
  relay: AssetRelaySchemas | undefined
): CompiledProtocols {
  const inbound = inboundProtocol(command, relay?.inbound ?? []);
  const commandTags = new Set(command.variants.map(({ tag }) => tag));
  const relayTags = new Set<string>();
  for (const { tag } of inbound.variants.slice(command.variants.length)) {
    if (tag === null || commandTags.has(tag) || relayTags.has(tag)) {
      throw new TypeError(
        `every relay message needs its own literal "${command.discriminator}", got ${tag}`
      );
    }
    relayTags.add(tag);
  }
  for (const tag of kRoomRequestTags) {
    relayTags.delete(tag);
  }

  return {
    inbound,
    command,
    relayOutbound: relay?.outbound ?? [],
    relayTags,
    bySnapshot: new Map()
  };
}

function inboundProtocol(
  command: MessageProtocol,
  relay: readonly Schema[]
): MessageProtocol {
  const requests = kPartRequests.map((tag) => z.object({
    [command.discriminator]: z.literal(tag),
    parts: kPartIdsSchema
  }));

  return new MessageProtocol(
    z.union([
      ...command.variants.map(({ schema }) => schema),
      ...relay,
      ...requests,
      z.object({
        [command.discriminator]: z.literal(ASSET_ROOM_INLINE_SNAPSHOT)
      })
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
