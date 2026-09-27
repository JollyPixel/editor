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

interface CompiledVariant<
  TMessage
> {
  readonly event: string;
  readonly validator: Validator<TMessage>;
}

export class MessageParser<
  TMessage = unknown
> implements RoomMessageParser<TMessage> {
  #variants: readonly CompiledVariant<TMessage>[];
  #union: Validator<TMessage>;

  constructor(
    protocol: MessageProtocol
  ) {
    this.#variants = protocol.variants.map(({ event, schema }) => {
      return {
        event,
        validator: new Validator<TMessage>(schema, VALIDATOR_OPTIONS)
      };
    });
    this.#union = new Validator<TMessage>(
      protocol.schema,
      VALIDATOR_OPTIONS
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
