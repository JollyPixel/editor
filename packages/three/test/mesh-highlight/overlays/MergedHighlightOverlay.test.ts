// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { MergedHighlightOverlay } from "#src/index.ts";
import { watchDisposal } from "../../fixtures/disposal.ts";

function createTarget(
  x: number = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.position.set(x, 0, 0);

  return mesh;
}

describe("constructor", () => {
  test("adds a single LineSegments to the given parent, regardless of target count", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget(0), createTarget(5), createTarget(10)];
    for (const target of targets) {
      parent.add(target);
    }

    const overlay = new MergedHighlightOverlay({ parent, targets, color: "#ffffff" });

    assert.strictEqual(overlay.object, parent.children.at(-1));
    assert.ok(overlay.object instanceof THREE.LineSegments);
  });

  test("merges every target's edge geometry into one buffer", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget(0), createTarget(5)];
    for (const target of targets) {
      parent.add(target);
    }
    const expectedPerTarget = new THREE.EdgesGeometry(targets[0].geometry).getAttribute("position").count;

    const overlay = new MergedHighlightOverlay({ parent, targets, color: "#ffffff" });

    assert.strictEqual(
      overlay.object.geometry.getAttribute("position").count,
      expectedPerTarget * targets.length
    );
  });

  test("bakes each target's world position into the merged geometry", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget(0), createTarget(5)];
    for (const target of targets) {
      parent.add(target);
    }

    const overlay = new MergedHighlightOverlay({ parent, targets, color: "#ffffff" });
    const bounds = new THREE.Box3().setFromObject(overlay.object);

    assert.strictEqual(bounds.min.x, -0.5);
    assert.strictEqual(bounds.max.x, 5.5);
  });

  test("defaults to full opacity, non-transparent", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget()];
    const overlay = new MergedHighlightOverlay({ parent, targets, color: "#ffffff" });

    assert.strictEqual(overlay.object.material.opacity, 1);
    assert.strictEqual(overlay.object.material.transparent, false);
  });

  test("opacity < 1 marks the material transparent", () => {
    const parent = new THREE.Scene();
    const overlay = new MergedHighlightOverlay({
      parent, targets: [createTarget()], color: "#ffffff", opacity: 0.4
    });

    assert.strictEqual(overlay.object.material.opacity, 0.4);
    assert.strictEqual(overlay.object.material.transparent, true);
  });

  test("xray disables depth test/write and raises render order above default objects", () => {
    const parent = new THREE.Scene();
    const overlay = new MergedHighlightOverlay({
      parent, targets: [createTarget()], color: "#ffffff", xray: true
    });

    assert.strictEqual(overlay.object.material.depthTest, false);
    assert.strictEqual(overlay.object.material.depthWrite, false);
    assert.ok(overlay.object.renderOrder > 1);
  });
});

describe("dispose", () => {
  test("removes itself from the parent and disposes its own geometry/material, not the targets'", () => {
    const parent = new THREE.Scene();
    const target = createTarget();
    parent.add(target);

    const overlay = new MergedHighlightOverlay({ parent, targets: [target], color: "#ffffff" });
    const counts = watchDisposal(
      target.geometry,
      overlay.object.geometry,
      overlay.object.material
    );

    overlay.dispose();

    assert.strictEqual(parent.children.length, 1, "only the target itself should remain");
    assert.deepStrictEqual(counts, [0, 1, 1]);
  });
});
