// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { StoredChoice } from "../../src/state/StoredChoice.ts";

// CONSTANTS
const kKey = "test:choice";

function makeChoice(
  storage: MemoryStorageAdapter
): StoredChoice<"on" | "off"> {
  return new StoredChoice({
    key: kKey,
    values: ["on", "off"],
    fallback: "off",
    storage
  });
}

describe("StoredChoice", () => {
  test("falls back for a missing or unknown stored value", () => {
    const storage = new MemoryStorageAdapter();
    assert.equal(makeChoice(storage).value, "off");

    storage.set(kKey, "maybe");
    assert.equal(makeChoice(storage).value, "off");
  });

  test("saves a change and announces it once", () => {
    const storage = new MemoryStorageAdapter();
    const choice = makeChoice(storage);
    const changes: string[] = [];
    choice.subscribe("change", (value) => changes.push(value));

    choice.value = "on";
    choice.value = "on";

    assert.deepEqual(changes, ["on"]);
    assert.equal(makeChoice(storage).value, "on");
  });
});
