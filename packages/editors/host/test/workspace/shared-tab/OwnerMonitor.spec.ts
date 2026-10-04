// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OwnerMonitor } from "#src/workspace/shared-tab/OwnerMonitor.ts";
import {
  DISCOVERY_INTERVAL_MS,
  DISCOVERY_TIMEOUT_MS,
  type OwnerMessage
} from "#src/workspace/shared-tab/protocol.ts";

function createMonitor(
  lock = `workspace-${crypto.randomUUID()}`
) {
  const posted: OwnerMessage[] = [];
  let lost = 0;
  const monitor = new OwnerMonitor({
    channel: {
      postMessage: (message: OwnerMessage) => posted.push(message)
    },
    tab: "tab-a",
    lock,
    onLost: () => lost++
  });

  return {
    monitor,
    posted,
    lost: () => lost
  };
}

async function holdLock(
  name: string
): Promise<() => void> {
  const held = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  void navigator.locks.request(name, () => {
    held.resolve();

    return released.promise;
  });
  await held.promise;

  return released.resolve;
}

async function passLock(
  name: string
): Promise<void> {
  await navigator.locks.request(name, () => undefined);
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

  it("resolves as soon as the owner replies", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
    const { monitor, posted } = createMonitor();

    const discovered = monitor.discover();
    monitor.handle({ type: "owner", tab: "tab-a", owner: "owner-1" });

    assert.strictEqual(await discovered, "owner-1");
    assert.strictEqual(posted.length, 1);
    monitor.stop();
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

  it("reports the owner lost once the owner releases the workspace lock", async() => {
    const lock = `workspace-${crypto.randomUUID()}`;
    const release = await holdLock(lock);
    const { monitor, lost } = createMonitor(lock);
    monitor.handle({ type: "owner", tab: "tab-a", owner: "owner-1" });
    await monitor.discover();
    assert.strictEqual(lost(), 0);

    release();
    await passLock(lock);

    assert.strictEqual(lost(), 1);
  });

  it("withdraws its lock request when stopped", async() => {
    const lock = `workspace-${crypto.randomUUID()}`;
    const release = await holdLock(lock);
    const { monitor, lost } = createMonitor(lock);
    monitor.handle({ type: "owner", tab: "tab-a", owner: "owner-1" });
    await monitor.discover();

    monitor.stop();
    release();
    await passLock(lock);

    assert.strictEqual(lost(), 0);
  });
});
