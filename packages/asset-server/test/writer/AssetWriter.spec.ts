// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { AssetPathEscapeError } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  AssetPathConflictError,
  UnknownAssetKindError
} from "#src/index.ts";
import { syncHarness } from "../helpers/backend.ts";
import { counterHandler } from "../helpers/kinds.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

function lifecycleTypes(
  eventStore: EventStore.EventStore
): string[] {
  return eventStore.reader
    .listAll({ eventTypePrefix: "asset." })
    .map((event) => event.eventType);
}

describe("AssetWriter — create", () => {
  test("appends a created event, records identity and projects the file", async() => {
    await using harness = await syncHarness({ handlers: [counterHandler()] });

    const event = (await harness.writer.create({
      path: "nested/a.counter",
      data: bytes("3"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(event.eventType, ASSET_CREATED);
    assert.strictEqual(harness.identity.byPath("nested/a.counter")?.kind, "counter");
    assert.strictEqual(text(await harness.source.read("nested/a.counter")), "3");
  });

  test("normalizes the path before writing", async() => {
    await using harness = await syncHarness();

    (await harness.writer.create({
      path: "./textures//grass.png",
      data: bytes("g"),
      actor: kActor
    })).unwrap();

    assert.notStrictEqual(harness.identity.byPath("textures/grass.png"), undefined);
  });

  test("returns a traversal as an error without appending", async() => {
    await using harness = await syncHarness();

    const result = await harness.writer.create({
      path: "../outside.png",
      data: bytes("x"),
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof AssetPathEscapeError);
    assert.deepEqual(lifecycleTypes(harness.eventStore), []);
  });

  test("returns the state directory as an error without appending", async() => {
    await using harness = await syncHarness();

    const result = await harness.writer.create({
      path: ".jollypixel/events.db",
      data: bytes("x"),
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof AssetPathEscapeError);
    assert.deepEqual(lifecycleTypes(harness.eventStore), []);
  });

  test("returns an unregistered kind as an error without appending", async() => {
    await using harness = await syncHarness();

    const result = await harness.writer.create({
      path: "a.bin",
      kind: "voxelmap",
      data: bytes("x"),
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof UnknownAssetKindError);
    assert.deepEqual(lifecycleTypes(harness.eventStore), []);
  });

  test("refuses a path already used by another asset", async() => {
    await using harness = await syncHarness();
    const first = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    const result = await harness.writer.create({
      path: "a.png",
      data: bytes("two"),
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof AssetPathConflictError);
    assert.strictEqual(result.val.assetId, first.assetId);
    assert.strictEqual(text(await harness.source.read("a.png")), "one");
  });

  test("suffixes a taken path before the full extension on request", async() => {
    await using harness = await syncHarness();
    for (const path of ["maps/world.voxelmap.json", "maps/world-2.voxelmap.json"]) {
      await harness.writer.create({
        path,
        data: bytes("taken"),
        actor: kActor
      });
    }

    const created = (await harness.writer.create({
      path: "maps/world.voxelmap.json",
      data: bytes("new"),
      actor: kActor,
      onPathConflict: "suffix"
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(
      harness.identity.byId(created.assetId)?.path,
      "maps/world-3.voxelmap.json"
    );
    assert.strictEqual(text(await harness.source.read("maps/world-3.voxelmap.json")), "new");
  });

  test("refuses a path taken by an asset not projected yet", async() => {
    await using harness = await syncHarness();

    const [first, second] = await Promise.all([
      harness.writer.create({
        path: "a.png",
        data: bytes("one"),
        actor: kActor
      }),
      harness.writer.create({
        path: "a.png",
        data: bytes("two"),
        actor: kActor
      })
    ]);

    assert.strictEqual(first.ok, true);
    assert.strictEqual(second.ok, false);
  });

  test("frees the path of a deleted asset", async() => {
    await using harness = await syncHarness();
    const first = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    (await harness.writer.remove({
      assetId: first.assetId,
      actor: kActor
    })).unwrap();

    const result = await harness.writer.create({
      path: "a.png",
      data: bytes("two"),
      actor: kActor
    });

    assert.strictEqual(result.ok, true);
  });

  test("reuses the id the sidecar records for a vacant path", async() => {
    await using harness = await syncHarness();
    harness.identity.set({ id: "kept", path: "a.png", kind: "binary" });

    const event = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    assert.strictEqual(event.assetId, "kept");
  });

  test("never reuses the recorded id of a live asset", async() => {
    await using harness = await syncHarness();
    const live = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    harness.identity.set({ id: live.assetId, path: "b.png", kind: "binary" });

    const event = (await harness.writer.create({
      path: "b.png",
      data: bytes("two"),
      actor: kActor
    })).unwrap();

    assert.notStrictEqual(event.assetId, live.assetId);
    assert.strictEqual(harness.projector.desired(live.assetId)?.path, "a.png");
  });

  test("prefers an explicit id over the recorded one", async() => {
    await using harness = await syncHarness();
    harness.identity.set({ id: "kept", path: "a.png", kind: "binary" });

    const event = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      assetId: "explicit",
      actor: kActor
    })).unwrap();

    assert.strictEqual(event.assetId, "explicit");
  });
});

describe("AssetWriter — rename", () => {
  test("appends a renamed event and moves the file", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    const event = (await harness.writer.rename({
      assetId: created.assetId,
      to: "b.png",
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(event.eventType, ASSET_RENAMED);
    assert.strictEqual(harness.identity.byId(created.assetId)?.path, "b.png");
    assert.deepEqual(await harness.source.list(), ["b.png"]);
  });

  test("refuses a target used by another asset and leaves both files", async() => {
    await using harness = await syncHarness();
    const a = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    const b = (await harness.writer.create({
      path: "b.png",
      data: bytes("two"),
      actor: kActor
    })).unwrap();

    const result = await harness.writer.rename({
      assetId: a.assetId,
      to: "b.png",
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof AssetPathConflictError);
    assert.strictEqual(result.val.assetId, b.assetId);
    assert.strictEqual(text(await harness.source.read("a.png")), "one");
    assert.strictEqual(text(await harness.source.read("b.png")), "two");
  });

  test("returns an unsafe target as an error without appending", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    const result = await harness.writer.rename({
      assetId: created.assetId,
      to: "../b.png",
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof AssetPathEscapeError);
    assert.deepEqual(lifecycleTypes(harness.eventStore), [ASSET_CREATED]);
  });

  test("returns an unknown asset as an error", async() => {
    await using harness = await syncHarness();

    const result = await harness.writer.rename({
      assetId: "ghost",
      to: "b.png",
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
  });
});

describe("AssetWriter — remove", () => {
  test("appends a deleted event and drops the identity", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    const event = (await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    })).unwrap();

    assert.strictEqual(event.eventType, ASSET_DELETED);
    assert.strictEqual(harness.identity.byId(created.assetId), undefined);
  });
});

describe("AssetWriter — ordering", () => {
  test("applies overlapping writes in call order, whatever their size", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.bin",
      data: bytes("0"),
      actor: kActor
    })).unwrap();

    const results = await Promise.all([
      harness.writer.update({
        assetId: created.assetId,
        data: new Uint8Array(4 * 1024 * 1024),
        actor: kActor
      }),
      harness.writer.rename({
        assetId: created.assetId,
        to: "b.bin",
        actor: kActor
      }),
      harness.writer.update({
        assetId: created.assetId,
        data: bytes("1"),
        actor: kActor
      }),
      harness.writer.remove({
        assetId: created.assetId,
        actor: kActor
      })
    ]);

    assert.deepEqual(results.map((result) => result.ok), [true, true, true, true]);
    assert.deepEqual(lifecycleTypes(harness.eventStore), [
      ASSET_CREATED,
      ASSET_UPDATED,
      ASSET_RENAMED,
      ASSET_UPDATED,
      ASSET_DELETED
    ]);
  });
});

describe("AssetWriter input ownership", () => {
  test("captures create and update inputs before queueing", async() => {
    await using harness = await syncHarness();
    const input = {
      path: "original.bin",
      assetId: "original",
      data: Buffer.from("one"),
      dependencies: [{ id: "dependency", kind: "binary" }],
      actor: { type: "user" as const, id: "alice" }
    };
    const created = harness.writer.create(input);
    input.path = "changed.bin";
    input.assetId = "changed";
    input.data.fill(0);
    input.dependencies[0].id = "changed";
    input.actor.id = "bob";

    const creation = (await created).unwrap();
    assert.equal(creation.assetId, "original");
    assert.deepEqual(creation.actor, { type: "user", id: "alice" });
    await harness.projector.flush();
    assert.equal(text(await harness.source.read("original.bin")), "one");
    assert.partialDeepStrictEqual(creation.eventData, {
      dependencies: [{ id: "dependency", kind: "binary" }]
    });

    const update = {
      assetId: "original",
      data: Buffer.from("two"),
      actor: { type: "user" as const, id: "alice" }
    };
    const updated = harness.writer.update(update);
    update.assetId = "changed";
    update.data.fill(0);
    update.actor.id = "bob";

    const event = (await updated).unwrap();
    assert.deepEqual(event.actor, { type: "user", id: "alice" });
    await harness.projector.flush();
    assert.equal(text(await harness.source.read("original.bin")), "two");
  });

  test("captures rename and remove inputs before queueing", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "original.bin",
      assetId: "original",
      data: bytes("one"),
      actor: kActor
    });
    const rename = {
      assetId: "original",
      to: "renamed.bin",
      actor: { type: "user" as const, id: "alice" }
    };
    const renamed = harness.writer.rename(rename);
    rename.assetId = "missing";
    rename.to = "wrong.bin";
    rename.actor.id = "bob";
    const event = (await renamed).unwrap();
    assert.deepEqual(event.actor, { type: "user", id: "alice" });
    assert.equal(harness.projector.desired("original")?.path, "renamed.bin");

    const remove = {
      assetId: "original",
      actor: { type: "user" as const, id: "alice" }
    };
    const removed = harness.writer.remove(remove);
    remove.assetId = "missing";
    remove.actor.id = "bob";
    assert.deepEqual((await removed).unwrap().actor, {
      type: "user",
      id: "alice"
    });
    assert.equal(harness.projector.desired("original"), null);
  });
});
