// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerFrustum } from "#src/index.ts";
import { mockContextOf } from "../fixtures/canvas.ts";

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

    assert.strictEqual(frustum.children.length, 0);
  });

  test("creates a nameplate sprite when a name is provided", () => {
    const frustum = new PeerFrustum({ name: "Alice" });

    assert.strictEqual(frustum.children.length, 1);
    assert.ok(frustum.children[0] instanceof THREE.Sprite);
  });

  test("showNameBox defaults to false: no background box is drawn", () => {
    const frustum = new PeerFrustum({ name: "Grace" });
    const sprite = frustum.children[0] as THREE.Sprite;
    const canvas = (sprite.material.map as THREE.CanvasTexture)
      .image as HTMLCanvasElement;

    assert.strictEqual(mockContextOf(canvas).roundRectCallCount, 0);
  });

  test("showNameBox: true draws a background box", () => {
    const frustum = new PeerFrustum({ name: "Heidi", showNameBox: true });
    const sprite = frustum.children[0] as THREE.Sprite;
    const canvas = (sprite.material.map as THREE.CanvasTexture)
      .image as HTMLCanvasElement;

    assert.strictEqual(mockContextOf(canvas).roundRectCallCount, 1);
  });
});

describe("setColor", () => {
  test("updates the wireframe material color", () => {
    const frustum = new PeerFrustum({ color: "#000000" });
    frustum.setColor("#ff0000");

    const material = frustum.material as THREE.LineBasicMaterial;
    assert.strictEqual(`#${material.color.getHexString()}`, "#ff0000");
  });

  test("redraws the existing label to reflect the new color", () => {
    const frustum = new PeerFrustum({ name: "Bob" });
    const sprite = frustum.children[0] as THREE.Sprite;
    const canvas = (sprite.material.map as THREE.CanvasTexture)
      .image as HTMLCanvasElement;
    const context = mockContextOf(canvas);
    const callsBefore = context.fillTextCallCount;

    frustum.setColor("#00ff00");

    assert.ok(context.fillTextCallCount > callsBefore);
  });
});

describe("setName", () => {
  test("creates a label lazily if none exists yet", () => {
    const frustum = new PeerFrustum();
    assert.strictEqual(frustum.children.length, 0);

    frustum.setName("Carol");

    assert.strictEqual(frustum.children.length, 1);
  });

  test("redraws an existing label with the new name", () => {
    const frustum = new PeerFrustum({ name: "Dave" });
    const sprite = frustum.children[0] as THREE.Sprite;
    const canvas = (sprite.material.map as THREE.CanvasTexture)
      .image as HTMLCanvasElement;

    frustum.setName("Erin");

    assert.strictEqual(frustum.children.length, 1);
    assert.strictEqual(mockContextOf(canvas).lastFillText, "Erin");
  });
});

describe("setShowNameBox", () => {
  test("toggles the background box on an existing label", () => {
    const frustum = new PeerFrustum({ name: "Ivan" });
    const sprite = frustum.children[0] as THREE.Sprite;
    const canvas = (sprite.material.map as THREE.CanvasTexture)
      .image as HTMLCanvasElement;

    frustum.setShowNameBox(true);

    assert.strictEqual(mockContextOf(canvas).roundRectCallCount, 1);
  });
});

describe("dispose", () => {
  test("disposes geometry, material and the label's texture/material", () => {
    const frustum = new PeerFrustum({ name: "Frank" });
    const sprite = frustum.children[0] as THREE.Sprite;
    const texture = sprite.material.map as THREE.CanvasTexture;

    let geometryDisposed = false;
    let materialDisposed = false;
    let textureDisposed = false;
    let spriteMaterialDisposed = false;

    frustum.geometry.addEventListener("dispose", () => {
      geometryDisposed = true;
    });
    (frustum.material as THREE.Material).addEventListener("dispose", () => {
      materialDisposed = true;
    });
    texture.addEventListener("dispose", () => {
      textureDisposed = true;
    });
    sprite.material.addEventListener("dispose", () => {
      spriteMaterialDisposed = true;
    });

    frustum.dispose();

    assert.ok(geometryDisposed);
    assert.ok(materialDisposed);
    assert.ok(textureDisposed);
    assert.ok(spriteMaterialDisposed);
  });
});
