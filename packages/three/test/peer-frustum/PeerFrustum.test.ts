// Import Node.js Dependencies
import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  PeerFrustum,
  PeerFrustumLabel,
  type PeerFrustumDefaults
} from "#src/index.ts";
import { contextOf } from "../fixtures/canvas.ts";
import { watchDisposal } from "../fixtures/disposal.ts";

function overrideDefaults(
  t: TestContext,
  patch: Partial<PeerFrustumDefaults>
): void {
  const original = { ...PeerFrustum.Defaults };
  Object.assign(PeerFrustum.Defaults, patch);
  t.after(() => {
    Object.assign(PeerFrustum.Defaults, original);
  });
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

    assert.strictEqual(positions.count, 12 * 2);
  });

  test("showApex: true adds the apex-tip edges", () => {
    const frustum = new PeerFrustum({ showApex: true });
    const positions = frustum.geometry.getAttribute("position");

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

    assert.equal(frustum.label, null);
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

    frustum.color = "#00ff00";

    assert.strictEqual(frustum.label?.color, "#00ff00");
  });

  test("passes a color set before the label exists to the lazy label", () => {
    const frustum = new PeerFrustum();
    frustum.color = "#ff0000";

    frustum.displayName = "Alice";

    assert.strictEqual(frustum.label?.color, "#ff0000");
  });
});

describe("opacity", () => {
  test("clamps to 0..1", () => {
    const frustum = new PeerFrustum();

    frustum.opacity = 2;
    assert.strictEqual(frustum.opacity, 1);

    frustum.opacity = -1;
    assert.strictEqual(frustum.opacity, 0);
  });

  test("passes the opacity to a label created later", () => {
    const frustum = new PeerFrustum();
    frustum.opacity = 0.5;

    frustum.displayName = "Alice";

    assert.strictEqual(frustum.label?.opacity, 0.5);
  });
});

describe("displayName", () => {
  test("creates a label lazily if none exists yet", () => {
    const frustum = new PeerFrustum();
    assert.equal(frustum.label, null);

    frustum.displayName = "Carol";

    const label: unknown = frustum.label;
    assert.ok(label instanceof PeerFrustumLabel);
    assert.strictEqual(frustum.children.length, 1);
  });

  test("updates an existing label instead of replacing it", () => {
    const frustum = new PeerFrustum({ displayName: "Dave" });
    const label = frustum.label;

    frustum.displayName = "Erin";

    assert.strictEqual(frustum.label, label);
    assert.strictEqual(frustum.displayName, "Erin");
    assert.strictEqual(frustum.children.length, 1);
  });
});

describe("showNameBox", () => {
  test("applies the retained value when a label is created later", () => {
    const frustum = new PeerFrustum();
    frustum.showNameBox = true;

    frustum.displayName = "Alice";

    const { label } = frustum;
    assert.ok(label instanceof PeerFrustumLabel);
    assert.strictEqual(contextOf(label).roundRectCallCount, 1);
  });
});

describe("PeerFrustum.Defaults", () => {
  test("new PeerFrustum() falls back to a mutated PeerFrustum.Defaults value", (t) => {
    overrideDefaults(t, { color: "#ff00ff" });
    const frustum = new PeerFrustum();

    assert.strictEqual(
      `#${frustum.material.color.getHexString()}`,
      "#ff00ff"
    );
  });

  test("mutating PeerFrustum.Defaults does not affect already-constructed instances", (t) => {
    const frustum = new PeerFrustum();
    overrideDefaults(t, { color: "#ff00ff" });

    assert.strictEqual(
      `#${frustum.material.color.getHexString()}`,
      "#43aa8b"
    );
  });

  test("constructor options still override a mutated PeerFrustum.Defaults value", (t) => {
    overrideDefaults(t, { color: "#ff00ff" });
    const frustum = new PeerFrustum({ color: "#00ff00" });

    assert.strictEqual(
      `#${frustum.material.color.getHexString()}`,
      "#00ff00"
    );
  });

  test("PeerFrustum.Defaults.nearRatio drives the derived near when near is omitted", (t) => {
    overrideDefaults(t, { nearRatio: 0.5 });
    const depth = 3;
    const frustum = new PeerFrustum({ depth });
    const positions = frustum.geometry.getAttribute("position");
    const nearTopLeftZ = positions.getZ(0);

    assert.ok(Math.abs(nearTopLeftZ - -(depth * 0.5)) < 1e-6);
  });
});

describe("dispose", () => {
  test("disposes geometry, material and the label's texture/material", () => {
    const frustum = new PeerFrustum({ displayName: "Frank" });
    const { label } = frustum;
    assert.ok(label instanceof PeerFrustumLabel);
    const disposals = watchDisposal(
      frustum.geometry,
      frustum.material,
      label.material.map ?? undefined,
      label.material
    );

    frustum.dispose();

    assert.deepEqual(disposals, [1, 1, 1, 1]);
  });

  test("disposes geometry and material without a label", () => {
    const frustum = new PeerFrustum();
    const disposals = watchDisposal(frustum.geometry, frustum.material);

    frustum.dispose();

    assert.deepEqual(disposals, [1, 1]);
  });
});
