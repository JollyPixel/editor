// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SignalEvent } from "../src/index.ts";

describe("SignalEvent", () => {
  test("should call the listeners connected when the emit started", () => {
    const signal = new SignalEvent<[string]>();
    const calls: string[] = [];
    function late(value: string) {
      calls.push(`late:${value}`);
    }
    function first(value: string) {
      calls.push(`first:${value}`);
      signal.disconnect(first);
      signal.connect(late);
    }
    signal.connect(first);
    signal.connect((value) => calls.push(`second:${value}`));

    signal.emit("a");
    signal.emit("b");

    assert.deepStrictEqual(
      calls,
      ["first:a", "second:a", "second:b", "late:b"]
    );
  });
});
