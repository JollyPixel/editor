// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  AssetPathConflictError,
  UnknownAssetKindError
} from "#src/index.ts";
import { syncHarness } from "../helpers/backend.ts";
import {
  counterHandler,
  ownerHandler
} from "../helpers/kinds.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

function createdPaths(
  eventStore: EventStore.EventStore
): string[] {
  return eventStore.reader
    .listAll({ eventTypePrefix: ASSET_CREATED })
    .map((event) => (event.eventData as { path: string; }).path);
}

describe("AssetWriter — create without content", () => {
  test("writes the serialized default state of the kind", async() => {
    await using harness = await syncHarness({ handlers: [counterHandler()] });

    (await harness.writer.create({
      path: "a.counter",
      kind: "counter",
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(text(await harness.source.read("a.counter")), "0");
  });

  test("returns an unregistered kind as an error without appending", async() => {
    await using harness = await syncHarness();

    const result = await harness.writer.create({
      path: "a.voxelmap.json",
      kind: "voxelmap",
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof UnknownAssetKindError);
    assert.deepEqual(createdPaths(harness.eventStore), []);
  });

  test("creates each companion beside the owner, then the linked owner", async() => {
    await using harness = await syncHarness({
      handlers: [ownerHandler(), counterHandler()]
    });

    const owner = (await harness.writer.create({
      path: "maps/world.owner",
      kind: "owner",
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    const companion = harness.identity.byPath("maps/world.counter");
    assert.strictEqual(companion?.kind, "counter");
    assert.deepEqual(createdPaths(harness.eventStore), [
      "maps/world.counter",
      "maps/world.owner"
    ]);
    assert.strictEqual(text(await harness.source.read("maps/world.counter")), "0");
    assert.strictEqual(
      text(await harness.source.read("maps/world.owner")),
      companion.id
    );
    assert.deepEqual(
      (owner.eventData as { dependencies: unknown; }).dependencies,
      [{ id: companion.id, kind: "binary" }]
    );
  });

  test("creates no companion for an asset given content", async() => {
    await using harness = await syncHarness({
      handlers: [ownerHandler(), counterHandler()]
    });

    (await harness.writer.create({
      path: "maps/world.owner",
      kind: "owner",
      data: bytes(""),
      actor: kActor
    })).unwrap();

    assert.deepEqual(createdPaths(harness.eventStore), ["maps/world.owner"]);
  });

  test("suffixes the owner and its companions together on request", async() => {
    await using harness = await syncHarness({
      handlers: [ownerHandler(), counterHandler()]
    });
    (await harness.writer.create({
      path: "maps/world.counter",
      data: bytes("7"),
      actor: kActor
    })).unwrap();

    (await harness.writer.create({
      path: "maps/world.owner",
      kind: "owner",
      onPathConflict: "suffix",
      actor: kActor
    })).unwrap();

    assert.deepEqual(createdPaths(harness.eventStore), [
      "maps/world.counter",
      "maps/world-2.counter",
      "maps/world-2.owner"
    ]);
  });

  test("refuses a taken companion path without appending", async() => {
    await using harness = await syncHarness({
      handlers: [ownerHandler(), counterHandler()]
    });
    (await harness.writer.create({
      path: "maps/world.counter",
      data: bytes("7"),
      actor: kActor
    })).unwrap();

    const result = await harness.writer.create({
      path: "maps/world.owner",
      kind: "owner",
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof AssetPathConflictError);
    assert.deepEqual(createdPaths(harness.eventStore), ["maps/world.counter"]);
  });

  test("returns an unregistered companion kind as an error without appending", async() => {
    await using harness = await syncHarness({
      handlers: [ownerHandler(["ghost"])]
    });

    const result = await harness.writer.create({
      path: "maps/world.owner",
      kind: "owner",
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.val instanceof UnknownAssetKindError);
    assert.deepEqual(createdPaths(harness.eventStore), []);
  });

  test("appends nothing when the owner cannot serialize its default state", async() => {
    await using harness = await syncHarness({
      handlers: [
        {
          ...ownerHandler(),
          serialize: () => Promise.reject(new Error("no default state"))
        },
        counterHandler()
      ]
    });

    const result = await harness.writer.create({
      path: "maps/world.owner",
      kind: "owner",
      actor: kActor
    });

    assert.strictEqual(result.ok, false);
    assert.match(result.val.message, /no default state/);
    assert.deepEqual(createdPaths(harness.eventStore), []);
    assert.strictEqual(harness.identity.byPath("maps/world.counter"), undefined);
  });
});
