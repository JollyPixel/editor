// Import Third-party Dependencies
import {
  Ok,
  Err,
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
import { errorMessage } from "../../errorMessage.ts";

// CONSTANTS
const kJsonParseOptions: secureJson.ParseOptions = {
  protoAction: "remove",
  constructorAction: "remove"
};
const kServerEnvelopeKinds: Record<ServerEnvelope["kind"], true> = {
  message: true,
  sync: true,
  "peer-joined": true,
  "peer-left": true,
  "peer-presence": true,
  "peer-profile": true,
  denied: true,
  error: true
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

type EnvelopeGuard<TEnvelope extends Envelope> = (
  value: unknown
) => value is TEnvelope;

function envelopeParser<TEnvelope extends Envelope>(
  validator: CompiledValidator,
  parseJson: (text: string) => unknown,
  isEnvelope: EnvelopeGuard<TEnvelope>
): (raw: unknown) => Result<TEnvelope, EnvelopeParseError> {
  return (raw) => {
    let value = raw;
    if (typeof raw === "string") {
      try {
        value = parseJson(raw);
      }
      catch (error) {
        return Err<EnvelopeParseError>({
          reason: "invalid-json",
          message: errorMessage(error)
        });
      }
    }

    if (isEnvelope(value)) {
      return Ok(value);
    }

    return Err<EnvelopeParseError>({
      reason: "malformed",
      errors: validator.validate(value).errors
    });
  };
}

function validEnvelope<TEnvelope extends Envelope>(
  validator: CompiledValidator
): EnvelopeGuard<TEnvelope> {
  return (value): value is TEnvelope => validator.isValid(value) === true;
}

function parseSecureJson(
  text: string
): unknown {
  return secureJson.parse(text, kJsonParseOptions);
}

function isServerEnvelopeShape(
  value: unknown
): value is ServerEnvelope {
  return typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "room") === "string" &&
    Object.hasOwn(kServerEnvelopeKinds, String(Reflect.get(value, "kind")));
}

export function unknownEnvelopeKind(
  envelope: never
): never {
  throw new Error(`unknown envelope kind in ${JSON.stringify(envelope)}`);
}

export function describeEnvelopeParseError(
  error: EnvelopeParseError
): string {
  return error.reason === "invalid-json" ?
    `invalid JSON: ${error.message}` :
    describeErrors(error.errors);
}

export const Envelope = {
  parseClient: envelopeParser(
    clientValidator,
    parseSecureJson,
    validEnvelope<ClientEnvelope>(clientValidator)
  ),
  parseServer: envelopeParser(
    serverValidator,
    parseSecureJson,
    validEnvelope<ServerEnvelope>(serverValidator)
  ),
  parseTrustedServer: envelopeParser(
    serverValidator,
    JSON.parse,
    isServerEnvelopeShape
  ),

  stringify(
    envelope: Envelope
  ): Result<string, string> {
    try {
      return Ok(JSON.stringify(envelope));
    }
    catch (error) {
      return Err(errorMessage(error));
    }
  }
};
