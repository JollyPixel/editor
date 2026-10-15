// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ViewGlow,
  type GlowTarget
} from "#src/scene/ViewGlow.ts";
import { ViewSettingsStore } from "#src/state/index.ts";

describe("ViewGlow", () => {
  test("runs the glow pass only while a material glows", () => {
    const target: GlowTarget = { postProcessing: null };
    let glows = false;
    const glow = new ViewGlow({
      target,
      view: new ViewSettingsStore(),
      glows: () => glows
    });
    assert.equal(target.postProcessing, null);

    glows = true;
    glow.update();
    assert.notEqual(target.postProcessing, null);

    glows = false;
    glow.update();
    assert.equal(target.postProcessing, null);
  });

  test("keeps the same glow pass when the glow setting is switched", () => {
    const target: GlowTarget = { postProcessing: null };
    const view = new ViewSettingsStore();
    const glow = new ViewGlow({
      target,
      view,
      glows: () => true
    });
    const pass = target.postProcessing;

    view.update({ glow: false });
    view.update({ glow: true });

    assert.ok(target.postProcessing === pass);

    glow.dispose();
    assert.equal(target.postProcessing, null);
  });
});
