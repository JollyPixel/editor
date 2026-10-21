// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseBody } from "#src/tour/parseBody.ts";
import { TourKeys } from "#src/tour/TourKeys.ts";

function cameraKeys(): TourKeys {
  const keys = new TourKeys();
  const bound: Record<string, readonly string[]> = {
    forward: ["Z", "↑"],
    down: []
  };
  keys.provide("camera", (action) => bound[action]);

  return keys;
}

describe("parseBody", () => {
  test("replaces a key placeholder with the first key bound to the action", () => {
    assert.deepEqual(parseBody("`{camera.forward}` flies", cameraKeys()), [
      [
        { kind: "kbd", text: "Z" },
        { kind: "text", text: " flies" }
      ]
    ]);
  });

  test("marks a placeholder whose action has no key as unbound", () => {
    assert.deepEqual(parseBody("`{camera.down}`", cameraKeys()), [
      [{ kind: "unbound", text: "unbound" }]
    ]);
  });

  test("keeps a placeholder no namespace resolves as written", () => {
    const keys = cameraKeys();

    assert.deepEqual(parseBody("`{camera.jump}` `{map.tool.brush}`", keys), [
      [
        { kind: "kbd", text: "{camera.jump}" },
        { kind: "text", text: " " },
        { kind: "kbd", text: "{map.tool.brush}" }
      ]
    ]);
  });

  test("stops resolving a namespace once its provider is released", () => {
    const keys = new TourKeys();
    const release = keys.provide("camera", () => ["W"]);
    release();

    assert.equal(keys.labels("camera.forward"), undefined);
  });

  test("starts a paragraph at each blank line, not at a single line break", () => {
    assert.deepEqual(parseBody("Pick a block.\nAny block.\n\n\nThen place it.\n"), [
      [{ kind: "text", text: "Pick a block.\nAny block." }],
      [{ kind: "text", text: "Then place it." }]
    ]);
  });

  test("renders backtick spans as keys", () => {
    assert.deepEqual(parseBody("Press `Ctrl+K` or `F1`."), [
      [
        { kind: "text", text: "Press " },
        { kind: "kbd", text: "Ctrl+K" },
        { kind: "text", text: " or " },
        { kind: "kbd", text: "F1" },
        { kind: "text", text: "." }
      ]
    ]);
  });

  test("keeps an unmatched backtick as text", () => {
    assert.deepEqual(parseBody("a ` b"), [
      [{ kind: "text", text: "a ` b" }]
    ]);
  });
});
