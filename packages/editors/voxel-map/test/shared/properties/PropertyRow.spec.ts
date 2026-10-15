// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  PropertyRow,
  type PropertyType,
  type PropertyValue
} from "../../../src/shared/properties/PropertyRow.ts";

describe("PropertyRow", () => {
  test("reads its type from the value", () => {
    assert.equal(new PropertyRow("tag", "door").type, "string");
    assert.equal(new PropertyRow("speed", 12).type, "number");
    assert.equal(new PropertyRow("solid", false).type, "boolean");
  });

  test("starts as an empty text row", () => {
    const row = new PropertyRow();

    assert.equal(row.key, "");
    assert.equal(row.value, "");
  });

  test("keeps the key and the other field when patched", () => {
    const row = new PropertyRow("speed", 12);

    assert.deepEqual(row.with({ key: "pace" }), new PropertyRow("pace", 12));
    assert.deepEqual(row.with({ value: 3 }), new PropertyRow("speed", 3));
  });

  const kConversions: Array<[PropertyValue, PropertyType, PropertyValue]> = [
    ["12.5", "number", 12.5],
    [" 4 ", "number", 4],
    ["door", "number", 0],
    [true, "number", 1],
    [false, "number", 0],
    ["TRUE", "boolean", true],
    ["door", "boolean", false],
    [2, "boolean", true],
    [0, "boolean", false],
    [12, "string", "12"],
    [true, "string", "true"],
    ["door", "string", "door"]
  ];

  for (const [value, type, expected] of kConversions) {
    test(`retypes ${JSON.stringify(value)} to ${type} as ${JSON.stringify(expected)}`, () => {
      const row = new PropertyRow("key", value).retype(type);

      assert.equal(row.key, "key");
      assert.equal(row.type, type);
      assert.equal(row.value, expected);
    });
  }
});
