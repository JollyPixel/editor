// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { syncHarness } from "../helpers/backend.ts";
import { bytes, text } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("AssetProjector — lifecycle events land on the source", () => {
  test("a create writes the file", async() => {
    await using harness = await syncHarness();

    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("a.png")),
      "hello"
    );
  });

  test("an update overwrites the file", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    await harness.writer.update({
      assetId: created.assetId,
      data: bytes("two"),
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("a.png")),
      "two"
    );
  });

  test("a rename moves the projected file", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();
    await harness.writer.rename({
      assetId: created.assetId,
      to: "renamed/b.png",
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("renamed/b.png")),
      "hello"
    );
    assert.strictEqual(
      (await harness.source.list()).includes("a.png"),
      false
    );
  });

  test("a projected asset is read back from its file, not held", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();
    await harness.source.write("a.png", bytes("on disk"));

    assert.strictEqual(
      text((await harness.projector.read(created.assetId))!),
      "on disk"
    );
  });

  test("an asset waiting for its write is read from the event", async() => {
    await using harness = await syncHarness();
    harness.source.write = () => Promise.reject(new Error("disk full"));

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(harness.projector.pending, 1);
    assert.strictEqual(
      text((await harness.projector.read(created.assetId))!),
      "hello"
    );
  });

  test("a rename before the first write never touches the old path", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.writer.rename({
      assetId: created.assetId,
      to: "b.png",
      actor: kActor
    });
    await harness.projector.flush();

    const listed = await harness.source.list();
    assert.strictEqual(listed.includes("a.png"), false);
    assert.strictEqual(listed.includes("b.png"), true);
  });

  test("a delete removes the file", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();
    await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });
    await harness.projector.flush();

    await assert.rejects(() => harness.source.read("a.png"));
  });

  test("markProjected records state without writing", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor,
      alreadyProjected: true
    })).unwrap();
    await harness.projector.flush();

    await assert.rejects(() => harness.source.read("a.png"));
    assert.strictEqual(harness.projector.pending, 0);
    assert.strictEqual(
      harness.state.checkpoint(created.assetId),
      created.eventId
    );
  });
});
