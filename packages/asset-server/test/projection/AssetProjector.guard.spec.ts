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
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import { sha256Hex } from "../helpers/hash.ts";
import {
  failObjectWrites,
  readBackups,
  readObject
} from "../helpers/objects/backups.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

async function projectedAsset(
  harness: SyncHarness
): Promise<string> {
  const { assetId } = (await harness.writer.create({
    path: "a.txt",
    data: bytes("one"),
    actor: kActor
  })).unwrap();
  await harness.projector.flush();

  return assetId;
}

async function update(
  harness: SyncHarness,
  assetId: string,
  content: string
): Promise<void> {
  (await harness.writer.update({
    assetId,
    data: bytes(content),
    actor: kActor
  })).unwrap();
  await harness.projector.flush();
}

describe("AssetProjector — external edits", () => {
  test("backs up an external edit before overwriting it", async() => {
    await using harness = await syncHarness();
    const assetId = await projectedAsset(harness);
    await update(harness, assetId, "two");

    assert.deepEqual(await readBackups(harness.source), []);

    await harness.source.write("a.txt", bytes("external"));
    await update(harness, assetId, "three");

    const hash = sha256Hex(bytes("external"));
    assert.strictEqual(text(await harness.source.read("a.txt")), "three");
    assert.strictEqual(await readObject(harness.source, hash), "external");
    assert.deepEqual(
      (await readBackups(harness.source)).map(({ createdAt: _, ...entry }) => entry),
      [
        {
          assetId,
          path: "a.txt",
          reason: "external-edit",
          hash,
          size: 8
        }
      ]
    );
  });

  const removals = [
    {
      title: "moving its file",
      remove: (harness: SyncHarness, assetId: string) => harness.writer.rename({
        assetId,
        to: "b.txt",
        actor: kActor
      })
    },
    {
      title: "deleting its file",
      remove: (harness: SyncHarness, assetId: string) => harness.writer.remove({
        assetId,
        actor: kActor
      })
    }
  ];
  for (const { title, remove } of removals) {
    test(`backs up an external edit before ${title}`, async() => {
      await using harness = await syncHarness();
      const assetId = await projectedAsset(harness);
      await harness.source.write("a.txt", bytes("external"));

      (await remove(harness, assetId)).unwrap();
      await harness.projector.flush();

      assert.strictEqual(await harness.source.exists("a.txt"), false);
      assert.deepEqual(
        (await readBackups(harness.source)).map((entry) => entry.path),
        ["a.txt"]
      );
      assert.strictEqual(
        await readObject(harness.source, sha256Hex(bytes("external"))),
        "external"
      );
    });
  }

  test("a failed backup leaves a move unapplied", async() => {
    await using harness = await syncHarness();
    const assetId = await projectedAsset(harness);
    await harness.source.write("a.txt", bytes("external"));

    {
      using _failing = failObjectWrites(harness.source);
      (await harness.writer.rename({
        assetId,
        to: "b.txt",
        actor: kActor
      })).unwrap();
      await harness.projector.flush();

      assert.strictEqual(await harness.source.exists("b.txt"), false);
      assert.strictEqual(text(await harness.source.read("a.txt")), "external");
    }

    await harness.projector.flush();

    assert.strictEqual(await harness.source.exists("a.txt"), false);
    assert.strictEqual(await harness.source.exists("b.txt"), true);
  });

  test("a failed backup blocks the write until a later flush", async() => {
    await using harness = await syncHarness();
    const assetId = await projectedAsset(harness);
    await harness.source.write("a.txt", bytes("external"));

    {
      using _failing = failObjectWrites(harness.source);
      await update(harness, assetId, "two");

      assert.strictEqual(text(await harness.source.read("a.txt")), "external");
      assert.match(harness.state.failure(assetId)?.reason ?? "", /disk full/);
    }

    await harness.projector.flush();

    assert.strictEqual(text(await harness.source.read("a.txt")), "two");
    assert.strictEqual(harness.state.failure(assetId), undefined);
    assert.deepEqual(
      (await readBackups(harness.source)).map((entry) => entry.hash),
      [sha256Hex(bytes("external"))]
    );
  });
});
