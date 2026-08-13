// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test } from "node:test";

// Import Internal Dependencies
import { peerColor } from "../../src/theme/peerColor.ts";

test("peerColor returns a six-digit hex color", () => {
  assert.match(peerColor(0), /^#[0-9a-f]{6}$/);
  assert.match(peerColor(-1), /^#[0-9a-f]{6}$/);
});

test("peerColor gives consecutive peers distinct colors", () => {
  assert.notEqual(peerColor(0), peerColor(1));
});
