// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  Infer,
  Schema
} from "../schema.ts";
import { SchemaShape } from "./SchemaShape.ts";
import {
  InvalidMessageProtocolError
} from "./errors/InvalidMessageProtocolError.ts";

// CONSTANTS
const kDefaultDiscriminator = "action";
const kEvents = z.registry<{ event: string; }>();

export interface MessageVariant {
  readonly event: string;
  readonly tag: string | null;
  readonly schema: Schema;
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

export function withEvent<
  TSchema extends Schema
>(
  schema: TSchema,
  event: string
): TSchema {
  kEvents.add(schema, { event });

  return schema;
}

function resolveEventName(
  variant: Schema,
  discriminator: string
): string {
  const named = kEvents.get(variant);
  if (named !== undefined) {
    return named.event;
  }

  const tag = readTag(variant, discriminator);
  if (tag !== null) {
    return tag;
  }

  const property = SchemaShape.properties(variant)?.[discriminator];
  if (property !== undefined && SchemaShape.isOptional(property)) {
    throw new InvalidMessageProtocolError(
      `a variant must not make "${discriminator}" optional`
    );
  }

  throw new InvalidMessageProtocolError(
    `every variant must use withEvent() or a literal "${discriminator}" property`
  );
}

function readTag(
  variant: Schema,
  discriminator: string
): string | null {
  const options = SchemaShape.options(variant);
  if (options !== null) {
    const tags = new Set(options.map((option) => readTag(option, discriminator)));
    const [tag] = tags;

    return tags.size === 1 && tag !== undefined ? tag : null;
  }

  const property = SchemaShape.properties(variant)?.[discriminator];
  if (property === undefined || SchemaShape.isOptional(property)) {
    return null;
  }

  const value = SchemaShape.constOf(property);

  return typeof value === "string" ? value : null;
}

export class MessageProtocol<
  const TSchema extends Schema = Schema
> {
  static readonly EMPTY: MessageProtocol = new MessageProtocol(z.union([]));

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
    const variants = SchemaShape.options(schema) ?? [schema];

    this.schema = schema;
    this.discriminator = discriminator;
    this.#variants = Object.freeze(variants.map((variant) => {
      return {
        event: resolveEventName(variant, discriminator),
        tag: readTag(variant, discriminator),
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
