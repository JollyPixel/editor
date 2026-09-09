// Import Internal Dependencies
import { SNAPSHOT_EVENT } from "./constants.ts";
import type {
  Infer,
  JSONSchema
} from "./schema.ts";

// CONSTANTS
const kDefaultDiscriminator = "action";

export class InvalidMessageProtocolError extends Error {}

export interface MessageProtocol<
  TSchema extends JSONSchema = JSONSchema
> {
  readonly schema: TSchema;
  readonly discriminator?: string;
}

export interface MessageProtocols {
  readonly inbound: MessageProtocol | null;
  readonly outbound: MessageProtocol | null;
}

export type InferMessage<
  TProtocol extends MessageProtocol
> = Infer<
  TProtocol["schema"]
>;

export const OPAQUE_PROTOCOLS: MessageProtocols = {
  inbound: null,
  outbound: null
};

export const NO_MESSAGES: MessageProtocol = {
  schema: { oneOf: [] }
};

export const NO_MESSAGE_PROTOCOLS: MessageProtocols = {
  inbound: NO_MESSAGES,
  outbound: NO_MESSAGES
};

export function defineMessageProtocol<
  TSchema extends JSONSchema
>(
  protocol: MessageProtocol<TSchema>
): MessageProtocol<TSchema> {
  return protocol;
}

export function discriminatorOf(
  protocol: MessageProtocol
): string {
  return protocol.discriminator ?? kDefaultDiscriminator;
}

export function variantsOf(
  schema: JSONSchema
): readonly JSONSchema[] {
  const composed = schema.oneOf ?? schema.anyOf;

  return composed === undefined ? [schema] : composed;
}

export function eventNameOf(
  variant: JSONSchema,
  discriminator: string
): string {
  if (typeof variant.title === "string") {
    return variant.title;
  }

  const property = variant.properties?.[discriminator];
  const value = property?.const;
  if (typeof value !== "string") {
    throw new InvalidMessageProtocolError(
      `every variant must set "title" or a const "${discriminator}" property`
    );
  }

  const required = variant.required;
  if (required === undefined || !required.includes(discriminator)) {
    throw new InvalidMessageProtocolError(
      `variant "${value}" must list "${discriminator}" as required`
    );
  }

  return value;
}

export function protocolEvents(
  protocol: MessageProtocol
): readonly string[] {
  const discriminator = discriminatorOf(protocol);

  return variantsOf(protocol.schema).map(
    (variant) => eventNameOf(variant, discriminator)
  );
}

export interface ServerMessageProtocolOptions {
  command: MessageProtocol;
  snapshot: JSONSchema;
}

export function serverMessageProtocol(
  options: ServerMessageProtocolOptions
): MessageProtocol {
  const { command, snapshot } = options;
  const discriminator = discriminatorOf(command);

  return {
    discriminator: "type",
    schema: {
      oneOf: [
        {
          title: SNAPSHOT_EVENT,
          type: "object",
          properties: {
            type: { const: "snapshot" },
            data: snapshot
          },
          required: [
            "type",
            "data"
          ]
        },
        ...variantsOf(command.schema).map((variant): JSONSchema => {
          return {
            title: eventNameOf(variant, discriminator),
            type: "object",
            properties: {
              type: { const: "command" },
              data: variant
            },
            required: [
              "type",
              "data"
            ]
          };
        })
      ]
    }
  };
}
