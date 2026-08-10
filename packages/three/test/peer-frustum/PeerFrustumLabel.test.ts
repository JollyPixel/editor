// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerFrustumLabel } from "#src/peer-frustum/PeerFrustumLabel.ts";
import { mockContextOf } from "../fixtures/canvas.ts";

function canvasOf(
  label: PeerFrustumLabel
): HTMLCanvasElement {
  const { map } = label.material;
  assert.ok(map instanceof THREE.CanvasTexture);

  return map.image;
}

describe("constructor", () => {
  test("is a THREE.Sprite", () => {
    const label = new PeerFrustumLabel({
      displayName: "Alice",
      color: "#43aa8b"
    });

    assert.ok(label instanceof THREE.Sprite);
  });

  test("draws the name once on creation", () => {
    const label = new PeerFrustumLabel({
      displayName: "Alice",
      color: "#43aa8b"
    });

    assert.strictEqual(
      mockContextOf(canvasOf(label)).lastFillText,
      "Alice"
    );
  });

  test("showNameBox defaults to false: no background box is drawn", () => {
    const label = new PeerFrustumLabel({
      displayName: "Grace",
      color: "#43aa8b"
    });

    assert.strictEqual(
      mockContextOf(canvasOf(label)).roundRectCallCount,
      0
    );
  });

  test("showNameBox: true draws a background box", () => {
    const label = new PeerFrustumLabel({
      displayName: "Heidi",
      color: "#43aa8b",
      showNameBox: true
    });

    assert.strictEqual(
      mockContextOf(canvasOf(label)).roundRectCallCount,
      1
    );
  });
});

describe("displayName", () => {
  test("redraws with the new name", () => {
    const label = new PeerFrustumLabel({
      displayName: "Dave",
      color: "#43aa8b"
    });

    label.displayName = "Erin";

    assert.strictEqual(
      mockContextOf(canvasOf(label)).lastFillText,
      "Erin"
    );
  });
});

describe("color", () => {
  test("redraws the label", () => {
    const label = new PeerFrustumLabel({
      displayName: "Bob",
      color: "#000000"
    });
    const context = mockContextOf(canvasOf(label));
    const callsBefore = context.fillTextCallCount;

    label.color = "#00ff00";

    assert.ok(context.fillTextCallCount > callsBefore);
  });
});

describe("showNameBox", () => {
  test("toggles the background box", () => {
    const label = new PeerFrustumLabel({
      displayName: "Ivan",
      color: "#43aa8b"
    });

    label.showNameBox = true;

    assert.strictEqual(
      mockContextOf(canvasOf(label)).roundRectCallCount,
      1
    );
  });
});

describe("dispose", () => {
  test("disposes the texture and material", () => {
    const label = new PeerFrustumLabel({
      displayName: "Frank",
      color: "#43aa8b"
    });
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

    assert.ok(textureDisposed);
    assert.ok(materialDisposed);
  });
});
