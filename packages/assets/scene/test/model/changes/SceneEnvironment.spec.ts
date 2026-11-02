// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SceneEnvironment } from "#src/index.ts";

describe("SceneEnvironment.switchFog", () => {
  test("keeps the fog color when switching between linear and exponential fog", () => {
    const linear = SceneEnvironment.switchFog({ kind: "none" }, "linear");
    assert.strictEqual(linear.kind, "linear");

    const tinted = { ...linear, color: "#123456" };
    const exp2 = SceneEnvironment.switchFog(tinted, "exp2");

    assert.strictEqual(exp2.kind === "exp2" && exp2.color, "#123456");
    assert.deepEqual(SceneEnvironment.switchFog(exp2, "none"), { kind: "none" });
    assert.strictEqual(SceneEnvironment.switchFog(exp2, "exp2"), exp2);
  });
});
