// Import Third-party Dependencies
import {
  Ok,
  Err,
  wrap,
  type Result
} from "@openally/result";
import secureJson from "secure-json-parse";

// Import Internal Dependencies
import * as clientValidator from "./generated/client.compiled.ts";
import * as serverValidator from "./generated/server.compiled.ts";
import type {
  clientEnvelopeSchema,
  serverEnvelopeSchema
} from "./Envelope.schema.ts";
import {
  describeErrors,
  type Infer,
  type ValidationError
} from "../schema.ts";

// CONSTANTS
const kJsonParseOptions: secureJson.ParseOptions = {
  protoAction: "remove",
  constructorAction: "remove"
};

export type ClientEnvelope = Infer<typeof clientEnvelopeSchema>;
export type ServerEnvelope = Infer<typeof serverEnvelopeSchema>;
export type Envelope = ClientEnvelope | ServerEnvelope;

export type EnvelopeKind = Envelope["kind"];

export type EnvelopeParseError =
  | { reason: "invalid-json"; message: string; }
  | { reason: "malformed"; errors: readonly ValidationError[]; };

interface CompiledValidator {
  isValid(
    value: unknown
  ): boolean;
  validate(
    value: unknown
  ): { readonly errors: readonly ValidationError[]; };
}

function parseJson(
  raw: unknown
): Result<unknown, EnvelopeParseError> {
  if (typeof raw !== "string") {
    return Ok(raw);
  }

  return wrap<unknown, Error>(() => secureJson.parse(raw, kJsonParseOptions))
    .mapErr((error): EnvelopeParseError => {
      return {
        reason: "invalid-json",
        message: error.message
      };
    });
}

function envelopeParser<TEnvelope extends Envelope>(
  validator: CompiledValidator
): (raw: unknown) => Result<TEnvelope, EnvelopeParseError> {
  function isEnvelope(
    value: unknown
  ): value is TEnvelope {
    return validator.isValid(value) === true;
  }

  return (raw) => parseJson(raw).andThen((value) => {
    if (isEnvelope(value)) {
      return Ok(value);
    }

    return Err<EnvelopeParseError>({
      reason: "malformed",
      errors: validator.validate(value).errors
    });
  });
}

export function describeEnvelopeParseError(
  error: EnvelopeParseError
): string {
  return error.reason === "invalid-json" ?
    `invalid JSON: ${error.message}` :
    describeErrors(error.errors);
}

export const Envelope = {
  parseClient: envelopeParser<ClientEnvelope>(clientValidator),
  parseServer: envelopeParser<ServerEnvelope>(serverValidator),

  stringify(
    envelope: Envelope
  ): Result<string, string> {
    return wrap<string, Error>(() => JSON.stringify(envelope))
      .mapErr((error) => error.message);
  }
};
