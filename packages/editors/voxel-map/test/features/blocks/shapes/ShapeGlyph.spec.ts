// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  Cube,
  Slab
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { ShapeGlyph } from "../../../../src/features/blocks/shapes/ShapeGlyph.ts";

function bounds(
  glyph: ShapeGlyph
): { minY: number; maxY: number; } {
  const ys = glyph.faces.flatMap((face) => face.points.map(([, y]) => y));

  return {
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

describe("ShapeGlyph", () => {
  it("draws the three cube faces turned towards the viewer, top lit brightest", () => {
    const glyph = new ShapeGlyph(new Cube());

    assert.equal(glyph.faces.length, 3);
    const brightest = glyph.faces.reduce(
      (best, face) => (face.light > best.light ? face : best)
    );
    assert.equal(
      Math.min(...brightest.points.map(([, y]) => y)),
      bounds(glyph).minY
    );
  });

  it("keeps a bottom slab below the cube top and every shape inside the shared view box", () => {
    const cube = bounds(new ShapeGlyph(new Cube()));
    const slab = bounds(new ShapeGlyph(new Slab("bottom")));
    const [x, y, width, height] = ShapeGlyph.VIEW_BOX.split(" ").map(Number);

    assert.equal(slab.maxY, cube.maxY);
    assert.ok(slab.minY > cube.minY);
    for (const shape of BlockShapeRegistry.createDefault()) {
      for (const face of new ShapeGlyph(shape).faces) {
        for (const [px, py] of face.points) {
          assert.ok(px >= x && px <= x + width, `${shape.id} x`);
          assert.ok(py >= y && py <= y + height, `${shape.id} y`);
        }
      }
    }
  });
});
