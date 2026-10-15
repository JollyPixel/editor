// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { PropertyRow } from "../../../src/shared/properties/PropertyRow.ts";
import { PropertyRows } from "../../../src/shared/properties/PropertyRows.ts";

describe("PropertyRows", () => {
  test("round-trips stored values with their types", () => {
    const properties = {
      speed: 12,
      solid: true,
      tag: "door"
    };

    assert.deepEqual(PropertyRows.from(properties).toProperties(), properties);
  });

  test("leaves values it cannot edit out of the rows", () => {
    const properties = {
      nested: { depth: 1 },
      far: Infinity,
      tag: "door"
    };

    assert.deepEqual(PropertyRows.from(properties).toProperties(), { tag: "door" });
    assert.deepEqual(PropertyRows.uneditable(properties), {
      nested: { depth: 1 },
      far: Infinity
    });
  });

  test("drops a blank key, trims keys and lets the last duplicate win", () => {
    const rows = new PropertyRows([
      new PropertyRow("", "orphan"),
      new PropertyRow("   ", "orphan"),
      new PropertyRow(" speed ", 1),
      new PropertyRow("speed", 2)
    ]);

    assert.deepEqual(rows.toProperties(), { speed: 2 });
  });

  test("equals rows that save the same record, ignoring a blank row", () => {
    const rows = PropertyRows.from({ speed: 12 });

    assert.equal(rows.equals(new PropertyRows([...rows, new PropertyRow()])), true);
    assert.equal(rows.equals(PropertyRows.from({ speed: "12" })), false);
    assert.equal(rows.equals(PropertyRows.from({ speed: 12, solid: true })), false);
    assert.equal(rows.equals(new PropertyRows()), false);
  });
});
