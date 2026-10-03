// Import Internal Dependencies
import type { ClientHandle } from "#src/index.ts";
import {
  describeEnvelopeParseError,
  Envelope,
  type ServerEnvelope
} from "#src/protocol/envelope/Envelope.ts";

export interface RecordingClient {
  client: ClientHandle;
  sent: unknown[];
}

export function createClient(
  id: string
): RecordingClient {
  const sent: unknown[] = [];

  return {
    client: {
      id,
      send: (data) => sent.push(data)
    },
    sent
  };
}

export function serverEnvelopeOf(
  data: unknown
): ServerEnvelope {
  const result = Envelope.parseServer(data);
  if (!result.ok) {
    throw new Error(describeEnvelopeParseError(result.val));
  }

  return result.val;
}

export function withoutSync(
  sent: unknown[]
): unknown[] {
  return sent.filter((data) => {
    const result = Envelope.parseServer(data);

    return !result.ok || result.val.kind !== "sync";
  });
}
