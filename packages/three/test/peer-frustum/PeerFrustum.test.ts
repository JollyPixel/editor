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
  const { map } = label.material;
  assert.ok(map instanceof THREE.CanvasTexture);

  return map.image;
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
    const frustum = new PeerFrustum({ displayName: "Alice" });

    assert.ok(frustum.label instanceof PeerFrustumLabel);
    assert.strictEqual(frustum.children.length, 1);
    assert.strictEqual(frustum.children[0], frustum.label);
  });
});

describe("color", () => {
  test("updates the wireframe material color", () => {
    const frustum = new PeerFrustum({ color: "#000000" });
    frustum.color = "#ff0000";

    assert.strictEqual(
      `#${frustum.material.color.getHexString()}`,
      "#ff0000"
    );
  });

  test("forwards the new color to the existing label", () => {
    const frustum = new PeerFrustum({ displayName: "Bob" });
    const { label } = frustum;
    assert.ok(label instanceof PeerFrustumLabel);
    const context = mockContextOf(canvasOf(label));
    const callsBefore = context.fillTextCallCount;

    frustum.color = "#00ff00";

    assert.ok(context.fillTextCallCount > callsBefore);
  });

  test("does nothing to a label when none exists", () => {
    const frustum = new PeerFrustum();

    assert.doesNotThrow(() => {
      frustum.color = "#ff0000";
    });
  });
});

describe("displayName", () => {
  test("creates a label lazily if none exists yet", () => {
    const frustum = new PeerFrustum();
    assert.strictEqual(frustum.label, null);

    frustum.displayName = "Carol";

    assert.ok(frustum.label instanceof PeerFrustumLabel);
    assert.strictEqual(frustum.children.length, 1);
  });

  test("updates an existing label instead of replacing it", () => {
    const frustum = new PeerFrustum({ displayName: "Dave" });
    const label = frustum.label;

    frustum.displayName = "Erin";

    assert.strictEqual(frustum.label, label);
    assert.strictEqual(frustum.children.length, 1);
  });
});

describe("showNameBox", () => {
  test("does not throw when no label exists", () => {
    const frustum = new PeerFrustum();

    assert.doesNotThrow(() => {
      frustum.showNameBox = true;
    });
  });

  test("applies the retained value when a label is created later", () => {
    const frustum = new PeerFrustum();
    frustum.showNameBox = true;

    frustum.displayName = "Alice";

    const { label } = frustum;
    assert.ok(label instanceof PeerFrustumLabel);
    const context = mockContextOf(canvasOf(label));
    assert.strictEqual(context.roundRectCallCount, 1);
  });
});

describe("PeerFrustum.Defaults", () => {
  test("new PeerFrustum() falls back to a mutated PeerFrustum.Defaults value", () => {
    const original = PeerFrustum.Defaults.color;
    try {
      PeerFrustum.Defaults.color = "#ff00ff";
      const frustum = new PeerFrustum();

      assert.strictEqual(
        `#${frustum.material.color.getHexString()}`,
        "#ff00ff"
      );
    }
    finally {
      PeerFrustum.Defaults.color = original;
    }
  });

  test("mutating PeerFrustum.Defaults does not affect already-constructed instances", () => {
    const original = PeerFrustum.Defaults.color;
    try {
      const frustum = new PeerFrustum();
      PeerFrustum.Defaults.color = "#ff00ff";

      assert.strictEqual(
        `#${frustum.material.color.getHexString()}`,
        "#43aa8b"
      );
    }
    finally {
      PeerFrustum.Defaults.color = original;
    }
  });

  test("constructor options still override a mutated PeerFrustum.Defaults value", () => {
    const original = PeerFrustum.Defaults.color;
    try {
      PeerFrustum.Defaults.color = "#ff00ff";
      const frustum = new PeerFrustum({ color: "#00ff00" });

      assert.strictEqual(
        `#${frustum.material.color.getHexString()}`,
        "#00ff00"
      );
    }
    finally {
      PeerFrustum.Defaults.color = original;
    }
  });

  test("PeerFrustum.Defaults.nearRatio drives the derived near when near is omitted", () => {
    const original = PeerFrustum.Defaults.nearRatio;
    try {
      PeerFrustum.Defaults.nearRatio = 0.5;
      const depth = 3;
      const frustum = new PeerFrustum({ depth });
      const positions = frustum.geometry.getAttribute("position");
      const nearTopLeftZ = positions.getZ(0);

      assert.ok(Math.abs(nearTopLeftZ - -(depth * 0.5)) < 1e-6);
    }
    finally {
      PeerFrustum.Defaults.nearRatio = original;
    }
  });
});

describe("dispose", () => {
  test("disposes geometry, material and the label's texture/material", () => {
    const frustum = new PeerFrustum({ displayName: "Frank" });
    const { label } = frustum;
    assert.ok(label instanceof PeerFrustumLabel);
    const { map: texture } = label.material;
    assert.ok(texture instanceof THREE.CanvasTexture);

    let geometryDisposed = false;
    let materialDisposed = false;
    let textureDisposed = false;
    let labelMaterialDisposed = false;

    frustum.geometry.addEventListener("dispose", () => {
      geometryDisposed = true;
    });
    frustum.material.addEventListener("dispose", () => {
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
