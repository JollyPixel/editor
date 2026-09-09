// Import Third-party Dependencies
import {
  Ok,
  Err,
  wrap,
  type Result
} from "@openally/result";

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
} from "./schema.ts";

export type ClientEnvelope = Infer<typeof clientEnvelopeSchema>;
export type ServerEnvelope = Infer<typeof serverEnvelopeSchema>;
export type Envelope = ClientEnvelope | ServerEnvelope;

export type EnvelopeKind = Envelope["kind"];

export type EnvelopeParseError =
  | { reason: "invalid-json"; message: string; }
  | { reason: "malformed"; errors: readonly ValidationError[]; };

function isClientEnvelope(
  value: unknown
): value is ClientEnvelope {
  return clientValidator.isValid(value) === true;
}

function isServerEnvelope(
  value: unknown
): value is ServerEnvelope {
  return serverValidator.isValid(value) === true;
}

function malformed(
  errors: readonly ValidationError[]
): EnvelopeParseError {
  return {
    reason: "malformed",
    errors
  };
}

function parseJson(
  raw: unknown
): Result<unknown, EnvelopeParseError> {
  if (typeof raw !== "string") {
    return Ok(raw);
  }

  return wrap<unknown, Error>(() => JSON.parse(raw))
    .mapErr((error): EnvelopeParseError => {
      return {
        reason: "invalid-json",
        message: error.message
      };
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
  parseClient(
    raw: unknown
  ): Result<ClientEnvelope, EnvelopeParseError> {
    return parseJson(raw).andThen((value) => {
      if (isClientEnvelope(value)) {
        return Ok(value);
      }

      return Err(
        malformed(clientValidator.validate(value).errors)
      );
    });
  },

  parseServer(
    raw: unknown
  ): Result<ServerEnvelope, EnvelopeParseError> {
    return parseJson(raw).andThen((value) => {
      if (isServerEnvelope(value)) {
        return Ok(value);
      }

      return Err(
        malformed(serverValidator.validate(value).errors)
      );
    });
  },

  stringify(
    envelope: Envelope
  ): Result<string, string> {
    return wrap<string, Error>(() => JSON.stringify(envelope))
      .mapErr((error) => error.message);
  }
};
