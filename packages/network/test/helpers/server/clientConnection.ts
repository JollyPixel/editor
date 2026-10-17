// Import Internal Dependencies
import type { ClientConnection } from "#src/index.ts";
import { ConnectedClient } from "#src/server/connection/ConnectedClient.ts";
import {
  describeEnvelopeParseError,
  Envelope,
  type ServerEnvelope
} from "#src/protocol/envelope/Envelope.ts";

export interface RecordingClient {
  client: ConnectedClient;
  sent: unknown[];
}

export function createConnection(
  id: string,
  receive: (data: unknown) => void = () => void 0
): ClientConnection {
  return {
    id,
    sendSerialized: (json) => receive(JSON.parse(json)),
    close: () => void 0
  };
}

export function createClient(
  id: string
): RecordingClient {
  const sent: unknown[] = [];

  return {
    client: new ConnectedClient(
      createConnection(id, (data) => sent.push(data))
    ),
    sent
  };
}

export function toServerEnvelope(
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
