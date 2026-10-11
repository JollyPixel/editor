// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import { DistSnapshot } from "../../../server/editors/DistSnapshot.ts";
import {
  BUNDLE,
  INDEX_HTML
} from "../../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kBuiltAt = new Date("2026-01-01T00:00:00.000Z");
const kReadAt = new Date("2026-01-01T02:00:00.000Z");
const kBundle = path.join("assets", "index.js");

describe("DistSnapshot", () => {
  let dist: string;

  beforeEach(async() => {
    dist = await createTempDir("studio-snapshot-");
    await fs.mkdir(path.join(dist, "assets"));
    await fs.writeFile(path.join(dist, kBundle), BUNDLE);
    await fs.writeFile(path.join(dist, "index.html"), INDEX_HTML);
    await fs.utimes(path.join(dist, "index.html"), kBuiltAt, kBuiltAt);
  });

  afterEach(async() => {
    await removeTempDir(dist);
  });

  test("reports no change for the files it was taken with", () => {
    const snapshot = new DistSnapshot(dist);

    assert.deepEqual(
      ["index.html", "assets", kBundle].map((file) => snapshot.update(file)),
      [false, false, false]
    );
  });

  test("reports a rewritten file once, not a read of it", async() => {
    const snapshot = new DistSnapshot(dist);
    const index = path.join(dist, "index.html");

    await fs.utimes(index, kReadAt, kBuiltAt);
    const read = snapshot.update("index.html");
    await fs.utimes(index, kReadAt, kReadAt);

    assert.deepEqual(
      [read, snapshot.update("index.html"), snapshot.update("index.html")],
      [false, true, false]
    );
  });

  test("reports an added and a removed file once each", async() => {
    const snapshot = new DistSnapshot(dist);
    const chunk = path.join("assets", "chunk.js");

    await fs.writeFile(path.join(dist, chunk), BUNDLE);
    const added = [snapshot.update(chunk), snapshot.update(chunk)];
    await fs.rm(path.join(dist, chunk));

    assert.deepEqual(
      [...added, snapshot.update(chunk), snapshot.update(chunk)],
      [true, false, true, false]
    );
  });
});
