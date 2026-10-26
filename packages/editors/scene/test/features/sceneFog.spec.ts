// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { switchFogKind } from "../../src/features/environment/sceneFog.ts";

describe("switchFogKind", () => {
  test("keeps the fog color when switching between linear and exponential fog", () => {
    const linear = switchFogKind({ kind: "none" }, "linear");
    assert.strictEqual(linear.kind, "linear");

    const tinted = { ...linear, color: "#123456" };
    const exp2 = switchFogKind(tinted, "exp2");

    assert.strictEqual(exp2.kind === "exp2" && exp2.color, "#123456");
    assert.deepEqual(switchFogKind(exp2, "none"), { kind: "none" });
    assert.strictEqual(switchFogKind(exp2, "exp2"), exp2);
  });
});
