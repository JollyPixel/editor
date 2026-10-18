// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OptionGroups } from "../../src/controls/OptionGroups.ts";

describe("Controls.OptionGroups", () => {
  test("splits consecutive options sharing a group into one run", () => {
    const groups = [...new OptionGroups([
      { value: "one", label: "one", group: "A" },
      { value: "two", label: "two" },
      { value: "three", label: "three", group: "A" },
      { value: "four", label: "four", group: "A" }
    ])];

    assert.deepEqual(groups.map((group) => group.label), ["A", "", "A"]);
    assert.deepEqual(groups.map((group) => group.indices), [[0], [1], [2, 3]]);
  });
});
