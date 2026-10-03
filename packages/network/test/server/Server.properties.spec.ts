// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { Server } from "#src/index.ts";
import { Envelope } from "#src/protocol/envelope/Envelope.ts";
import { identityOf } from "../helpers/server/identity.ts";
import {
  createClient,
  withoutSync
} from "../helpers/server/clientHandle.ts";
import { captureLogger } from "../helpers/captureLogger.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { clientEnvelope } from "../helpers/arbitraries/envelopes.ts";
import { jsonPayload } from "../helpers/arbitraries/json.ts";

// CONSTANTS
const kRoom = "room";
const kEnvelopeKeys = [
  "room",
  "kind",
  "payload",
  "patch",
  "profile",
  "presence"
];

const kBrokenEnvelope = fc.tuple(
  clientEnvelope,
  fc.constantFrom(...kEnvelopeKeys),
  fc.option(jsonPayload, { nil: undefined })
).map(([envelope, key, value]) => JSON.stringify({
  ...envelope,
  room: kRoom,
  [key]: value
}));

const kRejectedFrame = fc.oneof(
  fc.string(),
  fc.json(),
  kBrokenEnvelope
).filter((raw) => !Envelope.parseClient(raw).ok);

describe("Server properties", () => {
  test("a rejected frame reaches no extension, answers nothing and keeps the session usable", async() => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(kRejectedFrame, { maxLength: 8 }),
        async(frames) => {
          const { logger, errors } = captureLogger();
          const server = new Server({ logger });
          const extension = new RecordingExtension(kRoom);
          server.register(extension);
          const { client, sent } = createClient("A");
          server.handleConnect(client, identityOf(client));
          await server.handleMessage("A", JSON.stringify({ room: kRoom, kind: "join" }));

          for (const frame of frames) {
            await server.handleMessage("A", frame);
          }

          assert.deepStrictEqual(extension.connected, ["A"]);
          assert.deepStrictEqual(extension.messages, []);
          assert.deepStrictEqual(extension.disconnected, []);
          assert.deepStrictEqual(withoutSync(sent), []);
          assert.deepStrictEqual(errors, []);

          await server.handleMessage("A", JSON.stringify({
            room: kRoom,
            kind: "message",
            payload: "still here"
          }));
          assert.deepStrictEqual(extension.messages, [
            { clientId: "A", payload: "still here" }
          ]);
          await server.close();
        }
      )
    );
  });
});
