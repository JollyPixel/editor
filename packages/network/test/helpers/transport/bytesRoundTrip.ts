// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Client } from "#src/index.ts";
import type { RecordingExtension } from "../server/RecordingExtension.ts";
import { waitFor } from "../waitFor.ts";

export async function assertBytesRoundTrip(
  client: Client,
  extension: RecordingExtension,
  length = 3
): Promise<void> {
  const room = client.room("test-ns");
  let received: unknown;
  room.on("message", (payload) => {
    received = payload;
  });
  room.join();
  await waitFor(() => client.ready && extension.clients.length > 0, 10_000);

  const upload = Uint8Array.from({ length }, (_, index) => index % 256);
  const snapshot = upload.toReversed();
  const before = extension.messages.length;
  room.send({ content: upload });
  await waitFor(() => extension.messages.length > before, 10_000);
  extension.clients.at(-1)?.send({ snapshot });
  await waitFor(() => received !== undefined, 10_000);

  assert.deepEqual(extension.messages.at(-1)?.payload, { content: upload });
  assert.deepEqual(received, { snapshot });
}
