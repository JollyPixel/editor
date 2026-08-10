// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerFrustum, PeerFrustumLabel } from "#src/index.ts";
import { mockContextOf } from "../fixtures/canvas.ts";

function canvasOf(
  label: PeerFrustumLabel
): HTMLCanvasElement {
  return (label.material.map as THREE.CanvasTexture).image as HTMLCanvasElement;
}

describe("constructor", () => {
  test("throws when near <= 0", () => {
    assert.throws(
      () => new PeerFrustum({ near: 0, depth: 1.5 }),
      /"near"/
    );
  });

  test("throws when near >= depth", () => {
    assert.throws(
      () => new PeerFrustum({ near: 1.5, depth: 1.5 }),
      /"near"/
    );
  });

  test("builds near/far rectangles + connecting body, no apex tip, by default", () => {
    const frustum = new PeerFrustum();
    const positions = frustum.geometry.getAttribute("position");

    // 4 near-rect + 4 far-rect + 4 body edges, 2 points each.
    assert.strictEqual(positions.count, 12 * 2);
  });

  test("showApex: true adds the apex-tip edges", () => {
    const frustum = new PeerFrustum({ showApex: true });
    const positions = frustum.geometry.getAttribute("position");

    // 4 near-rect + 4 far-rect + 4 body + 4 apex-tip edges, 2 points each.
    assert.strictEqual(positions.count, 16 * 2);
  });

  test("near-plane corners are a scaled-down copy of the far-plane corners", () => {
    const fov = 60;
    const aspect = 1;
    const depth = 2;
    const near = 0.4;
    const frustum = new PeerFrustum({
      fov,
      aspect,
      depth,
      near
    });

    const positions = frustum.geometry.getAttribute("position");
    function point(index: number): THREE.Vector3 {
      return new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index)
      );
    }

    // Point 0 is the near-plane's top-left corner, point 8 the far-plane's.
    const nearTopLeft = point(0);
    const farTopLeft = point(8);
    const ratio = near / depth;

    assert.ok(
      nearTopLeft.distanceTo(
        farTopLeft.clone().multiplyScalar(ratio)
      ) < 1e-6
    );
  });

  test("default near is 20% of depth", () => {
    const depth = 3;
    const frustum = new PeerFrustum({ depth });
    const positions = frustum.geometry.getAttribute("position");
    const nearTopLeftZ = positions.getZ(0);

    assert.ok(Math.abs(nearTopLeftZ - -(depth * 0.2)) < 1e-6);
  });

  test("does not create a label when no name is provided", () => {
    const frustum = new PeerFrustum();

    assert.strictEqual(frustum.label, null);
    assert.strictEqual(frustum.children.length, 0);
  });

  test("creates a nameplate label when a name is provided, added as a child", () => {
    const frustum = new PeerFrustum({ name: "Alice" });

    assert.ok(frustum.label instanceof PeerFrustumLabel);
    assert.strictEqual(frustum.children.length, 1);
    assert.strictEqual(frustum.children[0], frustum.label);
  });
});

describe("setColor", () => {
  test("updates the wireframe material color", () => {
    const frustum = new PeerFrustum({ color: "#000000" });
    frustum.setColor("#ff0000");

    const material = frustum.material as THREE.LineBasicMaterial;
    assert.strictEqual(`#${material.color.getHexString()}`, "#ff0000");
  });

  test("forwards the new color to the existing label", () => {
    const frustum = new PeerFrustum({ name: "Bob" });
    const context = mockContextOf(canvasOf(frustum.label as PeerFrustumLabel));
    const callsBefore = context.fillTextCallCount;

    frustum.setColor("#00ff00");

    assert.ok(context.fillTextCallCount > callsBefore);
  });

  test("does nothing to a label when none exists", () => {
    const frustum = new PeerFrustum();

    assert.doesNotThrow(() => frustum.setColor("#ff0000"));
  });
});

describe("setName", () => {
  test("creates a label lazily if none exists yet", () => {
    const frustum = new PeerFrustum();
    assert.strictEqual(frustum.label, null);

    frustum.setName("Carol");

    assert.ok(frustum.label instanceof PeerFrustumLabel);
    assert.strictEqual(frustum.children.length, 1);
  });

  test("updates an existing label instead of replacing it", () => {
    const frustum = new PeerFrustum({ name: "Dave" });
    const label = frustum.label;

    frustum.setName("Erin");

    assert.strictEqual(frustum.label, label);
    assert.strictEqual(frustum.children.length, 1);
  });
});

describe("setShowNameBox", () => {
  test("forwards to an existing label without throwing when none exists", () => {
    const frustum = new PeerFrustum();

    assert.doesNotThrow(() => frustum.setShowNameBox(true));
  });
});

describe("dispose", () => {
  test("disposes geometry, material and the label's texture/material", () => {
    const frustum = new PeerFrustum({ name: "Frank" });
    const label = frustum.label as PeerFrustumLabel;
    const texture = label.material.map as THREE.CanvasTexture;

    let geometryDisposed = false;
    let materialDisposed = false;
    let textureDisposed = false;
    let labelMaterialDisposed = false;

    frustum.geometry.addEventListener("dispose", () => {
      geometryDisposed = true;
    });
    (frustum.material as THREE.Material).addEventListener("dispose", () => {
      materialDisposed = true;
    });
    texture.addEventListener("dispose", () => {
      textureDisposed = true;
    });
    label.material.addEventListener("dispose", () => {
      labelMaterialDisposed = true;
    });

    frustum.dispose();

    assert.ok(geometryDisposed);
    assert.ok(materialDisposed);
    assert.ok(textureDisposed);
    assert.ok(labelMaterialDisposed);
  });

  test("does not throw when no label exists", () => {
    const frustum = new PeerFrustum();

    assert.doesNotThrow(() => frustum.dispose());
  });
});
