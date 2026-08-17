// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  quatEquals,
  quatHasChanged,
  vectorValueEquals,
  vectorValueHasChanged
} from "../../src/math/equals.ts";
import { Mixed } from "../../src/field/mixed.ts";

describe("Math.equals.quatEquals", () => {
  test("compares all four components", () => {
    const a = { x: 0, y: 0, z: 0, w: 1 };

    assert.ok(quatEquals(a, { x: 0, y: 0, z: 0, w: 1 }));
    assert.equal(quatEquals(a, { x: 0, y: 0, z: 0, w: 0.9 }), false);
  });
});

describe("Math.equals.vectorValueEquals", () => {
  test("whole-value Mixed only equals itself", () => {
    assert.ok(vectorValueEquals(Mixed, Mixed));
    assert.equal(vectorValueEquals(Mixed, { x: 0, y: 0 }), false);
  });

  test("a Mixed axis differs from any concrete axis", () => {
    assert.equal(
      vectorValueEquals(
        { x: Mixed, y: 1 },
        { x: 0, y: 1 }
      ),
      false
    );
  });

  test("a Mixed axis equals only a Mixed axis", () => {
    assert.ok(
      vectorValueEquals(
        { x: Mixed, y: 1 },
        { x: Mixed, y: 1 }
      )
    );
  });

  test("concrete records compare component-wise", () => {
    assert.ok(vectorValueEquals({ x: 1, y: 2 }, { x: 1, y: 2 }));
    assert.equal(
      vectorValueEquals({ x: 1, y: 2 }, { x: 1, y: 3 }),
      false
    );
  });
});

describe("Math.equals.vectorValueHasChanged", () => {
  test("a fresh but structurally equal record is not a change", () => {
    assert.equal(
      vectorValueHasChanged({ x: 1, y: 2 }, { x: 1, y: 2 }),
      false
    );
  });

  test("a differing record is a change", () => {
    assert.ok(
      vectorValueHasChanged({ x: 1, y: 2 }, { x: 1, y: 3 })
    );
  });

  test("falls back to identity when either side is not a record", () => {
    assert.equal(vectorValueHasChanged(Mixed, Mixed), false);
    assert.ok(vectorValueHasChanged(Mixed, { x: 1, y: 2 }));
    assert.equal(vectorValueHasChanged(undefined, undefined), false);
  });
});

describe("Math.equals.quatHasChanged", () => {
  test("a fresh but structurally equal quaternion is not a change", () => {
    assert.equal(
      quatHasChanged(
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: 0, w: 1 }
      ),
      false
    );
  });

  test("undefined defaults fall back to identity", () => {
    assert.equal(quatHasChanged(undefined, undefined), false);
  });
});
