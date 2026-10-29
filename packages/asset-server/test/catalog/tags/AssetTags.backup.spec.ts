// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  tagHarness,
  TAG_ACTOR
} from "../../helpers/tags/tagHarness.ts";
import { bytes } from "../../helpers/bytes.ts";
import { sha256Hex } from "../../helpers/hash.ts";
import { recordingLogger } from "../../helpers/logger.ts";
import {
  failObjectWrites,
  readBackups,
  readObject
} from "../../helpers/backups.ts";

describe("AssetTags — backups", () => {
  test("a tag and a restore point back up the content they name", async() => {
    await using harness = await tagHarness();
    const { assetId } = harness;
    await harness.increment();
    (await harness.tags.create({
      assetId,
      name: "v1",
      message: "First pass",
      actor: TAG_ACTOR
    })).unwrap();
    await harness.increment();
    await harness.increment();

    const { restorePoint } = (await harness.tags.restore({
      assetId,
      name: "v1",
      actor: TAG_ACTOR
    })).unwrap();

    assert.deepEqual(
      (await readBackups(harness.sync.source)).map(
        ({ assetId: _, size: _size, createdAt: _createdAt, ...entry }) => entry
      ),
      [
        {
          path: "a.counter",
          reason: "tag",
          tag: { name: "v1", message: "First pass" },
          hash: sha256Hex(bytes("1"))
        },
        {
          path: "a.counter",
          reason: "tag",
          tag: {
            name: restorePoint?.name,
            message: "Before restoring \"v1\""
          },
          hash: sha256Hex(bytes("3"))
        }
      ]
    );
    assert.strictEqual(
      await readObject(harness.sync.source, sha256Hex(bytes("3"))),
      "3"
    );
  });

  test("a tag stands when its backup fails", async() => {
    const { logger, records } = recordingLogger();
    await using harness = await tagHarness({ logger });
    using _failing = failObjectWrites(harness.sync.source);

    const created = await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: TAG_ACTOR
    });

    assert.ok(created.ok);
    assert.deepEqual(
      (await harness.tags.list(harness.assetId)).map(({ name }) => name),
      ["v1"]
    );
    assert.deepEqual(
      records.map(({ level, message }) => `${level} ${message}`),
      ["warn tag content not backed up"]
    );
  });
});
