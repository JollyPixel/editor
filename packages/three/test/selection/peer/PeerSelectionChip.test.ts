// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerSelectionChip } from "#src/index.ts";
import { mockContextOf } from "../../fixtures/canvas.ts";

function canvasOf(
  chip: PeerSelectionChip
): HTMLCanvasElement {
  const { map } = chip.material;
  assert.ok(map instanceof THREE.CanvasTexture);

  return map.image;
}

describe("constructor", () => {
  test("is a THREE.Sprite", () => {
    const chip = new PeerSelectionChip({ color: "#43aa8b" });

    assert.ok(chip instanceof THREE.Sprite);
  });

  test("draws a filled, stroked circle once on creation", () => {
    const chip = new PeerSelectionChip({ color: "#43aa8b" });
    const context = mockContextOf(canvasOf(chip));

    assert.strictEqual(context.arcCallCount, 1);
    assert.strictEqual(context.fillCallCount, 1);
    assert.strictEqual(context.strokeCallCount, 1);
  });

  test("exposes the given color", () => {
    const chip = new PeerSelectionChip({ color: "#43aa8b" });

    assert.strictEqual(chip.color, "#43aa8b");
  });

  test("label defaults to undefined and draws no text", () => {
    const chip = new PeerSelectionChip({ color: "#43aa8b" });
    const context = mockContextOf(canvasOf(chip));

    assert.strictEqual(chip.label, undefined);
    assert.strictEqual(context.fillTextCallCount, 0);
  });

  test("a given label is drawn as text", () => {
    const chip = new PeerSelectionChip({ color: "#4a4a4a", label: "+3" });
    const context = mockContextOf(canvasOf(chip));

    assert.strictEqual(chip.label, "+3");
    assert.strictEqual(context.lastFillText, "+3");
  });
});

describe("color", () => {
  test("redraws the chip", () => {
    const chip = new PeerSelectionChip({ color: "#000000" });
    const context = mockContextOf(canvasOf(chip));
    const callsBefore = context.fillCallCount;

    chip.color = "#00ff00";

    assert.strictEqual(chip.color, "#00ff00");
    assert.ok(context.fillCallCount > callsBefore);
  });
});

describe("label", () => {
  test("redraws the chip with the new label", () => {
    const chip = new PeerSelectionChip({ color: "#4a4a4a" });
    const context = mockContextOf(canvasOf(chip));

    chip.label = "+5";

    assert.strictEqual(chip.label, "+5");
    assert.strictEqual(context.lastFillText, "+5");
  });

  test("clearing the label back to undefined stops drawing text", () => {
    const chip = new PeerSelectionChip({ color: "#4a4a4a", label: "+5" });
    const context = mockContextOf(canvasOf(chip));
    const callsBefore = context.fillTextCallCount;

    chip.label = undefined;

    assert.strictEqual(context.fillTextCallCount, callsBefore, "must not draw text once the label is cleared");
  });
});

describe("dispose", () => {
  test("disposes the texture and material", () => {
    const chip = new PeerSelectionChip({ color: "#43aa8b" });
    const { map: texture } = chip.material;
    assert.ok(texture instanceof THREE.CanvasTexture);

    let textureDisposed = false;
    let materialDisposed = false;
    texture.addEventListener("dispose", () => {
      textureDisposed = true;
    });
    chip.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });

    chip.dispose();

    assert.ok(textureDisposed);
    assert.ok(materialDisposed);
  });
});
