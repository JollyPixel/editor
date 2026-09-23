// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OwnerMonitor } from "#src/workspace/shared-tab/OwnerMonitor.ts";
import {
  DISCOVERY_INTERVAL_MS,
  DISCOVERY_TIMEOUT_MS,
  HEARTBEAT_MS,
  OWNER_LOSS_MS,
  type OwnerMessage
} from "#src/workspace/shared-tab/protocol.ts";

function createMonitor() {
  const posted: OwnerMessage[] = [];
  let lost = 0;
  const monitor = new OwnerMonitor({
    channel: {
      postMessage: (message: OwnerMessage) => posted.push(message)
    },
    tab: "tab-a",
    onLost: () => lost++
  });

  return {
    monitor,
    posted,
    lost: () => lost
  };
}

describe("OwnerMonitor", () => {
  it("says hello until an owner replies", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
    const { monitor, posted } = createMonitor();

    const discovered = monitor.discover();
    t.mock.timers.tick(DISCOVERY_INTERVAL_MS);
    await Promise.resolve();
    monitor.handle({ type: "owner", tab: "tab-a", owner: "owner-1" });
    t.mock.timers.tick(DISCOVERY_INTERVAL_MS);
    await discovered;
    monitor.stop();

    assert.strictEqual(monitor.owner, "owner-1");
    assert.deepEqual(posted, [
      { type: "hello", tab: "tab-a" },
      { type: "hello", tab: "tab-a" }
    ]);
  });

  it("rejects when no owner replies in time", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
    const { monitor } = createMonitor();

    const discovered = monitor.discover();
    for (let elapsed = 0; elapsed <= DISCOVERY_TIMEOUT_MS; elapsed += DISCOVERY_INTERVAL_MS) {
      t.mock.timers.tick(DISCOVERY_INTERVAL_MS);
      await Promise.resolve();
    }

    await assert.rejects(discovered, /did not respond/);
  });

  it("reports the owner lost once when it announces stopping", () => {
    const { monitor, lost } = createMonitor();
    monitor.handle({ type: "owner", tab: "tab-a", owner: "owner-1" });

    monitor.handle({ type: "stopping", tab: "*", owner: "other" });
    assert.strictEqual(lost(), 0);

    monitor.handle({ type: "stopping", tab: "*", owner: "owner-1" });
    monitor.handle({ type: "stopping", tab: "*", owner: "owner-1" });
    assert.strictEqual(lost(), 1);
  });

  it("reports the owner lost when heartbeats stop", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
    const { monitor, lost } = createMonitor();
    monitor.handle({ type: "owner", tab: "tab-a", owner: "owner-1" });
    await monitor.discover();

    t.mock.timers.tick(OWNER_LOSS_MS - HEARTBEAT_MS);
    monitor.handle({ type: "heartbeat", tab: "*", owner: "owner-1" });
    t.mock.timers.tick(OWNER_LOSS_MS - HEARTBEAT_MS);
    assert.strictEqual(lost(), 0);

    t.mock.timers.tick(HEARTBEAT_MS * 2);
    assert.strictEqual(lost(), 1);
  });
});
