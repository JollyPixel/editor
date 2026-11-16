// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EnvironmentSwitch } from "#src/index.ts";

describe("EnvironmentSwitch.fog", () => {
  test("keeps the fog color when switching between linear and exponential fog", () => {
    const linear = EnvironmentSwitch.fog({ kind: "none" }, "linear");
    assert.strictEqual(linear.kind, "linear");

    const tinted = { ...linear, color: "#123456" };
    const exp2 = EnvironmentSwitch.fog(tinted, "exp2");

    assert.strictEqual(exp2.kind === "exp2" && exp2.color, "#123456");
    assert.deepEqual(EnvironmentSwitch.fog(exp2, "none"), { kind: "none" });
    assert.strictEqual(EnvironmentSwitch.fog(exp2, "exp2"), exp2);
  });
});

describe("EnvironmentSwitch.glow", () => {
  test("starts a default glow and keeps an existing one", () => {
    const glow = EnvironmentSwitch.glow(null, true);
    assert.deepEqual(glow, { strength: 1, radius: 0.4 });

    assert.strictEqual(EnvironmentSwitch.glow(glow, true), glow);
    assert.strictEqual(EnvironmentSwitch.glow(glow, false), null);
  });
});

describe("EnvironmentSwitch.sun", () => {
  test("starts a sun above the scene and keeps an existing one", () => {
    const sun = EnvironmentSwitch.sun(null, true);
    assert.ok(sun !== null && sun.elevation > 0);

    assert.strictEqual(EnvironmentSwitch.sun(sun, true), sun);
    assert.strictEqual(EnvironmentSwitch.sun(sun, false), null);
  });
});
