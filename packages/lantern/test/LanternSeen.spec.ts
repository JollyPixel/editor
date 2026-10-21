// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { LanternSeen } from "#src/LanternSeen.ts";
import { tour } from "./helpers/tours.ts";

describe("LanternSeen", () => {
  test("stores the recorded version under the tour id", () => {
    const storage = new MemoryStorageAdapter();
    new LanternSeen(storage).record(tour(undefined, { version: 3 }));

    assert.equal(storage.get("jolly-pixel:lantern:test.tour"), "3");
  });

  test("counts a tour as seen up to the recorded version", () => {
    const seen = new LanternSeen(new MemoryStorageAdapter());
    assert.equal(seen.has(tour(undefined, { version: 2 })), false);

    seen.record(tour(undefined, { version: 2 }));

    assert.equal(seen.has(tour(undefined, { version: 1 })), true);
    assert.equal(seen.has(tour(undefined, { version: 2 })), true);
    assert.equal(seen.has(tour(undefined, { version: 3 })), false);
  });

  test("ignores a stored value that is not a version", () => {
    const storage = new MemoryStorageAdapter();
    storage.set("jolly-pixel:lantern:test.tour", "yes");

    assert.equal(new LanternSeen(storage).has(tour()), false);
  });

  test("forgets only the tours it is given", () => {
    const seen = new LanternSeen(new MemoryStorageAdapter());
    const first = tour(undefined, { id: "a.first" });
    const second = tour(undefined, { id: "a.second" });
    seen.record(first);
    seen.record(second);

    seen.forget(first);

    assert.equal(seen.has(first), false);
    assert.equal(seen.has(second), true);
  });
});
