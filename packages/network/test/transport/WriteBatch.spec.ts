// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { WriteBatch } from "#src/transport/WriteBatch.ts";

class CountingStream {
  corked = 0;
  flushes = 0;

  cork(): void {
    this.corked++;
  }

  uncork(): void {
    this.corked--;
    if (this.corked === 0) {
      this.flushes++;
    }
  }
}

describe("WriteBatch", () => {
  test("holds a stream corked for the rest of the turn and releases it once", async() => {
    const batch = new WriteBatch();
    const first = new CountingStream();
    const second = new CountingStream();

    batch.hold(first);
    batch.hold(first);
    batch.hold(second);

    assert.deepEqual([first.corked, second.corked], [1, 1]);

    await setImmediate();

    assert.deepEqual([first.corked, first.flushes], [0, 1]);
    assert.deepEqual([second.corked, second.flushes], [0, 1]);
  });

  test("holds again in a later turn after releasing", async() => {
    const batch = new WriteBatch();
    const stream = new CountingStream();

    batch.hold(stream);
    await setImmediate();
    batch.hold(stream);
    await setImmediate();

    assert.deepEqual([stream.corked, stream.flushes], [0, 2]);
  });

  test("flush releases held streams without waiting for the turn to end", () => {
    const batch = new WriteBatch();
    const stream = new CountingStream();

    batch.hold(stream);
    batch.flush();

    assert.deepEqual([stream.corked, stream.flushes], [0, 1]);
  });
});
