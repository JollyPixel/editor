// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createSelectionOverlay, SelectionOutline, SelectionHighlight, SelectionBoundingBox } from "#src/index.ts";

describe("createSelectionOverlay", () => {
  test("builds a SelectionOutline for a mesh with style \"outline\"", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = createSelectionOverlay(mesh, { style: "outline", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof SelectionOutline);
  });

  test("builds a SelectionHighlight for a mesh with style \"highlight\"", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = createSelectionOverlay(mesh, { style: "highlight", color: "#ffffff", opacity: 1 });

    assert.ok(overlay instanceof SelectionHighlight);
  });

  test("builds a SelectionBoundingBox for a non-mesh target regardless of style", () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const outlineStyled = createSelectionOverlay(group, { style: "outline", color: "#ffffff", opacity: 1 });
    const highlightStyled = createSelectionOverlay(group, { style: "highlight", color: "#ffffff", opacity: 1 });

    assert.ok(outlineStyled instanceof SelectionBoundingBox);
    assert.ok(highlightStyled instanceof SelectionBoundingBox);
  });

  test("forwards linewidth to a SelectionOutline", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = createSelectionOverlay(
      mesh,
      { style: "outline", color: "#ffffff", opacity: 1, linewidth: 3 }
    ) as SelectionOutline;

    assert.strictEqual(overlay.material.linewidth, 3);
  });

  test("forwards thickness and xray to a SelectionHighlight", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = createSelectionOverlay(
      mesh,
      { style: "highlight", color: "#ffffff", opacity: 1, thickness: 0.1, xray: true }
    ) as SelectionHighlight;

    assert.strictEqual(overlay.material.depthTest, false);
  });

  test("forwards xray to a SelectionOutline", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const overlay = createSelectionOverlay(
      mesh,
      { style: "outline", color: "#ffffff", opacity: 1, xray: true }
    ) as SelectionOutline;

    assert.strictEqual(overlay.material.depthTest, false);
  });

  test("forwards xray to a SelectionBoundingBox", () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const overlay = createSelectionOverlay(
      group,
      { style: "outline", color: "#ffffff", opacity: 1, xray: true }
    ) as SelectionBoundingBox;

    assert.strictEqual(overlay.material.depthTest, false);
  });
});
