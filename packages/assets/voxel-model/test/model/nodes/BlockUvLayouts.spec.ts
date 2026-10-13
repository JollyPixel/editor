// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockUvLayouts } from "#src/model/nodes/BlockUvLayouts.ts";

// CONSTANTS
const kNet = new BlockUvLayouts([BlockUvLayouts.net()]).extent;
const kTexture = {
  x: kNet.x * 2,
  y: kNet.y * 2
};

describe("BlockUvLayouts", () => {
  test("unfolds the six faces of a net at the texture origin by default", () => {
    assert.equal(BlockUvLayouts.net().state, "unfolded");
    assert.ok(kNet.x > 0 && kNet.y > 0);
  });

  test("places a net at the given origin", () => {
    const extent = new BlockUvLayouts([BlockUvLayouts.net({ x: 32, y: 16 })]).extent;

    assert.deepEqual(extent, {
      x: 32 + kNet.x,
      y: 16 + kNet.y
    });
  });

  test("reaches the farthest right and bottom edges of all layouts", () => {
    const layouts = new BlockUvLayouts([
      BlockUvLayouts.net(),
      BlockUvLayouts.net({ x: 40, y: 0 }),
      BlockUvLayouts.net({ x: 0, y: 20 })
    ]);

    assert.deepEqual(layouts.extent, {
      x: 40 + kNet.x,
      y: 20 + kNet.y
    });
  });

  test("is empty without layouts", () => {
    assert.deepEqual(new BlockUvLayouts([]).extent, { x: 0, y: 0 });
  });

  test("places the next net at the texture origin when empty", () => {
    assert.deepEqual(new BlockUvLayouts([]).nextNet(kTexture), BlockUvLayouts.net());
  });

  test("places the next net in the first free cell, row by row", () => {
    const layouts = new BlockUvLayouts([BlockUvLayouts.net()]);

    assert.deepEqual(layouts.nextNet(kTexture), BlockUvLayouts.net({ x: kNet.x, y: 0 }));
  });

  test("fills a gap left by a removed block", () => {
    const layouts = new BlockUvLayouts([
      BlockUvLayouts.net(),
      BlockUvLayouts.net({ x: 0, y: kNet.y })
    ]);

    assert.deepEqual(layouts.nextNet(kTexture), BlockUvLayouts.net({ x: kNet.x, y: 0 }));
  });

  test("gives a plane one cell for its single top face", () => {
    const net = BlockUvLayouts.net({ x: 8, y: 4 }, { type: "plane" });

    assert.ok(net.state === "unfolded");
    assert.deepEqual(Object.keys(net.faces), ["top"]);
    assert.deepEqual(new BlockUvLayouts([net]).extent, { x: 8 + 16, y: 4 + 16 });
  });

  test("keeps a reshaped net where the old one started while it stays free and inside the texture", () => {
    const others = new BlockUvLayouts([BlockUvLayouts.net({ x: kNet.x, y: 0 })]);
    const plane = { type: "plane" } as const;
    const box = { type: "box" } as const;

    assert.deepEqual(
      others.reshaped(BlockUvLayouts.net(BlockUvLayouts.ORIGIN, plane), plane, box, kTexture),
      BlockUvLayouts.net()
    );
    assert.deepEqual(
      others.reshaped(BlockUvLayouts.net({ x: 0, y: kNet.y }), box, plane, kTexture),
      BlockUvLayouts.net({ x: 0, y: kNet.y }, plane)
    );
  });

  test("moves a reshaped net to the first free cell when it would overlap or leave the texture", () => {
    const others = new BlockUvLayouts([BlockUvLayouts.net({ x: kNet.x, y: 0 })]);
    const plane = { type: "plane" } as const;
    const box = { type: "box" } as const;

    assert.deepEqual(
      others.reshaped(BlockUvLayouts.net({ x: kNet.x - 16, y: 0 }, plane), plane, box, kTexture),
      BlockUvLayouts.net()
    );

    const nearEdge = BlockUvLayouts.net({ x: kTexture.x - 16, y: kNet.y }, plane);
    assert.deepEqual(others.reshaped(nearEdge, plane, box, kTexture), BlockUvLayouts.net());
  });

  test("stacks every face of a round shape on one cell", () => {
    const net = BlockUvLayouts.net({ x: 16, y: 0 }, { type: "cylinder", sides: 3 });
    const cell = { x: 16, y: 0, width: 16, height: 16 };

    assert.deepEqual(net, {
      state: "stacked",
      rect: cell,
      faces: {
        "side-0": cell,
        "side-1": cell,
        "side-2": cell,
        top: cell,
        bottom: cell
      }
    });
  });

  describe("when only the sides change", () => {
    const kTexture64 = { x: 64, y: 64 };

    function cone(
      sides: number
    ) {
      return { type: "cone" as const, sides };
    }

    function cell(
      x: number,
      y = 0
    ) {
      return { x, y, width: 16, height: 16 };
    }

    function triangle(
      rect: ReturnType<typeof cell>
    ) {
      return {
        shape: "compound" as const,
        rect,
        parts: [
          {
            shape: "triangle" as const,
            rect: { x: 0, y: 0, width: 0.5, height: 1 },
            corner: "bottom-right" as const
          },
          {
            shape: "triangle" as const,
            rect: { x: 0.5, y: 0, width: 0.5, height: 1 },
            corner: "bottom-left" as const
          }
        ]
      };
    }

    test("gives a cone's sides triangle cells pointing up and keeps its base a rectangle", () => {
      const net = BlockUvLayouts.net(BlockUvLayouts.ORIGIN, cone(3));

      assert.deepEqual(net.faces, {
        "side-0": triangle(cell(0)),
        "side-1": triangle(cell(0)),
        "side-2": triangle(cell(0)),
        bottom: cell(0)
      });
    });

    test("a stacked region gains and loses side faces on its one cell", () => {
      const layouts = new BlockUvLayouts([]);
      const stacked = BlockUvLayouts.net(BlockUvLayouts.ORIGIN, cone(3));

      assert.deepEqual(
        layouts.reshaped(stacked, cone(3), cone(4), kTexture64),
        BlockUvLayouts.net(BlockUvLayouts.ORIGIN, cone(4))
      );

      const focused = { ...stacked, stackedFace: "side-2" };
      const grown = layouts.reshaped(focused, cone(3), cone(4), kTexture64);
      assert.equal(Reflect.get(grown, "stackedFace"), "side-2");
      assert.equal("stackedFace" in layouts.reshaped(focused, cone(3), cone(2), kTexture64), false);
    });

    test("leaves a torus layout untouched when only its ring sides or thickness change", () => {
      const torus = { type: "torus" as const, sides: 3, ringSides: 6, thickness: 0.35 };
      const layout = BlockUvLayouts.net(BlockUvLayouts.ORIGIN, torus);
      const layouts = new BlockUvLayouts([]);

      const reshaped = { ...torus, ringSides: 12, thickness: 0.6 };
      assert.deepEqual(layouts.reshaped(layout, torus, reshaped, kTexture64), layout);
    });

    test("an unfolded region keeps its cells, adds new sides in free space and drops removed ones", () => {
      const others = new BlockUvLayouts([{ state: "stacked", rect: cell(48) }]);
      const unfolded = {
        state: "unfolded" as const,
        faces: {
          "side-0": cell(0),
          "side-1": cell(16),
          "side-2": cell(32),
          bottom: cell(0, 16)
        },
        activeFaces: ["side-0", "side-1", "side-2", "bottom"]
      };

      assert.deepEqual(others.reshaped(unfolded, cone(3), cone(4), kTexture64), {
        ...unfolded,
        faces: { ...unfolded.faces, "side-3": triangle(cell(16, 16)) },
        activeFaces: ["side-0", "side-1", "side-2", "bottom", "side-3"]
      });
      assert.deepEqual(others.reshaped(unfolded, cone(3), cone(2), kTexture64), {
        ...unfolded,
        faces: { "side-0": cell(0), "side-1": cell(16), bottom: cell(0, 16) },
        activeFaces: ["side-0", "side-1", "bottom"]
      });
    });
  });

  test("falls back to the texture origin once the texture is full", () => {
    const layouts = new BlockUvLayouts([
      BlockUvLayouts.net(),
      BlockUvLayouts.net({ x: kNet.x, y: 0 }),
      BlockUvLayouts.net({ x: 0, y: kNet.y }),
      BlockUvLayouts.net({ x: kNet.x, y: kNet.y })
    ]);

    assert.deepEqual(layouts.nextNet(kTexture), BlockUvLayouts.net());
  });
});
