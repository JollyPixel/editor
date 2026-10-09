// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { ChannelHarness } from "../helpers/transport/ChannelHarness.ts";
import {
  channelAction,
  channelSetup
} from "../helpers/arbitraries/channelActions.ts";

// CONSTANTS
const kRuns = 500;

function isPrefix(
  prefix: readonly string[],
  sequence: readonly string[]
): boolean {
  return prefix.length <= sequence.length &&
    prefix.every((value, index) => value === sequence[index]);
}

describe("ChannelTransport + ChannelTransportHost properties", () => {
  test("sockets relay in order without loss or cross-talk, and both ends close together", async() => {
    await fc.assert(
      fc.asyncProperty(
        channelSetup,
        fc.array(channelAction, { maxLength: 40 }),
        async(setup, actions) => {
          const harness = new ChannelHarness(setup);
          for (const action of actions) {
            harness.apply(action);
          }
          await harness.drain();

          for (const client of harness.clients) {
            const server = harness.serverOf(client);
            const closeIndex = client.events.indexOf("close");
            assert.ok(closeIndex === -1 || closeIndex === client.events.length - 1);

            if (server === undefined) {
              assert.deepStrictEqual(client.received, []);
              continue;
            }

            assert.ok(isPrefix(server.received, client.sent));
            assert.ok(isPrefix(client.received, server.emitted));
            if (!client.closing && !client.closed && !server.closed) {
              assert.deepStrictEqual(server.received, client.sent);
              assert.deepStrictEqual(client.received, server.emitted);
            }
            assert.strictEqual(server.closed, client.closed || client.closing);
          }
        }
      ),
      { numRuns: kRuns }
    );
  });

  test("closing both ends releases every port listener and closes every socket", async() => {
    await fc.assert(
      fc.asyncProperty(
        channelSetup,
        fc.array(channelAction, { maxLength: 40 }),
        async(setup, actions) => {
          const harness = new ChannelHarness(setup);
          for (const action of actions) {
            harness.apply(action);
          }
          await harness.drain();
          harness.apply({ type: "transport-close" });
          harness.apply({ type: "host-close" });
          await harness.drain();

          assert.deepStrictEqual(harness.listeningPorts(), []);
          for (const client of harness.clients) {
            assert.ok(client.closed);
            assert.strictEqual(harness.serverOf(client)?.closed ?? true, true);
          }
        }
      ),
      { numRuns: kRuns }
    );
  });
});
