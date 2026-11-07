// Import Third-party Dependencies
import {
  Ok,
  Err,
  type Result
} from "@openally/result";
import secureJson from "secure-json-parse";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  clientEnvelopeSchema,
  serverEnvelopeSchema
} from "./Envelope.schema.ts";
import { SchemaParser } from "../SchemaParser.ts";
import {
  decodeFrame,
  encodeFrame,
  isBinaryFrame,
  type Frame,
  type FrameDecodeError,
  type JsonParser,
  type ReceivedFrame
} from "../frame/Frame.ts";
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
  | FrameDecodeError
  | { reason: "malformed"; errors: readonly ValidationError[]; };

type EnvelopeCheck<TEnvelope extends Envelope> = (
  value: unknown
) => Result<TEnvelope, readonly ValidationError[]>;

function envelopeParser<TEnvelope extends Envelope>(
  parseJson: JsonParser,
  check: EnvelopeCheck<TEnvelope>
): (raw: unknown) => Result<TEnvelope, EnvelopeParseError> {
  return (raw) => {
    let value = raw;
    if (isFrame(raw)) {
      const decoded = decodeFrame(raw, parseJson);
      if (!decoded.ok) {
        return decoded;
      }
      value = decoded.val;
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

function isFrame(
  raw: unknown
): raw is ReceivedFrame {
  return typeof raw === "string" || isBinaryFrame(raw);
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
  switch (error.reason) {
    case "invalid-json":
      return `invalid JSON: ${error.message}`;
    case "invalid-frame":
      return `invalid frame: ${error.message}`;
    default:
      return describeErrors(error.errors);
  }
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

  encode(
    envelope: Envelope
  ): Result<Frame, string> {
    try {
      return Ok(encodeFrame(envelope));
    }
    catch (error) {
      return Err(errorMessage(error));
    }
  }
};
