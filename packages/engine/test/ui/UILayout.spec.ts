// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UILayout } from "../../src/ui/UILayout.ts";

describe("UI.UILayout", () => {
  const bounds = { left: -10, right: 10, top: 5, bottom: -5 };

  test("should keep a sized element inside the edges it is anchored to", () => {
    const layout = new UILayout({
      anchor: { x: "right", y: "top" },
      offset: { x: -1, y: -1 },
      size: { width: 4, height: 2 }
    });

    assert.deepStrictEqual(layout.position(bounds), { x: 7, y: 3 });
  });

  test("should shift a centered element by its pivot", () => {
    const layout = new UILayout({
      size: { width: 4, height: 2 },
      pivot: { x: 0, y: 1 }
    });

    assert.deepStrictEqual(layout.position(bounds), { x: 2, y: -1 });
  });

  test("should place a bottom-left element from the opposite edges", () => {
    const layout = new UILayout({
      anchor: { x: "left", y: "bottom" },
      size: { width: 4, height: 2 }
    });

    assert.deepStrictEqual(layout.position(bounds), { x: -8, y: -4 });
  });
});
