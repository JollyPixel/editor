// Import Third-party Dependencies
import {
  Ok,
  Err,
  type Result
} from "@openally/result";
import secureJson from "secure-json-parse";

// Import Internal Dependencies
import {
  clientEnvelopeSchema,
  serverEnvelopeSchema
} from "./Envelope.schema.ts";
import { SchemaParser } from "../SchemaParser.ts";
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
const kClientParser = new SchemaParser(clientEnvelopeSchema);
const kServerParser = new SchemaParser(serverEnvelopeSchema);

export type ClientEnvelope = Infer<typeof clientEnvelopeSchema>;
export type ServerEnvelope = Infer<typeof serverEnvelopeSchema>;
export type Envelope = ClientEnvelope | ServerEnvelope;

export type EnvelopeKind = Envelope["kind"];

export type EnvelopeParseError =
  | { reason: "invalid-json"; message: string; }
  | { reason: "malformed"; errors: readonly ValidationError[]; };

type EnvelopeCheck<TEnvelope extends Envelope> = (
  value: unknown
) => Result<TEnvelope, readonly ValidationError[]>;

function envelopeParser<TEnvelope extends Envelope>(
  parseJson: (text: string) => unknown,
  check: EnvelopeCheck<TEnvelope>
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

    const checked = check(value);

    return checked.ok ?
      Ok(checked.val) :
      Err<EnvelopeParseError>({
        reason: "malformed",
        errors: checked.val
      });
  };
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
    parseSecureJson,
    (value) => kClientParser.parse(value)
  ),
  parseServer: envelopeParser(
    parseSecureJson,
    (value) => kServerParser.parse(value)
  ),
  parseTrustedServer: envelopeParser(
    JSON.parse,
    (value) => (isServerEnvelopeShape(value) ?
      Ok(value) :
      kServerParser.parse(value))
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
