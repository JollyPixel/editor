// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AreaBoxFill } from "#src/index.ts";

// CONSTANTS
const kColor = "#4da3ff";

function createFill(
  overrides: Partial<ConstructorParameters<typeof AreaBoxFill>[0]> = {}
): AreaBoxFill {
  return new AreaBoxFill({
    color: kColor,
    opacity: 0.75,
    shadeFaces: true,
    ...overrides
  });
}

describe("AreaBoxFill", () => {
  describe("constructor", () => {
    test("paints itself darker than the area color", () => {
      const color = new THREE.Color(kColor);
      const fill = createFill();

      // The fill is smoked so that blending it over the scene darkens what
      // shows through instead of washing it out.
      assert.ok(fill.material.color.r < color.r);
      assert.ok(fill.material.color.g < color.g);
      assert.ok(fill.material.color.b < color.b);
    });

    test("draws above a transparent ground grid", () => {
      // A camera-following grid sorts as the nearest transparent object and
      // would otherwise paint its lines over the area at full strength,
      // which no amount of `opacity` can compensate for.
      assert.ok(createFill().renderOrder > 0);
    });

    test("writes depth so the near face hides the far one", () => {
      const fill = createFill();

      assert.equal(fill.material.transparent, true);
      assert.equal(fill.material.depthWrite, true);
      assert.equal(fill.material.side, THREE.FrontSide);
    });
  });

  describe("face shading", () => {
    test("bakes a brightness per face into the vertex colors", () => {
      const fill = createFill();
      const colors = fill.geometry.getAttribute("color");

      assert.ok(colors);
      // BoxGeometry lays out 6 faces of 4 vertices.
      assert.equal(colors.count, 24);
      assert.equal(fill.material.vertexColors, true);

      // Group order is +X, -X, +Y, -Y, +Z, -Z: the top face is the
      // brightest and the bottom one the darkest, so the faces stay
      // distinguishable without a light in the scene.
      const top = colors.getX(8);
      const bottom = colors.getX(12);
      const side = colors.getX(0);
      assert.equal(top, 1);
      assert.ok(bottom < side);
      assert.ok(side < top);
    });

    test("skips the attribute entirely when disabled", () => {
      const fill = createFill({ shadeFaces: false });

      assert.equal(fill.geometry.getAttribute("color"), undefined);
      assert.equal(fill.material.vertexColors, false);
    });
  });

  describe("resize", () => {
    test("scales the unit box and re-centers it on the min corner", () => {
      const fill = createFill();

      fill.resize({ x: 6, y: 3, z: 4 });

      assert.deepEqual(fill.scale.toArray(), [6, 3, 4]);
      assert.deepEqual(fill.position.toArray(), [3, 1.5, 2]);
    });
  });

  describe("emphasize", () => {
    test("scales the idle opacity", () => {
      const fill = createFill({ opacity: 0.25 });

      fill.emphasize(1.05, 0);

      assert.ok(Math.abs(fill.material.opacity - 0.2625) < 1e-6);
    });

    test("never exceeds a fully opaque material", () => {
      const fill = createFill({ opacity: 0.98 });

      fill.emphasize(1.05, 0);

      assert.equal(fill.material.opacity, 1);
    });

    test("clears the smoke towards the area color", () => {
      const fill = createFill();
      const idle = fill.material.color.clone();

      fill.emphasize(1.05, 0.24);

      // Brighter, and still blue: lerping to white would cost it its
      // identity.
      const active = fill.material.color;
      assert.ok(active.b > idle.b);
      assert.ok(active.b > active.r);
    });

    test("returns to the idle appearance at a zero tint", () => {
      const fill = createFill({ opacity: 0.25 });
      const idle = fill.material.color.getHexString();

      fill.emphasize(1.05, 0.24);
      fill.emphasize(1, 0);

      assert.equal(fill.material.opacity, 0.25);
      assert.equal(fill.material.color.getHexString(), idle);
    });
  });

  describe("dispose", () => {
    test("releases the geometry and the material", () => {
      const fill = createFill();
      let disposed = false;
      fill.geometry.addEventListener("dispose", () => {
        disposed = true;
      });

      fill.dispose();

      assert.equal(disposed, true);
    });
  });
});
