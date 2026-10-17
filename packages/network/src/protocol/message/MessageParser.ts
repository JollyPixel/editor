// Import Third-party Dependencies
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  MessageProtocol,
  MessageVariant
} from "./MessageProtocol.ts";
import { VariantGroup } from "./VariantGroup.ts";
import { SchemaParser } from "../SchemaParser.ts";
import type {
  Schema,
  ValidationError
} from "../schema.ts";

export interface ParsedMessage<TMessage> {
  readonly event: string;
  readonly message: TMessage;
}

export interface RoomMessageParser<TMessage> {
  parse(
    payload: unknown
  ): Result<ParsedMessage<TMessage>, readonly ValidationError[]>;
}

// CONSTANTS
const kParsers = new WeakMap<MessageProtocol, MessageParser>();

interface CompiledVariant extends MessageVariant {
  readonly parser: SchemaParser<Schema>;
}

export class MessageParser<
  TMessage = unknown
> implements RoomMessageParser<TMessage> {
  static of<TMessage = unknown>(
    protocol: MessageProtocol
  ): MessageParser<TMessage> {
    let parser = kParsers.get(protocol);
    if (parser === undefined) {
      parser = new MessageParser(protocol);
      kParsers.set(protocol, parser);
    }

    return parser as MessageParser<TMessage>;
  }

  #discriminator: string;
  #byTag = new Map<string, VariantGroup<CompiledVariant>>();
  #untagged: readonly CompiledVariant[];
  #union: SchemaParser<Schema> | null;

  constructor(
    protocol: MessageProtocol
  ) {
    this.#discriminator = protocol.discriminator;

    const compiled = protocol.variants.map((variant) => {
      return {
        ...variant,
        parser: new SchemaParser(variant.schema)
      };
    });
    this.#untagged = compiled.filter((variant) => variant.tag === null);
    for (const [tag, variants] of Map.groupBy(compiled, (variant) => variant.tag)) {
      if (tag !== null) {
        this.#byTag.set(tag, new VariantGroup(
          variants,
          this.#untagged,
          this.#discriminator
        ));
      }
    }
    this.#union = compiled.length === 0 ?
      null :
      new SchemaParser(protocol.schema);
  }

  parse(
    payload: unknown
  ): Result<ParsedMessage<TMessage>, readonly ValidationError[]> {
    let parsed: ParsedMessage<TMessage> | undefined;
    for (const { event, parser } of this.#candidatesFor(payload)) {
      if (!parser.is(payload)) {
        continue;
      }
      if (parsed !== undefined && parsed.event !== event) {
        return Err([
          this.#ambiguityError(parsed.event, event)
        ]);
      }
      parsed ??= {
        event,
        message: payload as TMessage
      };
    }

    if (parsed !== undefined) {
      return Ok(parsed);
    }

    if (this.#union === null) {
      return Err([this.#noVariantError()]);
    }

    const union = this.#union.parse(payload);

    return Err(union.ok ? [] : union.val);
  }

  identify(
    payload: unknown
  ): string | null {
    const candidates = this.#candidatesFor(payload);

    return candidates.length === 1 ? candidates[0].event : null;
  }

  #candidatesFor(
    payload: unknown
  ): readonly CompiledVariant[] {
    if (
      typeof payload !== "object" ||
      payload === null ||
      !Object.hasOwn(payload, this.#discriminator)
    ) {
      return this.#untagged;
    }

    const tag: unknown = Reflect.get(payload, this.#discriminator);

    const group = typeof tag === "string" ? this.#byTag.get(tag) : undefined;

    return group?.candidatesFor(payload) ?? this.#untagged;
  }

  #noVariantError(): ValidationError {
    return {
      instancePath: "",
      message: "accepts no message"
    };
  }

  #ambiguityError(
    event: string,
    other: string
  ): ValidationError {
    return {
      instancePath: "",
      message: `matches both "${event}" and "${other}"`
    };
  }
}
