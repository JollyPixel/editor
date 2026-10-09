// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { MaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { MaterialLiveSync } from "#src/features/material/collaboration/MaterialLiveSync.ts";
import { createRoomHarness } from "../../../collaboration/roomHarness.ts";
import { createModelFixture } from "../../../fixtures/model.ts";

function createHarness() {
  const room = createRoomHarness();
  room.addPeer("bob");
  const fixture = createModelFixture();
  const glass = fixture.document.addMaterial({ name: "Glass" })!;
  const block = fixture.addBlock({ materialId: glass });
  const sync = new MaterialLiveSync({
    room: room.room,
    document: fixture.document,
    previews: fixture.previews
  });

  return {
    ...room,
    ...fixture,
    glass,
    block,
    sync
  };
}

function streamFromBob(
  harness: ReturnType<typeof createHarness>,
  value: unknown
): void {
  harness.emit("peer-presence", {
    clientId: "bob",
    patch: { materialLive: value }
  });
}

function sent(
  harness: ReturnType<typeof createHarness>
): unknown[] {
  return harness.published
    .filter((patch) => "materialLive" in patch)
    .map((patch) => patch.materialLive);
}

describe("MaterialLiveSync receiving", () => {
  test("shows a peer's dragged fields as that peer's layer until they stop", () => {
    const harness = createHarness();

    streamFromBob(harness, { materialId: harness.glass, changes: { roughness: 0.3 } });

    assert.deepEqual(harness.previews.layer(harness.glass, "bob"), { roughness: 0.3 });
    assert.deepEqual(harness.block.surface, MaterialSurface.create({ roughness: 0.3 }));

    streamFromBob(harness, null);

    assert.equal(harness.previews.layer(harness.glass, "bob"), undefined);
    assert.deepEqual(harness.block.surface, MaterialSurface.create());
    harness.sync.dispose();
  });

  test("keeps a saved stream showing until its command arrives", () => {
    const harness = createHarness();
    streamFromBob(harness, { materialId: harness.glass, changes: { metalness: 0.8 } });

    streamFromBob(harness, { materialId: harness.glass, changes: { metalness: 0.8 }, saved: true });

    assert.deepEqual(harness.block.surface, MaterialSurface.create({ metalness: 0.8 }));
    assert.notEqual(harness.previews.layer(harness.glass, "bob"), undefined);

    harness.document.changeMaterial(harness.glass, { metalness: 0.8 });

    assert.deepEqual(harness.block.surface, MaterialSurface.create({ metalness: 0.8 }));
    assert.equal(harness.previews.layer(harness.glass, "bob"), undefined);
    harness.sync.dispose();
  });

  test("ends a saved stream at once when its command came first", () => {
    const harness = createHarness();
    streamFromBob(harness, { materialId: harness.glass, changes: { metalness: 0.8 } });
    harness.document.changeMaterial(harness.glass, { metalness: 0.8 });

    streamFromBob(harness, { materialId: harness.glass, changes: { metalness: 0.8 }, saved: true });

    assert.deepEqual(harness.block.surface, MaterialSurface.create({ metalness: 0.8 }));
    assert.equal(harness.previews.layer(harness.glass, "bob"), undefined);
    harness.sync.dispose();
  });

  test("drops a saved stream whose command never arrives after 3 seconds", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createHarness();
    streamFromBob(harness, { materialId: harness.glass, changes: { metalness: 0.8 }, saved: true });

    t.mock.timers.tick(2999);
    assert.notEqual(harness.previews.layer(harness.glass, "bob"), undefined);

    t.mock.timers.tick(1);
    assert.equal(harness.previews.layer(harness.glass, "bob"), undefined);
    assert.deepEqual(harness.block.surface, MaterialSurface.create());
    harness.sync.dispose();
  });

  test("drops the stream of a peer who leaves mid-drag", () => {
    const harness = createHarness();
    streamFromBob(harness, { materialId: harness.glass, changes: { opacity: 0.2 } });

    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.equal(harness.previews.layer(harness.glass, "bob"), undefined);
    assert.deepEqual(harness.block.surface, MaterialSurface.create());
    harness.sync.dispose();
  });

  test("ignores a stream with an invalid field", () => {
    const harness = createHarness();

    streamFromBob(harness, { materialId: harness.glass, changes: { opacity: 3 } });
    streamFromBob(harness, { materialId: harness.glass, changes: { shine: 1 } });

    assert.equal(harness.previews.layer(harness.glass, "bob"), undefined);
    assert.deepEqual(harness.block.surface, MaterialSurface.create());
    harness.sync.dispose();
  });
});

describe("MaterialLiveSync sending", () => {
  test("streams this person's layer at most every 50 ms, ending on its latest fields", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const harness = createHarness();

    harness.previews.set(harness.glass, null, { metalness: 0.1 });
    harness.previews.set(harness.glass, null, { metalness: 0.2 });
    harness.previews.set(harness.glass, null, { metalness: 0.3 });
    harness.previews.set(harness.glass, "bob", { roughness: 0.5 });
    assert.deepEqual(sent(harness), [
      { materialId: harness.glass, changes: { metalness: 0.1 } }
    ]);

    t.mock.timers.tick(50);
    assert.deepEqual(sent(harness), [
      { materialId: harness.glass, changes: { metalness: 0.1 } },
      { materialId: harness.glass, changes: { metalness: 0.3 } }
    ]);
    harness.sync.dispose();
  });

  test("ends as saved when the stored surface holds the layer's fields", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const harness = createHarness();

    harness.previews.set(harness.glass, null, { metalness: 0.1 });
    harness.previews.set(harness.glass, null, { metalness: 0.2 });
    harness.document.changeMaterial(harness.glass, { metalness: 0.2 });
    harness.previews.end(harness.glass, null);
    t.mock.timers.tick(50);

    assert.deepEqual(sent(harness), [
      { materialId: harness.glass, changes: { metalness: 0.1 } },
      { materialId: harness.glass, changes: { metalness: 0.2 }, saved: true }
    ]);
    harness.sync.dispose();
  });

  test("ends as dropped when the layer ends without being stored", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const harness = createHarness();

    harness.previews.set(harness.glass, null, { metalness: 0.1 });
    harness.previews.set(harness.glass, null, { metalness: 0.2 });
    harness.previews.end(harness.glass, null);
    t.mock.timers.tick(50);

    assert.deepEqual(sent(harness), [
      { materialId: harness.glass, changes: { metalness: 0.1 } },
      null
    ]);
    harness.sync.dispose();
  });
});
