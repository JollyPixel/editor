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

  test("returns the same frozen list until an entry changes", () => {
    const scrollback = new Scrollback();
    const { id } = scrollback.append("echo", "a");
    const before = scrollback.entries;

    assert.equal(scrollback.entries, before);
    assert.ok(Object.isFrozen(before));

    scrollback.updatePending(id, true);
    const pending = scrollback.entries;
    scrollback.append("info", "b");
    const appended = scrollback.entries;
    scrollback.clear();

    assert.notEqual(pending, before);
    assert.notEqual(appended, pending);
    assert.deepEqual(scrollback.entries, []);
    assert.deepEqual(before.map((entry) => entry.text), ["a"]);
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

  test("browses from a recall until a push or stopBrowsing", () => {
    const history = new InputHistory();
    history.push("a");
    assert.equal(history.browsing, false);

    history.previous("");
    assert.equal(history.browsing, true);
    history.stopBrowsing();
    assert.equal(history.browsing, false);

    history.next();
    assert.equal(history.browsing, true);
    history.push("b");
    assert.equal(history.browsing, false);
    assert.equal(history.size, 2);
  });

  test("a recall past either end does not start browsing", () => {
    const history = new InputHistory();

    assert.equal(history.previous("draft"), null);
    assert.equal(history.next(), null);
    assert.equal(history.browsing, false);
  });
});
