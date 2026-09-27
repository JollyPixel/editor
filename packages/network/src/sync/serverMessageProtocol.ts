// Import Internal Dependencies
import { MessageProtocol } from "../protocol/message/MessageProtocol.ts";
import { SNAPSHOT_EVENT } from "../protocol/constants.ts";
import type { JSONSchema } from "../protocol/schema.ts";

export interface ServerMessageProtocolOptions {
  command: MessageProtocol;
  snapshot: JSONSchema;
  notices?: readonly JSONSchema[];
}

function syncVariant(
  title: string,
  type: "snapshot" | "command",
  data: JSONSchema
): JSONSchema {
  return {
    title,
    type: "object",
    properties: {
      type: { const: type },
      data
    },
    required: [
      "type",
      "data"
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
        ...notices
      ]
    },
    {
      discriminator: "type"
    }
  );
}
