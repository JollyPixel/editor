// Import Third-party Dependencies
import { Validator } from "ata-validator";
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { MessageProtocol } from "./MessageProtocol.ts";
import {
  VALIDATOR_OPTIONS,
  type ValidationError
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

interface CompiledVariant<
  TMessage
> {
  readonly event: string;
  readonly tag: string | null;
  readonly validator: Validator<TMessage>;
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
  #unionKeyword: "oneOf" | "anyOf";
  #byTag = new Map<string, readonly CompiledVariant<TMessage>[]>();
  #untagged: readonly CompiledVariant<TMessage>[];
  #union: Validator<TMessage>;

  constructor(
    protocol: MessageProtocol
  ) {
    this.#discriminator = protocol.discriminator;
    this.#unionKeyword = protocol.schema.oneOf === undefined &&
      protocol.schema.anyOf !== undefined ?
      "anyOf" :
      "oneOf";

    const compiled = protocol.variants.map(({ event, tag, schema }) => {
      return {
        event,
        tag,
        validator: new Validator<TMessage>(
          schema,
          VALIDATOR_OPTIONS
        )
      };
    });
    this.#untagged = compiled.filter((variant) => variant.tag === null);
    for (const [tag, variants] of Map.groupBy(compiled, (variant) => variant.tag)) {
      if (tag !== null) {
        this.#byTag.set(tag, [...variants, ...this.#untagged]);
      }
    }
    this.#union = new Validator<TMessage>(
      protocol.schema,
      VALIDATOR_OPTIONS
    );
  }

  parse(
    payload: unknown
  ): Result<ParsedMessage<TMessage>, readonly ValidationError[]> {
    let parsed: ParsedMessage<TMessage> | undefined;
    for (const { event, validator } of this.#candidatesFor(payload)) {
      if (!validator.isValidObject(payload)) {
        continue;
      }
      if (parsed !== undefined && parsed.event !== event) {
        return Err([
          this.#ambiguityError(parsed.event, event)
        ]);
      }
      parsed ??= {
        event,
        message: payload
      };
    }

    return parsed === undefined ?
      Err(this.#union.validate(payload).errors) :
      Ok(parsed);
  }

  #candidatesFor(
    payload: unknown
  ): readonly CompiledVariant<TMessage>[] {
    if (
      typeof payload !== "object" ||
      payload === null ||
      !Object.hasOwn(payload, this.#discriminator)
    ) {
      return this.#untagged;
    }

    const tag: unknown = Reflect.get(payload, this.#discriminator);

    return typeof tag === "string" ?
      this.#byTag.get(tag) ?? this.#untagged :
      this.#untagged;
  }

  #ambiguityError(
    event: string,
    other: string
  ): ValidationError {
    return {
      keyword: this.#unionKeyword,
      instancePath: "",
      schemaPath: `#/${this.#unionKeyword}`,
      params: {
        events: [event, other]
      },
      message: `matches both "${event}" and "${other}"`
    };
  }
}
