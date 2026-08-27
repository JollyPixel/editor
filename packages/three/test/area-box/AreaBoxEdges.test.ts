// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AreaBoxEdges } from "#src/index.ts";

// CONSTANTS
const kColor = "#4da3ff";

function createEdges(
  overrides: Partial<ConstructorParameters<typeof AreaBoxEdges>[0]> = {}
): AreaBoxEdges {
  return new AreaBoxEdges({
    color: kColor,
    width: 2,
    opacity: 1,
    ...overrides
  });
}

describe("AreaBoxEdges", () => {
  describe("constructor", () => {
    test("carries the pure area color", () => {
      const edges = createEdges();

      assert.equal(
        edges.material.color.getHexString(),
        new THREE.Color(kColor).getHexString()
      );
    });

    test("draws fat lines at the requested pixel width", () => {
      // Fat lines rather than LineSegments: line width is capped at one
      // pixel on both renderers, so a plain line cannot draw a thicker rim.
      assert.equal(createEdges({ width: 3 }).material.linewidth, 3);
    });

    test("opts out of frustum culling", () => {
      // Fat lines expand beyond the source segments used for frustum tests.
      assert.equal(createEdges().frustumCulled, false);
    });
  });

  describe("resize", () => {
    test("traces the twelve box edges", () => {
      const edges = createEdges();

      edges.resize({ x: 6, y: 3, z: 4 });

      assert.equal(edges.geometry.getAttribute("instanceStart").count, 12);
    });

    test("rebuilds the segments rather than stretching them", () => {
      const edges = createEdges();

      edges.resize({ x: 6, y: 3, z: 4 });

      const box = edges.geometry.boundingBox!;
      assert.deepEqual(box.min.toArray(), [0, 0, 0]);
      assert.deepEqual(box.max.toArray(), [6, 3, 4]);
      assert.ok(edges.geometry.boundingSphere!.radius > 0);
      // Scaling would have moved the node itself instead.
      assert.deepEqual(edges.scale.toArray(), [1, 1, 1]);
    });

    test("shrinks the bounds back down on a smaller size", () => {
      const edges = createEdges();

      edges.resize({ x: 6, y: 3, z: 4 });
      edges.resize({ x: 1, y: 1, z: 1 });

      assert.deepEqual(edges.geometry.boundingBox!.max.toArray(), [1, 1, 1]);
    });
  });

  describe("emphasize", () => {
    test("scales the idle opacity", () => {
      const edges = createEdges({ opacity: 0.5 });

      edges.emphasize(1.05, 0);

      assert.ok(edges.material.opacity > 0.5);
    });

    test("never exceeds a fully opaque material", () => {
      const edges = createEdges({ opacity: 0.98 });

      edges.emphasize(1.05, 0);

      assert.equal(edges.material.opacity, 1);
    });

    test("tints towards white without reaching it", () => {
      const color = new THREE.Color(kColor);
      const edges = createEdges();

      edges.emphasize(1.05, 0.24);

      const active = edges.material.color;
      assert.ok(active.r > color.r);
      assert.notEqual(active.getHexString(), "ffffff");
      // Still recognizably the area color.
      assert.ok(active.b > active.r);
    });

    test("returns to the idle appearance at a zero tint", () => {
      const edges = createEdges({ opacity: 0.5 });

      edges.emphasize(1.05, 0.24);
      edges.emphasize(1, 0);

      assert.equal(edges.material.opacity, 0.5);
      assert.equal(
        edges.material.color.getHexString(),
        new THREE.Color(kColor).getHexString()
      );
    });
  });

  describe("dispose", () => {
    test("releases the geometry and the material", () => {
      const edges = createEdges();
      let disposed = false;
      edges.geometry.addEventListener("dispose", () => {
        disposed = true;
      });

      edges.dispose();

      assert.equal(disposed, true);
    });
  });
});
