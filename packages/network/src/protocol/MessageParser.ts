// Import Third-party Dependencies
import { Validator } from "ata-validator";
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import {
  discriminatorOf,
  eventNameOf,
  variantsOf,
  type MessageProtocol,
  type MessageProtocols
} from "./MessageProtocol.ts";
import type { ValidationError } from "./schema.ts";

// CONSTANTS
const kValidatorOptions = { useDefaults: false };

export interface ParsedMessage<TMessage> {
  readonly event: string;
  readonly message: TMessage;
}

export interface RoomMessageParser<TMessage> {
  parse(
    payload: unknown
  ): Result<ParsedMessage<TMessage>, readonly ValidationError[]>;
}

export interface MessageParsers<
  TInbound = unknown,
  TOutbound = unknown
> {
  readonly inbound: MessageParser<TInbound> | null;
  readonly outbound: MessageParser<TOutbound> | null;
}

interface MessageVariant<
  TMessage
> {
  readonly event: string;
  readonly validator: Validator<TMessage>;
}

export class MessageParser<
  TMessage = unknown
> implements RoomMessageParser<TMessage> {
  readonly events: readonly string[];

  static fromProtocols<
    TInbound = unknown,
    TOutbound = unknown
  >(
    protocols: MessageProtocols
  ): MessageParsers<TInbound, TOutbound> {
    return {
      inbound: MessageParser.#compile<TInbound>(protocols.inbound),
      outbound: MessageParser.#compile<TOutbound>(protocols.outbound)
    };
  }

  static #compile<
    TMessage
  >(
    protocol: MessageProtocol | null
  ): MessageParser<TMessage> | null {
    return protocol === null ? null : new MessageParser<TMessage>(protocol);
  }

  #variants: readonly MessageVariant<TMessage>[];
  #union: Validator<TMessage>;

  constructor(
    protocol: MessageProtocol
  ) {
    const discriminator = discriminatorOf(protocol);

    this.#variants = variantsOf(protocol.schema).map((variant) => {
      return {
        event: eventNameOf(
          variant,
          discriminator
        ),
        validator: new Validator<TMessage>(
          variant,
          kValidatorOptions
        )
      };
    });
    this.#union = new Validator<TMessage>(
      protocol.schema,
      kValidatorOptions
    );
    this.events = this.#variants.map(
      (variant) => variant.event
    );
  }

  parse(
    payload: unknown
  ): Result<ParsedMessage<TMessage>, readonly ValidationError[]> {
    for (const { event, validator } of this.#variants) {
      if (validator.isValidObject(payload)) {
        return Ok({
          event,
          message: payload
        });
      }
    }

    return Err(
      this.#union.validate(payload).errors
    );
  }
}
