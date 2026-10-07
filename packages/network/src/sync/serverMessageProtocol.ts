// Import Internal Dependencies
import { MessageProtocol } from "../protocol/message/MessageProtocol.ts";
import {
  CATCH_UP_EVENT,
  SNAPSHOT_EVENT
} from "../protocol/constants.ts";
import type { JSONSchema } from "../protocol/schema.ts";

// CONSTANTS
const kAcksSchema = {
  type: "object",
  additionalProperties: {
    type: "integer",
    minimum: 0
  }
} as const;
const kVersionSchema = {
  type: "integer",
  minimum: 0
} as const;
const kRefusedSchema = {
  type: "integer",
  minimum: 0
} as const;

export interface ServerMessageProtocolOptions {
  command: MessageProtocol;
  snapshot: JSONSchema;
  notices?: readonly JSONSchema[];
}

type SyncMessageType = "snapshot" | "command" | "correction";

const kSyncOptionalProperties: Record<
  SyncMessageType,
  Record<string, JSONSchema>
> = {
  snapshot: {
    version: kVersionSchema,
    acks: kAcksSchema,
    refused: kRefusedSchema
  },
  command: {
    version: kVersionSchema
  },
  correction: {
    acks: kAcksSchema,
    refused: kRefusedSchema
  }
};

function syncVariant(
  title: string,
  type: SyncMessageType,
  data: JSONSchema
): JSONSchema {
  return {
    title,
    type: "object",
    properties: {
      type: { const: type },
      data,
      ...kSyncOptionalProperties[type]
    },
    required: [
      "type",
      "data"
    ]
  };
}

function catchUpVariant(
  command: MessageProtocol
): JSONSchema {
  const items = command.variants.length === 0 ?
    {} :
    { anyOf: command.variants.map(({ schema }) => schema) };

  return {
    title: CATCH_UP_EVENT,
    type: "object",
    properties: {
      type: { const: "catch-up" },
      data: {
        type: "array",
        items
      },
      version: kVersionSchema,
      acks: kAcksSchema
    },
    required: [
      "type",
      "data",
      "version"
    ]
  };
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
    {
      oneOf: [
        syncVariant(SNAPSHOT_EVENT, "snapshot", snapshot),
        ...command.variants.map(
          ({ event, schema }) => syncVariant(event, "command", schema)
        ),
        ...command.variants.map(
          ({ event, schema }) => syncVariant(event, "correction", schema)
        ),
        catchUpVariant(command),
        ...notices
      ]
    },
    {
      discriminator: "type"
    }
  );
}
