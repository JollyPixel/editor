// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerFrustumLabel } from "#src/peer-frustum/PeerFrustumLabel.ts";
import { contextOf } from "../fixtures/canvas.ts";

describe("constructor", () => {
  test("is a THREE.Sprite", () => {
    const label = new PeerFrustumLabel({
      displayName: "Alice",
      color: "#43aa8b"
    });

    assert.ok(label instanceof THREE.Sprite);
  });

  test("draws the name on creation", () => {
    const label = new PeerFrustumLabel({
      displayName: "Alice",
      color: "#43aa8b"
    });

    assert.strictEqual(contextOf(label).lastFillText, "Alice");
  });

  test("showNameBox defaults to false: no background box is drawn", () => {
    const label = new PeerFrustumLabel({
      displayName: "Grace",
      color: "#43aa8b"
    });

    assert.strictEqual(contextOf(label).roundRectCallCount, 0);
  });

  test("showNameBox: true draws a background box", () => {
    const label = new PeerFrustumLabel({
      displayName: "Heidi",
      color: "#43aa8b",
      showNameBox: true
    });

    assert.strictEqual(contextOf(label).roundRectCallCount, 1);
  });
});

describe("displayName", () => {
  test("redraws with the new name", () => {
    const label = new PeerFrustumLabel({
      displayName: "Dave",
      color: "#43aa8b"
    });

    label.displayName = "Erin";

    assert.strictEqual(contextOf(label).lastFillText, "Erin");
  });
});

describe("color", () => {
  test("redraws the name in the new color", () => {
    const label = new PeerFrustumLabel({
      displayName: "Bob",
      color: "#000000"
    });

    label.color = "#00ff00";

    assert.strictEqual(
      contextOf(label).fillStyle,
      new THREE.Color("#00ff00").getStyle()
    );
  });
});

describe("showNameBox", () => {
  test("toggles the background box on", () => {
    const label = new PeerFrustumLabel({
      displayName: "Ivan",
      color: "#43aa8b"
    });

    label.showNameBox = true;

    assert.strictEqual(contextOf(label).roundRectCallCount, 1);
  });
});
