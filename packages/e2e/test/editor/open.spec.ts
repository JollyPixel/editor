// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { editorPath } from "../../src/editor/open.ts";

describe("editorPath", () => {
  it("opens the root without options", () => {
    assert.equal(editorPath(), "/");
  });

  it("puts target, username and max-fps before the extra query", () => {
    const path = editorPath({
      target: "asset-1",
      username: "E2E",
      maxFps: 10,
      query: {
        samples: "0"
      }
    });

    assert.equal(path, "/?target=asset-1&username=E2E&max-fps=10&samples=0");
  });

  it("writes an empty query value as a bare flag", () => {
    assert.equal(editorPath({
      maxFps: 5,
      query: {
        offline: ""
      }
    }), "/?max-fps=5&offline=");
  });

  it("lets the extra query override a named option", () => {
    assert.equal(editorPath({
      username: "E2E",
      query: {
        username: "Guest"
      }
    }), "/?username=Guest");
  });
});
