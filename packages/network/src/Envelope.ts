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
  | { room: string; kind: "denied"; event: string; reason: string; };

const ENVELOPE_KINDS = [
  "join",
  "leave",
  "message",
  "presence",
  "sync",
  "peer-joined",
  "peer-left",
  "peer-presence",
  "denied"
] as const;

function describeEnvelopeShapeError(
  value: unknown
): string | null {
  if (typeof value !== "object" || value === null) {
    return `expected an object, received ${typeof value}`;
  }
  if (!("room" in value) || !("kind" in value)) {
    return "missing \"room\" or \"kind\" property";
  }
  if (typeof value.room !== "string") {
    return "\"room\" must be a string";
  }
  if (
    typeof value.kind !== "string" ||
    !(ENVELOPE_KINDS as readonly string[]).includes(value.kind)
  ) {
    return `unrecognized "kind": ${JSON.stringify(value.kind)}`;
  }

  return null;
}

export const Envelope = {
  parse(
    raw: unknown
  ): Result<Envelope, string> {
    let data: unknown = raw;
    if (typeof raw === "string") {
      const parsed = wrap<unknown, Error>(() => JSON.parse(raw));
      if (!parsed.ok) {
        return Err(`invalid JSON: ${parsed.val.message}`);
      }
      data = parsed.unwrap();
    }

    const shapeError = describeEnvelopeShapeError(data);
    if (shapeError) {
      return Err(shapeError);
    }

    return Ok(data as Envelope);
  },

  stringify(
    envelope: Envelope
  ): Result<string, string> {
    const result = wrap<string, Error>(() => JSON.stringify(envelope));

    return result.ok ? result : Err(result.val.message);
  }
};
