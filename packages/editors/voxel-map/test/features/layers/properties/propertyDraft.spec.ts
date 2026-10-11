// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  parsePropertyRows,
  createPropertyRows
} from "../../../../src/features/layers/properties/propertyDraft.ts";

describe("createPropertyRows", () => {
  test("renders every value as text, whatever its stored type", () => {
    assert.deepEqual(
      createPropertyRows({
        speed: 12,
        solid: true,
        tag: "door"
      }),
      [
        { key: "speed", value: "12" },
        { key: "solid", value: "true" },
        { key: "tag", value: "door" }
      ]
    );
  });

  test("treats a missing bag as no rows", () => {
    assert.deepEqual(createPropertyRows(undefined), []);
  });
});

describe("parsePropertyRows", () => {
  test("folds the rows back into a record", () => {
    assert.deepEqual(
      parsePropertyRows([
        { key: "speed", value: "12" },
        { key: "tag", value: "door" }
      ]),
      {
        speed: "12",
        tag: "door"
      }
    );
  });

  test("drops a blank key instead of storing it", () => {
    assert.deepEqual(
      parsePropertyRows([
        { key: "", value: "orphan" },
        { key: "   ", value: "orphan" },
        { key: "speed", value: "12" }
      ]),
      { speed: "12" }
    );
  });

  test("trims a key and lets the last duplicate win", () => {
    assert.deepEqual(
      parsePropertyRows([
        { key: " speed ", value: "1" },
        { key: "speed", value: "2" }
      ]),
      { speed: "2" }
    );
  });
});
