// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionOutline, SelectionBoundingBox } from "#src/index.ts";
import { createDefaultSelectionOverlayRegistry } from "#src/selection/overlays/builtinSelectionOverlayFactories.ts";

// CONSTANTS
const kRegistry = createDefaultSelectionOverlayRegistry();

describe("SelectionOverlayRegistry.create", () => {
  test("builds a SelectionOutline for a mesh with technique \"outline\"", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(mesh, { technique: "outline", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof SelectionOutline);
  });

  test("builds a SelectionBoundingBox for a non-mesh target regardless of technique", () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const overlay = kRegistry.create(group, { technique: "outline", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof SelectionBoundingBox);
  });

  test("falls back to \"outline\" for a mesh given an unregistered technique id", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(mesh, { technique: "highlight", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof SelectionOutline);
  });

  test("builds a SelectionBoundingBox for a mesh explicitly given technique \"boundingBox\"", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(mesh, { technique: "boundingBox", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof SelectionBoundingBox);
  });

  test("forwards linewidth to a SelectionOutline", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(
      mesh,
      { technique: "outline", color: "#ffffff", opacity: 1, linewidth: 3 }
    ) as SelectionOutline;

    assert.strictEqual(overlay.material.linewidth, 3);
  });

  test("forwards xray to a SelectionOutline", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(
      mesh,
      { technique: "outline", color: "#ffffff", opacity: 1, xray: true }
    ) as SelectionOutline;

    assert.strictEqual(overlay.material.depthTest, false);
  });

  test("forwards xray to a SelectionBoundingBox", () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const overlay = kRegistry.create(
      group,
      { technique: "outline", color: "#ffffff", opacity: 1, xray: true }
    ) as SelectionBoundingBox;

    assert.strictEqual(overlay.material.depthTest, false);
  });
});
