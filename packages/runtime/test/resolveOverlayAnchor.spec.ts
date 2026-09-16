// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  resolveOverlayAnchor
} from "../src/ui/overlay/resolveOverlayAnchor.ts";

describe("resolveOverlayAnchor", () => {
  it("pins a top-left overlay to both start edges", () => {
    assert.deepEqual(resolveOverlayAnchor("top-left", 8), {
      top: "8px",
      right: "",
      bottom: "",
      left: "8px",
      transform: ""
    });
  });

  it("pins a bottom-right overlay to both end edges", () => {
    assert.deepEqual(resolveOverlayAnchor("bottom-right", 12), {
      top: "",
      right: "12px",
      bottom: "12px",
      left: "",
      transform: ""
    });
  });

  it("centers a top-center overlay horizontally", () => {
    assert.deepEqual(resolveOverlayAnchor("top-center", 12), {
      top: "12px",
      right: "",
      bottom: "",
      left: "50%",
      transform: "translate(-50%, 0)"
    });
  });

  it("centers a middle-right overlay vertically", () => {
    assert.deepEqual(resolveOverlayAnchor("middle-right", 4), {
      top: "50%",
      right: "4px",
      bottom: "",
      left: "",
      transform: "translate(0, -50%)"
    });
  });

  it("centers a center overlay on both axes", () => {
    assert.deepEqual(resolveOverlayAnchor("center", 4), {
      top: "50%",
      right: "",
      bottom: "",
      left: "50%",
      transform: "translate(-50%, -50%)"
    });
  });
});
