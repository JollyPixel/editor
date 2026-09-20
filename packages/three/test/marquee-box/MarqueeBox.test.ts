// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { MarqueeBox } from "#src/index.ts";

describe("MarqueeBox", () => {
  describe("constructor", () => {
    test("defaults to a unit box at the origin", () => {
      const marquee = new MarqueeBox();

      assert.deepEqual(marquee.size.toArray(), [1, 1, 1]);
      assert.deepEqual(marquee.position.toArray(), [0, 0, 0]);
      assert.equal(marquee.type, "MarqueeBox");
    });

    test("anchors the box at its min corner", () => {
      const marquee = new MarqueeBox({
        position: { x: 2, y: 1, z: -3 },
        size: { x: 4, y: 3, z: 2 }
      });

      assert.equal(marquee.min, marquee.position);
      assert.deepEqual(marquee.min.toArray(), [2, 1, -3]);
      assert.deepEqual(
        marquee.edges.geometry.boundingBox!.max.toArray(),
        [4, 3, 2]
      );
    });

    test("forwards the style to its edges", () => {
      const marquee = new MarqueeBox({
        width: 4,
        dashLength: 2,
        ratio: 0.25,
        speed: 0,
        colors: ["#ff0000", "#0000ff"],
        xray: true
      });
      const { edges } = marquee;

      assert.equal(edges.width, 4);
      assert.equal(edges.dashLength, 2);
      assert.equal(edges.ratio, 0.25);
      assert.equal(edges.speed, 0);
      assert.equal(edges.colors[1].getHexString(), "0000ff");
      assert.equal(edges.xray, true);
    });

    test("falls back on the static defaults", () => {
      const { edges } = new MarqueeBox();

      assert.equal(edges.width, MarqueeBox.Defaults.width);
      assert.equal(edges.speed, MarqueeBox.Defaults.speed);
    });
  });

  describe("size", () => {
    test("returns a copy", () => {
      const marquee = new MarqueeBox({ size: { x: 4, y: 3, z: 2 } });

      marquee.size.set(9, 9, 9);

      assert.deepEqual(marquee.size.toArray(), [4, 3, 2]);
    });

    test("keeps every extent above zero", () => {
      const marquee = new MarqueeBox();

      marquee.size = { x: 0, y: -2, z: 3 };

      const size = marquee.size;
      assert.ok(size.x > 0);
      assert.ok(size.y > 0);
      assert.equal(size.z, 3);
    });

    test("copies into a caller provided target", () => {
      const marquee = new MarqueeBox({ size: { x: 4, y: 3, z: 2 } });
      const target = new THREE.Vector3();

      assert.equal(marquee.copySizeTo(target), target);
      assert.deepEqual(target.toArray(), [4, 3, 2]);
    });
  });

  describe("Box3", () => {
    test("round trips through a Box3", () => {
      const marquee = new MarqueeBox();
      const box = new THREE.Box3(
        new THREE.Vector3(-1, 0, 2),
        new THREE.Vector3(3, 2, 5)
      );

      marquee.fromBox3(box);

      assert.deepEqual(marquee.position.toArray(), [-1, 0, 2]);
      assert.deepEqual(marquee.size.toArray(), [4, 2, 3]);
      assert.ok(marquee.toBox3().equals(box));
    });
  });

  describe("dispose", () => {
    test("disposes its edges once", () => {
      const marquee = new MarqueeBox();
      let disposals = 0;
      marquee.edges.geometry.addEventListener("dispose", () => {
        disposals++;
      });

      marquee.dispose();
      marquee.dispose();

      assert.equal(disposals, 1);
    });
  });
});
