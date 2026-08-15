// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InputActionQuery } from "../src/InputActionQuery.ts";

describe("Controls.InputActionQuery", () => {
  test("recognizes the ANY sentinel", () => {
    const query = new InputActionQuery<string>("ANY");

    assert.strictEqual(query.isAny, true);
    assert.strictEqual(query.isNone, false);
    assert.strictEqual(query.value, null);
  });

  test("recognizes the NONE sentinel", () => {
    const query = new InputActionQuery<string>("NONE");

    assert.strictEqual(query.isAny, false);
    assert.strictEqual(query.isNone, true);
    assert.strictEqual(query.value, null);
  });

  test("wraps a real action value", () => {
    const query = new InputActionQuery<string>("KeyA");

    assert.strictEqual(query.isAny, false);
    assert.strictEqual(query.isNone, false);
    assert.strictEqual(query.value, "KeyA");
  });

  test("match() dispatches to the matching handler", () => {
    const handlers = {
      any: () => true,
      none: () => false,
      value: (action: string) => action === "KeyA"
    };

    assert.strictEqual(
      new InputActionQuery<string>("ANY").match(handlers),
      true
    );
    assert.strictEqual(
      new InputActionQuery<string>("NONE").match(handlers),
      false
    );
    assert.strictEqual(
      new InputActionQuery<string>("KeyA").match(handlers),
      true
    );
    assert.strictEqual(
      new InputActionQuery<string>("KeyB").match(handlers),
      false
    );
  });
});
