// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  MessageProtocol,
  withEvent
} from "../protocol/message/MessageProtocol.ts";
import {
  CATCH_UP_EVENT,
  SNAPSHOT_EVENT
} from "../protocol/constants.ts";
import type { Schema } from "../protocol/schema.ts";

// CONSTANTS
const kNonNegativeInt = z.int().check(z.minimum(0));
const kAcksSchema = z.record(z.string(), kNonNegativeInt);

export interface ServerMessageProtocolOptions {
  command: MessageProtocol;
  snapshot: Schema;
  notices?: readonly Schema[];
}

type SyncMessageType = "snapshot" | "command" | "correction";

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

export function serverMessageProtocol(
  options: ServerMessageProtocolOptions
): MessageProtocol {
  const {
    command,
    snapshot,
    notices = []
  } = options;

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
      ...notices
    ]),
    {
      discriminator: "type"
    }
  );
}
