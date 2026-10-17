// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerSelectionChip } from "#src/mesh-highlight/peer/PeerSelectionChip.ts";
import { spriteContext } from "../../fixtures/canvas.ts";

function readTextureVersion(
  chip: PeerSelectionChip
): number {
  const { map } = chip.material;
  assert.ok(map);

  return map.version;
}

describe("constructor", () => {
  test("paints the chip in its color on creation", () => {
    const chip = new PeerSelectionChip({ color: "#43aa8b" });

    assert.strictEqual(spriteContext(chip).fillStyle, "rgb(67,170,139)");
  });

  test("label defaults to undefined and draws no text", () => {
    const chip = new PeerSelectionChip({ color: "#43aa8b" });
    const context = spriteContext(chip);

    assert.strictEqual(chip.label, undefined);
    assert.strictEqual(context.fillTextCallCount, 0);
  });

  test("a given label is drawn as text", () => {
    const chip = new PeerSelectionChip({ color: "#4a4a4a", label: "+3" });
    const context = spriteContext(chip);

    assert.strictEqual(chip.label, "+3");
    assert.strictEqual(context.lastFillText, "+3");
  });
});

describe("color", () => {
  test("repaints the chip in the new color", () => {
    const chip = new PeerSelectionChip({ color: "#000000" });
    const versionBefore = readTextureVersion(chip);

    chip.color = "#00ff00";

    assert.strictEqual(chip.color, "#00ff00");
    assert.strictEqual(spriteContext(chip).fillStyle, "rgb(0,255,0)");
    assert.ok(readTextureVersion(chip) > versionBefore, "the texture must be re-uploaded");
  });
});

describe("label", () => {
  test("redraws the chip with the new label", () => {
    const chip = new PeerSelectionChip({ color: "#4a4a4a" });
    const context = spriteContext(chip);

    chip.label = "+5";

    assert.strictEqual(chip.label, "+5");
    assert.strictEqual(context.lastFillText, "+5");
  });

  test("clearing the label back to undefined repaints without text", () => {
    const chip = new PeerSelectionChip({ color: "#4a4a4a", label: "+5" });
    const context = spriteContext(chip);
    const textCallsBefore = context.fillTextCallCount;
    const versionBefore = readTextureVersion(chip);

    chip.label = undefined;

    assert.ok(readTextureVersion(chip) > versionBefore, "the chip must repaint");
    assert.strictEqual(
      context.fillTextCallCount,
      textCallsBefore,
      "must not draw text once the label is cleared"
    );
  });
});
