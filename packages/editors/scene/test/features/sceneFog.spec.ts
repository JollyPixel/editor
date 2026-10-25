// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { fogOfKind } from "../../src/features/environment/sceneFog.ts";

describe("fogOfKind", () => {
  test("keeps the fog color when switching between linear and exponential fog", () => {
    const linear = fogOfKind("linear", { kind: "none" });
    assert.strictEqual(linear.kind, "linear");

    const tinted = { ...linear, color: "#123456" };
    const exp2 = fogOfKind("exp2", tinted);

    assert.strictEqual(exp2.kind === "exp2" && exp2.color, "#123456");
    assert.deepEqual(fogOfKind("none", exp2), { kind: "none" });
    assert.strictEqual(fogOfKind("exp2", exp2), exp2);
  });
});
