// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EditorStore } from "#src/state/EditorStore.ts";

type CounterEvents = {
  change: (value: number) => void;
};

describe("EditorStore", () => {
  test("watch delivers events until its unsubscribe runs", () => {
    const store = new EditorStore<CounterEvents>();
    const received: number[] = [];

    const unwatch = store.watch("change", (value) => received.push(value));
    store.emit("change", 1);
    unwatch();
    store.emit("change", 2);

    assert.deepStrictEqual(received, [1]);
    assert.strictEqual(store.listenerCount("change"), 0);
  });
});
