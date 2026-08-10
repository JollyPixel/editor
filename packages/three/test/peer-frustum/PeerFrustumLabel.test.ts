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
  return (label.material.map as THREE.CanvasTexture).image as HTMLCanvasElement;
}

describe("constructor", () => {
  test("is a THREE.Sprite", () => {
    const label = new PeerFrustumLabel({ name: "Alice", color: "#43aa8b" });

    assert.ok(label instanceof THREE.Sprite);
  });

  test("draws the name once on creation", () => {
    const label = new PeerFrustumLabel({ name: "Alice", color: "#43aa8b" });

    assert.strictEqual(mockContextOf(canvasOf(label)).lastFillText, "Alice");
  });

  test("showNameBox defaults to false: no background box is drawn", () => {
    const label = new PeerFrustumLabel({ name: "Grace", color: "#43aa8b" });

    assert.strictEqual(mockContextOf(canvasOf(label)).roundRectCallCount, 0);
  });

  test("showNameBox: true draws a background box", () => {
    const label = new PeerFrustumLabel({ name: "Heidi", color: "#43aa8b", showNameBox: true });

    assert.strictEqual(mockContextOf(canvasOf(label)).roundRectCallCount, 1);
  });
});

describe("setName", () => {
  test("redraws with the new name", () => {
    const label = new PeerFrustumLabel({ name: "Dave", color: "#43aa8b" });

    label.setName("Erin");

    assert.strictEqual(mockContextOf(canvasOf(label)).lastFillText, "Erin");
  });
});

describe("setColor", () => {
  test("redraws the label", () => {
    const label = new PeerFrustumLabel({ name: "Bob", color: "#000000" });
    const context = mockContextOf(canvasOf(label));
    const callsBefore = context.fillTextCallCount;

    label.setColor("#00ff00");

    assert.ok(context.fillTextCallCount > callsBefore);
  });
});

describe("setShowNameBox", () => {
  test("toggles the background box", () => {
    const label = new PeerFrustumLabel({ name: "Ivan", color: "#43aa8b" });

    label.setShowNameBox(true);

    assert.strictEqual(mockContextOf(canvasOf(label)).roundRectCallCount, 1);
  });
});

describe("dispose", () => {
  test("disposes the texture and material", () => {
    const label = new PeerFrustumLabel({ name: "Frank", color: "#43aa8b" });
    const texture = label.material.map as THREE.CanvasTexture;

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
