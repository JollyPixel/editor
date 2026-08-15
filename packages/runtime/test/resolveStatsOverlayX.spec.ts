// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  resolveStatsOverlayX
} from "../src/stats/resolveStatsOverlayX.ts";

describe("resolveStatsOverlayX", () => {
  it("uses the inset for top-left placement", () => {
    assert.equal(
      resolveStatsOverlayX("top-left", 1280, 112, 8),
      8
    );
  });

  it("anchors top-right placement to the viewport edge", () => {
    assert.equal(
      resolveStatsOverlayX("top-right", 1280, 112, 8),
      1160
    );
  });

  it("keeps top-right placement inside a narrow viewport", () => {
    assert.equal(
      resolveStatsOverlayX("top-right", 100, 112, 8),
      8
    );
  });
});
