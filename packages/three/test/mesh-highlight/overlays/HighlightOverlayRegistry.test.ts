// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { HighlightOutline, HighlightBoundingBox } from "#src/index.ts";
import {
  createDefaultHighlightOverlayRegistry
} from "#src/mesh-highlight/overlays/builtinHighlightOverlayFactories.ts";

// CONSTANTS
const kRegistry = createDefaultHighlightOverlayRegistry();

describe("HighlightOverlayRegistry.create", () => {
  test("builds a HighlightOutline for a mesh with technique \"outline\"", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(mesh, { technique: "outline", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof HighlightOutline);
  });

  test("builds a HighlightBoundingBox for a non-mesh target regardless of technique", () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const overlay = kRegistry.create(group, { technique: "outline", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof HighlightBoundingBox);
  });

  test("falls back to \"outline\" for a mesh given an unregistered technique id", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(mesh, { technique: "highlight", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof HighlightOutline);
  });

  test("builds a HighlightBoundingBox for a mesh explicitly given technique \"boundingBox\"", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(mesh, { technique: "boundingBox", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof HighlightBoundingBox);
  });

  test("forwards linewidth to a HighlightOutline", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(
      mesh,
      { technique: "outline", color: "#ffffff", opacity: 1, linewidth: 3 }
    ) as HighlightOutline;

    assert.strictEqual(overlay.material.linewidth, 3);
  });

  test("forwards xray to a HighlightOutline", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = kRegistry.create(
      mesh,
      { technique: "outline", color: "#ffffff", opacity: 1, xray: true }
    ) as HighlightOutline;

    assert.strictEqual(overlay.material.depthTest, false);
  });

  test("forwards xray to a HighlightBoundingBox", () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const overlay = kRegistry.create(
      group,
      { technique: "outline", color: "#ffffff", opacity: 1, xray: true }
    ) as HighlightBoundingBox;

    assert.strictEqual(overlay.material.depthTest, false);
  });
});
