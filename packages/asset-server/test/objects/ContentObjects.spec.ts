// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  MemoryAssetSource,
  writeJsonFile
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { ContentObjects } from "#src/objects/index.ts";
import { bytes } from "../helpers/bytes.ts";
import { sha256Hex } from "../helpers/hash.ts";
import { recordingLogger } from "../helpers/logger.ts";
import {
  BACKUP_LEDGER,
  readBackups,
  readObject
} from "../helpers/objects/backups.ts";

describe("ContentObjects", () => {
  test("keeps one object per content and records every backup", async() => {
    const source = new MemoryAssetSource();
    const objects = new ContentObjects(source);
    const data = bytes("pixels");

    await objects.store(data, {
      assetId: "a1",
      path: "a.pixelart",
      reason: "tag",
      tag: { name: "v1", message: "First pass" }
    });
    await new ContentObjects(source).store(data, {
      assetId: "a1",
      path: "b.pixelart",
      reason: "external-edit"
    });

    const hash = sha256Hex(data);
    assert.strictEqual(await readObject(source, hash), "pixels");
    assert.deepEqual(
      (await readBackups(source)).map(({ createdAt: _, ...entry }) => entry),
      [
        {
          assetId: "a1",
          path: "a.pixelart",
          reason: "tag",
          tag: { name: "v1", message: "First pass" },
          hash,
          size: 6
        },
        {
          assetId: "a1",
          path: "b.pixelart",
          reason: "external-edit",
          hash,
          size: 6
        }
      ]
    );
  });

  test("drops malformed ledger entries with a warning", async() => {
    const source = new MemoryAssetSource();
    const kept = {
      hash: "ab12",
      size: 1,
      assetId: "a1",
      path: "a.txt",
      reason: "tag",
      tag: { name: "v1" },
      createdAt: "2026-10-11T12:00:00.000Z"
    };
    await writeJsonFile(source, BACKUP_LEDGER, {
      version: 1,
      entries: [
        kept,
        { ...kept, reason: "unknown" },
        { hash: "cd34" }
      ]
    });
    const { logger, records } = recordingLogger();

    const objects = new ContentObjects(source, logger);
    await objects.store(bytes("x"), {
      assetId: "a2",
      path: "b.txt",
      reason: "external-edit"
    });

    assert.deepEqual(
      (await readBackups(source)).map((entry) => entry.assetId),
      ["a1", "a2"]
    );
    assert.deepEqual(
      records.map(({ level, message, metadata }) => {
        return { level, message, dropped: metadata.dropped };
      }),
      [{ level: "warn", message: "state file entries dropped", dropped: 2 }]
    );
  });
});
