// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { identityOf } from "../../helpers/server/identity.ts";
import {
  type AssetExtension,
  client,
  harness
} from "../../helpers/server/dynamicRooms.ts";
import type { ServerConnection } from "#src/index.ts";

// CONSTANTS
const kRoom = "pixelart:asset-1";
const kGraceMs = 1_000;
const kClients = ["A", "B", "C"];

type EvictionAction =
  | { type: "join" | "leave" | "disconnect"; client: string; }
  | { type: "tick"; ms: number; };

class EvictionModel {
  readonly members = new Set<string>();
  now = 0;
  live = false;
  created = 0;
  evicted = 0;
  emptySince: number | null = null;

  apply(
    action: EvictionAction
  ): void {
    switch (action.type) {
      case "join":
        if (!this.live) {
          this.live = true;
          this.created++;
        }
        this.members.add(action.client);
        this.emptySince = null;
        break;
      case "tick":
        this.now += action.ms;
        if (
          this.live &&
          this.emptySince !== null &&
          this.now - this.emptySince >= kGraceMs
        ) {
          this.live = false;
          this.evicted++;
          this.emptySince = null;
        }
        break;
      default:
        if (this.members.delete(action.client) && this.members.size === 0) {
          this.emptySince = this.now;
        }
    }
  }
}

const kAction: fc.Arbitrary<EvictionAction> = fc.oneof(
  fc.record({
    type: fc.constantFrom("join", "leave", "disconnect"),
    client: fc.constantFrom(...kClients)
  }),
  fc.record({
    type: fc.constant("tick"),
    ms: fc.integer({ min: 0, max: 1_500 })
  })
);

describe("room eviction properties", () => {
  test("an empty resolved room is evicted after the grace period and disposed exactly once", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    await fc.assert(
      fc.asyncProperty(
        fc.array(kAction, { maxLength: 20 }),
        async(actions) => {
          const { server, created, evicted, extensions } = harness({ graceMs: kGraceMs });
          const model = new EvictionModel();
          const connected = new Map<string, ServerConnection>();
          const instances = new Set<AssetExtension>();

          for (const action of actions) {
            model.apply(action);
            if (action.type === "tick") {
              t.mock.timers.tick(action.ms);
            }
            else if (action.type === "join") {
              let connection = connected.get(action.client);
              if (connection === undefined) {
                connection = server.connect(client(action.client), identityOf(action.client));
                connected.set(action.client, connection);
              }
              await connection.receive({ room: kRoom, kind: "join" });
            }
            else if (action.type === "leave") {
              await connected.get(action.client)?.receive({ room: kRoom, kind: "leave" });
            }
            else {
              const connection = connected.get(action.client);
              connected.delete(action.client);
              await connection?.close();
            }
            await setImmediate();
            const current = extensions.get(kRoom);
            if (current !== undefined) {
              instances.add(current);
            }

            assert.strictEqual(created.length, model.created);
            assert.strictEqual(evicted.length, model.evicted);
            assert.strictEqual(
              [...instances].filter((extension) => extension.disposed === 1).length,
              model.evicted
            );
          }

          await server.close();
          assert.strictEqual(evicted.length, created.length);
          assert.strictEqual(instances.size, created.length);
          assert.ok([...instances].every((extension) => extension.disposed === 1));
        }
      )
    );
  });
});
