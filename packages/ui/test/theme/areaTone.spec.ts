// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { registerIcon } from "../../src/icon/registry.ts";
import {
  applyAreaTone,
  resolveAreaTone
} from "../../src/theme/areaTone.ts";

describe("resolveAreaTone", () => {
  test("falls back to the icon's registered tone", () => {
    registerIcon("test-area-amber", "<path />", { tone: "amber" });

    assert.equal(resolveAreaTone("", "test-area-amber"), "amber");
    assert.equal(resolveAreaTone("sky", "test-area-amber"), "sky");
    assert.equal(resolveAreaTone("", "close"), null);
  });

  test("ignores a tone outside the seven hues", () => {
    assert.equal(resolveAreaTone("crimson", ""), null);
  });
});

describe("applyAreaTone", () => {
  test("declares the area tokens and flags the host", () => {
    const host = document.createElement("div");

    applyAreaTone(host, "teal");

    assert.ok(host.hasAttribute("toned"));
    assert.equal(
      host.style.getPropertyValue("--jolly-area-tone"),
      "var(--jolly-tone-teal)"
    );
    assert.equal(
      host.style.getPropertyValue("--jolly-area-fill"),
      "var(--jolly-tone-teal-fill)"
    );
  });

  test("clears the area when the tone goes away", () => {
    const host = document.createElement("div");
    applyAreaTone(host, "teal");

    applyAreaTone(host, null);

    assert.ok(!host.hasAttribute("toned"));
    assert.equal(host.style.getPropertyValue("--jolly-area-tone"), "");
    assert.equal(host.style.getPropertyValue("--jolly-area-fill"), "");
  });
});
