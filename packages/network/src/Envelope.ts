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
  | { room: string; kind: "peer-presence"; clientId: string; patch: PeerMetadata; };

export type EnvelopeResult<T> =
  | { success: true; data: T; }
  | { success: false; error: string; };

const ENVELOPE_KINDS = [
  "join",
  "leave",
  "message",
  "presence",
  "sync",
  "peer-joined",
  "peer-left",
  "peer-presence"
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
  ): EnvelopeResult<Envelope> {
    let data: unknown = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      }
      catch (error) {
        return {
          success: false,
          error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    const shapeError = describeEnvelopeShapeError(data);
    if (shapeError) {
      return { success: false, error: shapeError };
    }

    return { success: true, data: data as Envelope };
  },

  stringify(
    envelope: Envelope
  ): EnvelopeResult<string> {
    try {
      return { success: true, data: JSON.stringify(envelope) };
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};
