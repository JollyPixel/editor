// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import { MergedSelectionOverlay } from "#src/index.ts";

function createTarget(
  x: number = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.position.set(x, 0, 0);

  return mesh;
}

describe("constructor (outline style)", () => {
  test("adds a single LineSegments to the given parent, regardless of target count", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget(0), createTarget(5), createTarget(10)];
    for (const target of targets) {
      parent.add(target);
    }

    const overlay = new MergedSelectionOverlay({ parent, style: "outline", targets, color: "#ffffff" });

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

    const overlay = new MergedSelectionOverlay({ parent, style: "outline", targets, color: "#ffffff" });

    assert.strictEqual(overlay.object.geometry.getAttribute("position").count, expectedPerTarget * targets.length);
  });

  test("bakes each target's world position into the merged geometry", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget(0), createTarget(5)];
    for (const target of targets) {
      parent.add(target);
    }
    parent.updateMatrixWorld(true);

    const overlay = new MergedSelectionOverlay({ parent, style: "outline", targets, color: "#ffffff" });
    const position = overlay.object.geometry.getAttribute("position");

    const xs = new Set<number>();
    for (let i = 0; i < position.count; i++) {
      xs.add(Math.round(position.getX(i)));
    }
    // Box half-extent is 0.5, so vertices cluster around each target's own x
    // (-0.5/+0.5 offset rounds back to the target's own integer x).
    assert.ok(xs.has(0) || xs.has(-1) || xs.has(1));
    assert.ok(xs.has(5) || xs.has(4) || xs.has(6));
  });

  test("defaults to white, full opacity, non-transparent", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget()];
    const overlay = new MergedSelectionOverlay({ parent, style: "outline", targets, color: "#ffffff" });

    assert.strictEqual(`#${(overlay.object as THREE.LineSegments).material.color.getHexString()}`, "#ffffff");
    assert.strictEqual((overlay.object as THREE.LineSegments).material.opacity, 1);
    assert.strictEqual((overlay.object as THREE.LineSegments).material.transparent, false);
  });

  test("opacity < 1 marks the material transparent", () => {
    const parent = new THREE.Scene();
    const overlay = new MergedSelectionOverlay({
      parent, style: "outline", targets: [createTarget()], color: "#ffffff", opacity: 0.4
    });

    assert.strictEqual((overlay.object as THREE.LineSegments).material.opacity, 0.4);
    assert.strictEqual((overlay.object as THREE.LineSegments).material.transparent, true);
  });

  test("xray disables depth test/write and raises render order above default objects", () => {
    const parent = new THREE.Scene();
    const overlay = new MergedSelectionOverlay({
      parent, style: "outline", targets: [createTarget()], color: "#ffffff", xray: true
    });

    assert.strictEqual((overlay.object as THREE.LineSegments).material.depthTest, false);
    assert.strictEqual((overlay.object as THREE.LineSegments).material.depthWrite, false);
    assert.ok(overlay.object.renderOrder > 1);
  });
});

describe("constructor (highlight style)", () => {
  test("adds a single Mesh using a MeshBasicNodeMaterial, regardless of target count", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget(0), createTarget(5), createTarget(10)];

    const overlay = new MergedSelectionOverlay({ parent, style: "highlight", targets, color: "#ffffff" });

    assert.strictEqual(overlay.object, parent.children.at(-1));
    assert.ok(overlay.object instanceof THREE.Mesh);
    assert.ok((overlay.object as THREE.Mesh).material instanceof MeshBasicNodeMaterial);
  });

  test("renders back faces only", () => {
    const parent = new THREE.Scene();
    const overlay = new MergedSelectionOverlay({
      parent, style: "highlight", targets: [createTarget()], color: "#ffffff"
    });

    assert.strictEqual((overlay.object as THREE.Mesh<THREE.BufferGeometry, MeshBasicNodeMaterial>).material.side, THREE.BackSide);
  });

  test("merges every target's hull geometry into one buffer", () => {
    const parent = new THREE.Scene();
    const targets = [createTarget(0), createTarget(5)];
    const expectedPerTarget = targets[0].geometry.getAttribute("position").count;

    const overlay = new MergedSelectionOverlay({ parent, style: "highlight", targets, color: "#ffffff" });

    assert.strictEqual(overlay.object.geometry.getAttribute("position").count, expectedPerTarget * targets.length);
  });
});

describe("dispose", () => {
  test("removes itself from the parent and disposes its own geometry/material, not the targets'", () => {
    const parent = new THREE.Scene();
    const target = createTarget();
    parent.add(target);

    const overlay = new MergedSelectionOverlay({ parent, style: "outline", targets: [target], color: "#ffffff" });

    let targetGeometryDisposed = false;
    let mergedGeometryDisposed = false;
    let materialDisposed = false;
    target.geometry.addEventListener("dispose", () => {
      targetGeometryDisposed = true;
    });
    overlay.object.geometry.addEventListener("dispose", () => {
      mergedGeometryDisposed = true;
    });
    (overlay.object as THREE.LineSegments).material.addEventListener("dispose", () => {
      materialDisposed = true;
    });

    overlay.dispose();

    assert.strictEqual(parent.children.length, 1, "only the target itself should remain");
    assert.ok(mergedGeometryDisposed);
    assert.ok(materialDisposed);
    assert.strictEqual(targetGeometryDisposed, false, "must not dispose a target's own geometry");
  });
});
