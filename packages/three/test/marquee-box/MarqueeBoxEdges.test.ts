// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MarqueeBox,
  MarqueeBoxEdges,
  type MarqueeBoxEdgesOptions
} from "#src/index.ts";
import {
  MARQUEE_PHASE_END,
  advanceOffset
} from "#src/marquee-box/material.ts";

function createEdges(
  overrides: Partial<MarqueeBoxEdgesOptions> = {}
): MarqueeBoxEdges {
  return new MarqueeBoxEdges({
    ...MarqueeBox.Defaults,
    ...overrides
  });
}

function phaseEnds(
  edges: MarqueeBoxEdges
): number[] {
  const attribute = edges.geometry.getAttribute(MARQUEE_PHASE_END);

  return Array.from(
    { length: attribute.count },
    (_, index) => attribute.getX(index)
  );
}

describe("MarqueeBoxEdges", () => {
  describe("constructor", () => {
    test("stays opaque so it never samples the opaque pass copy", () => {
      assert.equal(createEdges().material.transparent, false);
    });

    test("draws fat lines at the requested pixel width", () => {
      assert.equal(createEdges({ width: 3 }).material.linewidth, 3);
    });

    test("opts out of frustum culling", () => {
      assert.equal(createEdges().frustumCulled, false);
    });

    test("traces the twelve edges of a unit box", () => {
      const edges = createEdges();

      assert.equal(edges.geometry.getAttribute("instanceStart").count, 12);
      assert.deepEqual(
        edges.geometry.boundingBox!.max.toArray(),
        [1, 1, 1]
      );
    });

    test("clamps the ratio between zero and one", () => {
      assert.equal(createEdges({ ratio: 4 }).ratio, 1);
      assert.equal(createEdges({ ratio: -1 }).ratio, 0);
    });
  });

  describe("resize", () => {
    test("rebuilds the segments rather than stretching them", () => {
      const edges = createEdges();

      edges.resize({ x: 6, y: 3, z: 4 });

      const box = edges.geometry.boundingBox!;
      assert.deepEqual(box.min.toArray(), [0, 0, 0]);
      assert.deepEqual(box.max.toArray(), [6, 3, 4]);
      assert.deepEqual(edges.scale.toArray(), [1, 1, 1]);
    });

    test("writes into the same instanced buffers", () => {
      const edges = createEdges();
      const positions = edges.geometry.getAttribute("instanceStart");
      const phases = edges.geometry.getAttribute(MARQUEE_PHASE_END);

      edges.resize({ x: 6, y: 3, z: 4 });

      assert.equal(edges.geometry.getAttribute("instanceStart"), positions);
      assert.equal(edges.geometry.getAttribute(MARQUEE_PHASE_END), phases);
    });

    test("refits the phases to the new size", () => {
      const edges = createEdges({ dashLength: 0.5 });

      edges.resize({ x: 6, y: 3, z: 4 });

      assert.equal(phaseEnds(edges).at(-1), 6);
    });

    test("skips the upload on a resize to the same size", () => {
      const edges = createEdges();
      edges.resize({ x: 6, y: 3, z: 4 });
      const attribute = edges.geometry.getAttribute("instanceStart");
      assert.ok(attribute instanceof THREE.InterleavedBufferAttribute);
      const { version } = attribute.data;

      edges.resize({ x: 6, y: 3, z: 4 });

      assert.equal(attribute.data.version, version);
    });
  });

  describe("style", () => {
    test("refits the phases on a dash length change", () => {
      const edges = createEdges({ dashLength: 0.5 });
      edges.resize({ x: 4, y: 3, z: 2 });

      edges.dashLength = 1;

      assert.equal(edges.dashLength, 1);
      assert.equal(phaseEnds(edges).at(-1), 3);
    });

    test("keeps the dash length above zero", () => {
      const edges = createEdges();

      edges.dashLength = 0;

      assert.ok(edges.dashLength > 0);
      assert.ok(phaseEnds(edges).every(Number.isFinite));
    });

    test("updates the uniforms without rebuilding the material", () => {
      const edges = createEdges();
      const { version } = edges.material;

      edges.ratio = 0.25;
      edges.speed = -2;
      edges.colors = ["#ff0000", "#0000ff"];

      assert.equal(edges.uniforms.ratio.value, 0.25);
      assert.equal(edges.uniforms.speed.value, -2);
      assert.deepEqual(
        edges.colors.map((color) => color.getHexString()),
        ["ff0000", "0000ff"]
      );
      assert.equal(edges.material.version, version);
    });

    test("returns copies of its colors", () => {
      const edges = createEdges();

      edges.colors[0].set("#ff0000");

      assert.equal(edges.colors[0].getHexString(), "ffffff");
    });

    test("draws through other geometry in xray", () => {
      const edges = createEdges();
      const { renderOrder } = edges;

      edges.xray = true;

      assert.equal(edges.xray, true);
      assert.equal(edges.material.depthTest, false);
      assert.ok(edges.renderOrder > renderOrder);
    });
  });

  describe("advanceOffset", () => {
    test("wraps forward motion into a single period", () => {
      assert.ok(Math.abs(advanceOffset(0.75, 0.5) - 0.25) < 1e-9);
    });

    test("wraps reversed motion into a single period", () => {
      assert.ok(Math.abs(advanceOffset(0.25, -0.5) - 0.75) < 1e-9);
    });

    test("holds still at a zero speed", () => {
      assert.equal(advanceOffset(0.4, 0), 0.4);
    });
  });

  describe("dispose", () => {
    test("releases the geometry and the material once", () => {
      const edges = createEdges();
      let disposals = 0;
      edges.geometry.addEventListener("dispose", () => {
        disposals++;
      });

      edges.dispose();
      edges.dispose();

      assert.equal(disposals, 1);
    });
  });
});
