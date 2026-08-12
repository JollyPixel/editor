// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Internal Dependencies
import { resolveThemeToken } from "../../src/theme/resolveThemeToken.ts";

test("resolveThemeToken reads a host token", () => {
  const host = document.createElement("div");
  host.style.setProperty("--jolly-test-token", "#123456");
  document.body.append(host);

  assert.equal(
    resolveThemeToken(host, "--jolly-test-token", "fallback"),
    "#123456"
  );

  host.remove();
});

test("resolveThemeToken returns its fallback for an absent token", () => {
  const host = document.createElement("div");

  assert.equal(
    resolveThemeToken(host, "--jolly-missing-token", "fallback"),
    "fallback"
  );
});
