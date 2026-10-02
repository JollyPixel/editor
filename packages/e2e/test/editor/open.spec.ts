// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  editorPath,
  type OpenEditorOptions
} from "../../src/editor/open.ts";

function queryOf(
  options: OpenEditorOptions
): Record<string, string> {
  const url = new URL(editorPath(options), "http://localhost");

  return Object.fromEntries(url.searchParams);
}

describe("editorPath", () => {
  it("opens the root without options", () => {
    assert.equal(editorPath(), "/");
  });

  it("writes each named option as its host query parameter", () => {
    assert.deepEqual(queryOf({
      target: "asset-1",
      username: "E2E",
      maxFps: 10,
      debug: "host.*",
      query: {
        samples: "0"
      }
    }), {
      target: "asset-1",
      username: "E2E",
      "max-fps": "10",
      debug: "host.*",
      samples: "0"
    });
  });

  it("writes an empty query value as a bare flag", () => {
    assert.equal(editorPath({
      query: {
        offline: ""
      }
    }), "/?offline=");
  });

  it("lets the extra query override a named option", () => {
    assert.deepEqual(queryOf({
      username: "E2E",
      query: {
        username: "Guest"
      }
    }), {
      username: "Guest"
    });
  });
});
