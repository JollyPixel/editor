// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { HighlightBoxSilhouette } from "#src/index.ts";
import { createBoxMesh } from "../helpers.ts";
import {
  backPassOf,
  lastColorOf
} from "./helpers.ts";

describe("update", () => {
  test("keeps only the 4 edges and their corner joints for a single camera-facing side", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), innerThickness: 0 });

    overlay.update(new THREE.Vector3(100, 0, 0));

    assert.strictEqual(overlay.geometry.getAttribute("position").count, 192);
    assert.strictEqual(overlay.geometry.getIndex()?.count, 192);
  });

  test("excludes interior creases, keeping 6 edges and their joints for a corner-on view", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), innerThickness: 0 });

    overlay.update(new THREE.Vector3(100, 100, 100));

    assert.strictEqual(overlay.geometry.getAttribute("position").count, 288);
    assert.strictEqual(overlay.geometry.getIndex()?.count, 288);
  });

  test("skips rewriting the geometry when the camera stays on the same side", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });
    overlay.update(new THREE.Vector3(100, 0, 0));
    const { geometry } = overlay;

    overlay.update(new THREE.Vector3(120, 0, 0));

    assert.strictEqual(overlay.geometry, geometry);
  });

  test("rewrites the geometry once the camera crosses to another side", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });
    overlay.update(new THREE.Vector3(100, 0, 0));
    const { geometry } = overlay;

    overlay.update(new THREE.Vector3(-100, 0, 0));

    assert.notStrictEqual(overlay.geometry, geometry);
  });

  test("keeps the occluded pass sharing the rebuilt geometry", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true });

    overlay.update(new THREE.Vector3(100, 0, 0));

    assert.strictEqual(backPassOf(overlay)?.geometry, overlay.geometry);
  });

  test("recolors the rebuilt geometry's outer ring after a color change", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), color: "#ff0000" });
    overlay.color = "#0000ff";

    overlay.update(new THREE.Vector3(100, 0, 0));

    assert.strictEqual(`#${lastColorOf(overlay.geometry).getHexString()}`, "#0000ff");
  });

  test("still accepts a color change after a camera inside the box left nothing to draw", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });

    overlay.update(new THREE.Vector3(0, 0, 0));
    overlay.color = "#0000ff";

    assert.strictEqual(overlay.geometry.getAttribute("position").count, 0);
    assert.strictEqual(`#${overlay.color.getHexString()}`, "#0000ff");
  });
});
