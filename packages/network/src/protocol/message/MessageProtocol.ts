// Import Internal Dependencies
import type {
  Infer,
  JSONSchema
} from "../schema.ts";
import {
  InvalidMessageProtocolError
} from "./errors/InvalidMessageProtocolError.ts";

// CONSTANTS
const kDefaultDiscriminator = "action";

export interface MessageVariant {
  readonly event: string;
  readonly tag: string | null;
  readonly schema: JSONSchema;
}

export interface MessageProtocolOptions {
  /**
   * @default "action"
   */
  discriminator?: string;
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

function eventNameOf(
  variant: JSONSchema,
  discriminator: string
): string {
  if (typeof variant.title === "string") {
    return variant.title;
  }

  const value = variant.properties?.[discriminator]?.const;
  if (typeof value !== "string") {
    throw new InvalidMessageProtocolError(
      `every variant must set "title" or a const "${discriminator}" property`
    );
  }

  if (variant.required?.includes(discriminator) !== true) {
    throw new InvalidMessageProtocolError(
      `variant "${value}" must list "${discriminator}" as required`
    );
  }

  return value;
}

function tagOf(
  variant: JSONSchema,
  discriminator: string
): string | null {
  const value = variant.properties?.[discriminator]?.const;

  return typeof value === "string" &&
    variant.required?.includes(discriminator) === true ?
    value :
    null;
}

export class MessageProtocol<
  const TSchema extends JSONSchema = JSONSchema
> {
  static readonly EMPTY: MessageProtocol = new MessageProtocol({
    oneOf: []
  });

  readonly schema: TSchema;
  readonly discriminator: string;

  #variants: readonly MessageVariant[];
  #events: readonly string[];

  constructor(
    schema: TSchema,
    options: MessageProtocolOptions = {}
  ) {
    const {
      discriminator = kDefaultDiscriminator
    } = options;
    const variants = schema.oneOf ?? schema.anyOf ?? [schema];

    this.schema = schema;
    this.discriminator = discriminator;
    this.#variants = Object.freeze(variants.map((variant) => {
      return {
        event: eventNameOf(variant, discriminator),
        tag: tagOf(variant, discriminator),
        schema: variant
      };
    }));
    this.#events = Object.freeze(
      this.#variants.map((variant) => variant.event)
    );
  }

  get variants(): readonly MessageVariant[] {
    return this.#variants;
  }

  get events(): readonly string[] {
    return this.#events;
  }
}

export const OPAQUE_PROTOCOLS: MessageProtocols = {
  inbound: null,
  outbound: null
};

export const NO_MESSAGE_PROTOCOLS: MessageProtocols = {
  inbound: MessageProtocol.EMPTY,
  outbound: MessageProtocol.EMPTY
};
