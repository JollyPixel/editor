// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { RecentColors } from "../../src/color/RecentColors.ts";

describe("UI.RecentColors", () => {
  test("puts the latest color first, once, and keeps eight", () => {
    let recent = RecentColors.empty;
    for (let index = 0; index < 10; index++) {
      recent = recent.with({ hex: `#00000${index}`, opacity: 1 });
    }
    recent = recent.with({ hex: "#000005", opacity: 1 });

    assert.deepEqual(recent.colors.map(({ hex }) => hex), [
      "#000005",
      "#000009",
      "#000008",
      "#000007",
      "#000006",
      "#000004",
      "#000003",
      "#000002"
    ]);
  });

  test("tells colors apart by opacity and ignores a repeat of the latest", () => {
    const recent = RecentColors.empty
      .with({ hex: "#ff0000", opacity: 1 })
      .with({ hex: "#ff0000", opacity: 0.5 });

    assert.equal(recent.colors.length, 2);
    assert.equal(recent.with({ hex: "#ff0000", opacity: 0.5 }), recent);
  });
});
