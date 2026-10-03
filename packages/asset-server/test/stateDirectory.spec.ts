// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  ensureStateGitignore,
  STATE_GITIGNORE_PATH
} from "#src/stateDirectory.ts";
import {
  bytes,
  text
} from "./helpers/bytes.ts";

describe("ensureStateGitignore", () => {
  test("writes every state entry into a new file", async() => {
    const source = new MemoryAssetSource();

    await ensureStateGitignore(source);

    assert.strictEqual(
      text(await source.read(STATE_GITIGNORE_PATH)),
      "state.json\nevents.db\nevents.db-journal\nevents.db-wal\nevents.db-shm\n"
    );
  });

  test("appends the entries an older file lacks and keeps its own", async() => {
    const source = new MemoryAssetSource();
    await source.write(
      STATE_GITIGNORE_PATH,
      bytes("state.json\r\nevents.db\r\nevents.db-journal\r\nevents.db-wal\r\nmine")
    );

    await ensureStateGitignore(source);

    assert.strictEqual(
      text(await source.read(STATE_GITIGNORE_PATH)),
      "state.json\r\nevents.db\r\nevents.db-journal\r\nevents.db-wal\r\nmine\nevents.db-shm\n"
    );
  });

  test("leaves a complete file untouched", async() => {
    const source = new MemoryAssetSource();
    await ensureStateGitignore(source);
    let writes = 0;
    const write = source.write.bind(source);
    source.write = (path, data) => {
      writes++;

      return write(path, data);
    };

    await ensureStateGitignore(source);

    assert.strictEqual(writes, 0);
  });
});
