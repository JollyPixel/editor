// Import Internal Dependencies
import {
  JOIN_EVENT,
  PRESENCE_EVENT
} from "../../protocol/constants.ts";

export function refusalReason(
  role: string,
  event: string
): string {
  if (event === JOIN_EVENT) {
    return `role "${role}" is not permitted to join this room`;
  }
  if (event === PRESENCE_EVENT) {
    return `role "${role}" cannot update presence`;
  }

  return `role "${role}" cannot write "${event}"`;
}

export interface MessageReference {
  seq?: number;
  requestId?: string;
}

export function messageReference(
  message: unknown
): MessageReference {
  if (typeof message !== "object" || message === null) {
    return {};
  }

  const reference: MessageReference = {};
  if (
    "seq" in message &&
    typeof message.seq === "number" &&
    Number.isSafeInteger(message.seq) &&
    message.seq >= 0
  ) {
    reference.seq = message.seq;
  }
  if ("requestId" in message && typeof message.requestId === "string") {
    reference.requestId = message.requestId;
  }

  return reference;
}
