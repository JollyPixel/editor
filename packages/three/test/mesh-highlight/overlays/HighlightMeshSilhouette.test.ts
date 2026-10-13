// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightBoxSilhouette,
  HighlightMeshSilhouette,
  type HighlightSilhouette
} from "#src/index.ts";
import {
  createDefaultHighlightOverlayRegistry
} from "#src/mesh-highlight/overlays/builtinHighlightOverlayFactories.ts";
import { createBoxMesh } from "../helpers.ts";
import { backPassOf } from "./helpers.ts";

// CONSTANTS
const kVerticesPerContourEdge = 4 * 6;

function createPlaneMesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
}

function vertexCountOf(
  overlay: HighlightSilhouette
): number {
  return overlay.geometry.getAttribute("position").count;
}

describe("HighlightMeshSilhouette", () => {
  test("outlines only the six contour edges of a box mesh seen corner-on", () => {
    const target = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
    const overlay = new HighlightMeshSilhouette({ target, innerThickness: 0 });

    overlay.update(new THREE.Vector3(100, 100, 100));

    assert.strictEqual(vertexCountOf(overlay), 6 * kVerticesPerContourEdge);
  });

  test("outlines the border of a plane, outside it, from either side", () => {
    const overlay = new HighlightMeshSilhouette({
      target: createPlaneMesh(),
      innerThickness: 0.02,
      linewidth: 0.05
    });

    for (const y of [100, -100]) {
      overlay.update(new THREE.Vector3(1, y, 1));
      overlay.geometry.computeBoundingBox();
      const bounds = overlay.geometry.boundingBox as THREE.Box3;

      assert.strictEqual(vertexCountOf(overlay), 2 * 4 * kVerticesPerContourEdge);
      assert.ok(bounds.max.x >= 0.5 + 0.07 - 1e-6);
      assert.ok(bounds.min.z <= -0.5 - 0.07 + 1e-6);
    }
  });

  test("keeps its geometry while the contour stays the same and rebuilds it once it changes", () => {
    const overlay = new HighlightMeshSilhouette({
      target: new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 12))
    });
    overlay.update(new THREE.Vector3(100, 50, 0));
    const { geometry } = overlay;

    overlay.update(new THREE.Vector3(120, 60, 0));
    assert.strictEqual(overlay.geometry, geometry);

    overlay.update(new THREE.Vector3(0, 50, 100));
    assert.notStrictEqual(overlay.geometry, geometry);
  });

  test("draws box bars on a BoxGeometry and the contour on any other geometry, as its target changes", () => {
    const camera = new THREE.Vector3(100, 100, 100);
    const boxBars = new HighlightBoxSilhouette({ target: createBoxMesh() });
    boxBars.update(camera);
    const coneContour = new HighlightMeshSilhouette({
      target: new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4))
    });
    coneContour.update(camera);
    const target = createBoxMesh();
    const overlay = new HighlightMeshSilhouette({ target, xray: true });

    overlay.update(camera);
    assert.strictEqual(vertexCountOf(overlay), vertexCountOf(boxBars));

    target.geometry = new THREE.ConeGeometry(0.5, 1, 4);
    overlay.update(camera);
    assert.strictEqual(vertexCountOf(overlay), vertexCountOf(coneContour));
    assert.strictEqual(backPassOf(overlay)?.geometry, overlay.geometry);

    target.geometry = new THREE.BoxGeometry(1, 1, 1);
    overlay.update(camera);
    assert.strictEqual(vertexCountOf(overlay), vertexCountOf(boxBars));
  });
});

describe("silhouette factory", () => {
  test("outlines any mesh, where the box silhouette falls back to its bounds", () => {
    const registry = createDefaultHighlightOverlayRegistry();
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8));

    assert.strictEqual(registry.resolve("silhouette", cylinder).id, "silhouette");
    assert.strictEqual(registry.resolve("boxSilhouette", cylinder).id, "outline");
    assert.ok(registry.create(cylinder, {
      technique: "silhouette",
      color: "#ffffff",
      opacity: 1
    }) instanceof HighlightMeshSilhouette);
  });
});
