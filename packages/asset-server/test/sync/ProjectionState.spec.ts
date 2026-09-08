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
  ProjectionState,
  PROJECTION_STATE_PATH
} from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";
import { recordingLogger } from "../helpers/logger.ts";

async function sourceHolding(
  value: unknown
): Promise<MemoryAssetSource> {
  const source = new MemoryAssetSource();
  await source.write(
    PROJECTION_STATE_PATH,
    bytes(JSON.stringify(value))
  );

  return source;
}

describe("ProjectionState — parse", () => {
  test("keeps the entries that parse and counts the rest", () => {
    const { data, dropped } = ProjectionState.parse({
      version: 1,
      checkpoints: {
        a: 4,
        b: "4",
        c: 1.5
      },
      failures: {
        a: { eventId: 4, attempts: 1, reason: "boom" },
        b: { eventId: 4, attempts: 1 }
      }
    });

    assert.deepEqual(data?.checkpoints, { a: 4 });
    assert.deepEqual(data?.failures, {
      a: { eventId: 4, attempts: 1, reason: "boom" }
    });
    assert.strictEqual(dropped, 3);
  });

  test("reads a document with neither section as empty", () => {
    const { data, dropped } = ProjectionState.parse({ version: 1 });

    assert.deepEqual(data?.checkpoints, {});
    assert.deepEqual(data?.failures, {});
    assert.strictEqual(dropped, 0);
  });

  test("refuses a document that is not an object", () => {
    for (const input of [null, undefined, "state", 42, []]) {
      const { data, dropped } = ProjectionState.parse(input);

      assert.strictEqual(data, null);
      assert.strictEqual(dropped, 0);
    }
  });
});

describe("ProjectionState — load", () => {
  test("warns once with the number of entries it dropped", async() => {
    const source = await sourceHolding({
      version: 1,
      checkpoints: {
        a: 4,
        b: "4"
      },
      failures: {}
    });
    const { logger, records } = recordingLogger();

    const state = await ProjectionState.load(source, logger);

    assert.strictEqual(state.checkpoint("a"), 4);
    assert.strictEqual(state.checkpoint("b"), 0);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].level, "warn");
    assert.strictEqual(records[0].metadata.dropped, 1);
  });

  test("stays silent on a clean document", async() => {
    const source = await sourceHolding({
      version: 1,
      checkpoints: { a: 4 },
      failures: {}
    });
    const { logger, records } = recordingLogger();

    await ProjectionState.load(source, logger);

    assert.deepEqual(records, []);
  });

  test("a missing document loads as empty", async() => {
    const state = await ProjectionState.load(new MemoryAssetSource());

    assert.strictEqual(state.checkpoint("a"), 0);
  });
});
