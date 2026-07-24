// Import Internal Dependencies
import type { NetworkEnvelope } from "../types.ts";

export function isNetworkEnvelope(
  value: unknown
): value is NetworkEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("namespace" in value) || !("kind" in value)) {
    return false;
  }

  return typeof value.namespace === "string" && (
    value.kind === "join" ||
    value.kind === "leave" ||
    value.kind === "message" ||
    value.kind === "presence" ||
    value.kind === "sync" ||
    value.kind === "peer-joined" ||
    value.kind === "peer-left" ||
    value.kind === "peer-presence"
  );
}
