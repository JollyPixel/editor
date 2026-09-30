// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InputHistory } from "#src/execution/InputHistory.ts";
import { Scrollback } from "#src/execution/Scrollback.ts";

describe("Scrollback", () => {
  test("keeps the newest entries up to its capacity", () => {
    const scrollback = new Scrollback(3);
    for (let index = 1; index <= 5; index++) {
      scrollback.append("info", String(index));
    }

    assert.deepEqual(scrollback.entries.map((entry) => entry.text), ["3", "4", "5"]);
    assert.equal(new Scrollback().capacity, 500);
  });

  test("entries have unique ids and cannot be mutated through the list", () => {
    const scrollback = new Scrollback();
    const first = scrollback.append("echo", "a");
    scrollback.append("info", "b");

    scrollback.updatePending(first.id, true);

    assert.equal(first.pending, false);
    assert.equal(scrollback.entries[0].pending, true);
    assert.notEqual(scrollback.entries[0].id, scrollback.entries[1].id);
  });
});

describe("InputHistory", () => {
  test("walks back and forward, restoring the draft past the newest input", () => {
    const history = new InputHistory();
    history.push("a");
    history.push("b");

    assert.equal(history.previous("draft"), "b");
    assert.equal(history.previous("b"), "a");
    assert.equal(history.previous("a"), null);
    assert.equal(history.next(), "b");
    assert.equal(history.next(), "draft");
    assert.equal(history.next(), null);
  });

  test("skips blank lines and consecutive duplicates", () => {
    const history = new InputHistory();
    history.push("a");
    history.push("a");
    history.push("  ");
    history.push("b");

    assert.deepEqual(history.entries, ["a", "b"]);
  });

  test("keeps the newest inputs up to its capacity", () => {
    const history = new InputHistory(2);
    history.push("a");
    history.push("b");
    history.push("c");

    assert.deepEqual(history.entries, ["b", "c"]);
    assert.equal(new InputHistory().capacity, 100);
  });

  test("a push resets the cursor to the newest input", () => {
    const history = new InputHistory();
    history.push("a");
    history.push("b");
    history.previous("");
    history.previous("");

    history.push("c");

    assert.equal(history.previous(""), "c");
  });
});
