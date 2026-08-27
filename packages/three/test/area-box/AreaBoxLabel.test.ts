// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AreaBoxLabel } from "#src/index.ts";
import { mockContextOf } from "../fixtures/canvas.ts";

function canvasOf(
  label: AreaBoxLabel
): HTMLCanvasElement {
  const { map } = label.material;
  assert.ok(map instanceof THREE.CanvasTexture);

  return map.image;
}

describe("constructor", () => {
  test("draws the outlined display name", () => {
    const label = new AreaBoxLabel({ displayName: "Spawn" });
    const context = mockContextOf(canvasOf(label));

    assert.equal(context.lastStrokeText, "Spawn");
    assert.equal(context.lastFillText, "Spawn");
    assert.equal(
      new THREE.Color(label.color).getHexString(),
      "ffffff"
    );
  });
});

describe("live properties", () => {
  test("redraws after the display name or color changes", () => {
    const label = new AreaBoxLabel({ displayName: "Spawn" });
    const context = mockContextOf(canvasOf(label));
    const callsBefore = context.fillTextCallCount;

    label.displayName = "Patrol";
    label.color = "#4da3ff";

    assert.equal(label.displayName, "Patrol");
    assert.equal(context.lastFillText, "Patrol");
    assert.equal(context.fillTextCallCount, callsBefore + 2);
  });
});

describe("dispose", () => {
  test("releases the texture and material", () => {
    const label = new AreaBoxLabel({ displayName: "Spawn" });
    const { map: texture } = label.material;
    assert.ok(texture instanceof THREE.CanvasTexture);

    let textureDisposed = false;
    let materialDisposed = false;
    texture.addEventListener("dispose", () => {
      textureDisposed = true;
    });
    label.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });

    label.dispose();

    assert.equal(textureDisposed, true);
    assert.equal(materialDisposed, true);
  });
});
