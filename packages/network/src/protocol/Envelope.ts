// Import Third-party Dependencies
import {
  Ok,
  Err,
  wrap,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  Peer,
  PeerMetadata
} from "./types.ts";

export type Envelope =
  | { room: string; kind: "join"; identity?: PeerMetadata; }
  | { room: string; kind: "leave"; }
  | { room: string; kind: "message"; payload: unknown; }
  | { room: string; kind: "presence"; patch: PeerMetadata; }
  | { room: string; kind: "sync"; members: Peer[]; }
  | { room: string; kind: "peer-joined"; clientId: string; identity: PeerMetadata; }
  | { room: string; kind: "peer-left"; clientId: string; }
  | { room: string; kind: "peer-presence"; clientId: string; patch: PeerMetadata; }
  | { room: string; kind: "denied"; event: string; reason: string; }
  | { room: string; kind: "error"; event: string; reason: string; };

type EnvelopeCandidate = Record<string, unknown>;

const ENVELOPE_KINDS: readonly Envelope["kind"][] = [
  "join",
  "leave",
  "message",
  "presence",
  "sync",
  "peer-joined",
  "peer-left",
  "peer-presence",
  "denied",
  "error"
] as const;

function parseJson(
  raw: unknown
): Result<unknown, string> {
  if (typeof raw !== "string") {
    return Ok(raw);
  }

  return wrap<unknown, Error>(() => JSON.parse(raw))
    .mapErr((error) => `invalid JSON: ${error.message}`);
}

function assertObject(
  value: unknown
): Result<EnvelopeCandidate, string> {
  return typeof value === "object" && value !== null ?
    Ok(value as EnvelopeCandidate) :
    Err(`expected an object, received ${typeof value}`);
}

function assertHasRoomAndKind(
  value: EnvelopeCandidate
): Result<EnvelopeCandidate, string> {
  return "room" in value && "kind" in value ?
    Ok(value) :
    Err("missing \"room\" or \"kind\" property");
}

function assertRoom(
  value: EnvelopeCandidate
): Result<EnvelopeCandidate, string> {
  return typeof value.room === "string" ?
    Ok(value) :
    Err("\"room\" must be a string");
}

function isEnvelopeKind(
  value: string
): value is Envelope["kind"] {
  return ENVELOPE_KINDS.some((kind) => kind === value);
}

function assertKind(
  value: EnvelopeCandidate
): Result<Envelope, string> {
  return typeof value.kind === "string" && isEnvelopeKind(value.kind) ?
    Ok(value as Envelope) :
    Err(`unrecognized "kind": ${JSON.stringify(value.kind)}`);
}

export const Envelope = {
  parse(
    raw: unknown
  ): Result<Envelope, string> {
    return parseJson(raw)
      .andThen(assertObject)
      .andThen(assertHasRoomAndKind)
      .andThen(assertRoom)
      .andThen(assertKind);
  },

  stringify(
    envelope: Envelope
  ): Result<string, string> {
    return wrap<string, Error>(() => JSON.stringify(envelope))
      .mapErr((error) => error.message);
  }
};
