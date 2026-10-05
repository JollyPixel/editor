// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelDocument,
  VoxelView,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { applyBrushStroke } from "../../../../src/features/painting/interaction/applyBrushStroke.ts";
import {
  BrushStroke,
  type VoxelPaint
} from "../../../../src/features/painting/model/BrushStroke.ts";

interface FakeEngine {
  view: VoxelView;
  removed: string[];
}

function cellKey(
  cell: VoxelCoord
): string {
  return `${cell.x},${cell.y},${cell.z}`;
}

function createColumnEngine(
  height: number
): FakeEngine {
  const removed: string[] = [];
  const layer = {
    getVoxelAt(position: VoxelCoord) {
      const solid = position.y >= 0 && position.y < height;

      return solid ? { blockId: 1, transform: 0 } : undefined;
    }
  };
  const view = {
    document: {
      world: {
        getLayer: () => layer,
        removeVoxelBulk(
          _layerName: string,
          entries: { position: VoxelCoord; }[]
        ) {
          removed.push(...entries.map((entry) => cellKey(entry.position)));
        }
      }
    },
    flush() {
      return undefined;
    }
  };

  return {
    view: view as unknown as VoxelView,
    removed
  };
}

function createSlabView(): VoxelView {
  const blocks = [
    { id: 1, shapeId: "slabBottom" },
    { id: 2, shapeId: "slabTop" },
    { id: 3, shapeId: "ramp" },
    { id: 4, shapeId: "slabTop" },
    { id: 5, shapeId: "cube" }
  ].map((block) => {
    return {
      ...block,
      name: block.shapeId,
      faceTextures: {},
      collidable: true,
      properties: {}
    };
  });
  const view = new VoxelView(new VoxelDocument({
    chunkSize: 4,
    layers: ["Ground"],
    blocks
  }));
  view.document.world.setVoxel("Ground", {
    position: { x: 0, y: 0, z: 0 },
    blockId: 1
  });

  return view;
}

function placeStroke(
  view: VoxelView,
  blockId: number,
  cells: VoxelCoord[]
): boolean {
  const stroke = new BrushStroke({
    mode: "place",
    layerName: "Ground",
    origin: cells[0],
    paint: {
      blockId,
      rotation: 0,
      flipY: false
    }
  });

  return applyBrushStroke(view, stroke, cells, 1);
}

function createPairView(): VoxelView {
  const view = createSlabView();
  placeStroke(view, 2, [{ x: 0, y: 0, z: 0 }]);

  return view;
}

function replaceUpperHalf(
  view: VoxelView,
  paint: VoxelPaint
): boolean {
  const origin = { x: 0, y: 0, z: 0 };
  const stroke = new BrushStroke({
    mode: "replace",
    layerName: "Ground",
    origin,
    paint,
    aimedPart: { blockId: 2, transform: 0 }
  });

  return applyBrushStroke(view, stroke, [origin], 1);
}

describe("applyBrushStroke", () => {
  test("merges the brush shape into a cell holding its complement", () => {
    const view = createSlabView();

    assert.ok(placeStroke(view, 2, [{ x: 0, y: 0, z: 0 }]));
    assert.deepStrictEqual(
      view.document.world.getVoxelAt({ x: 0, y: 0, z: 0 }),
      {
        blockId: 1,
        transform: 0,
        partner: { blockId: 2, transform: 0 }
      }
    );
    view.dispose();
  });

  for (const [half, aimed, kept] of [["upper", 2, 1], ["lower", 1, 2]] as const) {
    test(`removes the ${half} half of a merged cell and keeps the other`, () => {
      const view = createPairView();
      const origin = { x: 0, y: 0, z: 0 };

      const stroke = new BrushStroke({
        mode: "remove",
        layerName: "Ground",
        origin,
        aimedPart: { blockId: aimed, transform: 0 }
      });

      assert.ok(applyBrushStroke(view, stroke, [origin], 1));
      assert.deepStrictEqual(
        view.document.world.getVoxelAt(origin),
        { blockId: kept, transform: 0 }
      );
      view.dispose();
    });
  }

  test("removes merged cells whole once the stroke leaves its origin", () => {
    const view = createSlabView();
    const origin = { x: 0, y: 0, z: 0 };
    const next = { x: 1, y: 0, z: 0 };
    view.document.world.setVoxel("Ground", { position: next, blockId: 1 });
    placeStroke(view, 2, [origin, next]);

    const stroke = new BrushStroke({
      mode: "remove",
      layerName: "Ground",
      origin,
      aimedPart: { blockId: 2, transform: 0 }
    });

    assert.ok(applyBrushStroke(view, stroke, [origin, next], 1));
    assert.deepStrictEqual(
      view.document.world.getVoxelAt(origin),
      { blockId: 1, transform: 0 }
    );
    assert.strictEqual(view.document.world.getVoxelAt(next), undefined);
    view.dispose();
  });

  test("replaces the aimed half with a brush shape that fits, in one patch", () => {
    const view = createPairView();
    const actions: string[] = [];
    view.document.on("command", (command) => actions.push(command.action));

    assert.ok(replaceUpperHalf(view, { blockId: 4, rotation: 0, flipY: false }));
    assert.deepStrictEqual(
      view.document.world.getVoxelAt({ x: 0, y: 0, z: 0 }),
      {
        blockId: 1,
        transform: 0,
        partner: { blockId: 4, transform: 0 }
      }
    );
    assert.deepStrictEqual(actions, ["voxels-patched"]);
    view.dispose();
  });

  test("turns the brush shape like the aimed half when its own turn does not fit", () => {
    const view = createPairView();

    assert.ok(replaceUpperHalf(view, { blockId: 4, rotation: 0, flipY: true }));
    assert.deepStrictEqual(
      view.document.world.getVoxelAt({ x: 0, y: 0, z: 0 })?.partner,
      { blockId: 4, transform: 0 }
    );
    view.dispose();
  });

  test("replaces the whole cell when the brush shape cannot fill the other half", () => {
    const view = createPairView();

    assert.ok(replaceUpperHalf(view, { blockId: 5, rotation: 0, flipY: false }));
    assert.deepStrictEqual(
      view.document.world.getVoxelAt({ x: 0, y: 0, z: 0 }),
      { blockId: 5, transform: 0 }
    );
    view.dispose();
  });

  test("writes nothing when the aimed half already holds the brush block", () => {
    const view = createPairView();

    assert.strictEqual(
      replaceUpperHalf(view, { blockId: 2, rotation: 0, flipY: false }),
      false
    );
    view.dispose();
  });

  test("leaves an occupied cell alone when the shapes do not fill it", () => {
    const view = createSlabView();

    assert.strictEqual(placeStroke(view, 3, [{ x: 0, y: 0, z: 0 }]), false);
    assert.strictEqual(
      view.document.world.getVoxelAt({ x: 0, y: 0, z: 0 })?.partner,
      undefined
    );
    view.dispose();
  });

  test("digs a wall down from the top face it was aimed at", () => {
    const { view, removed } = createColumnEngine(6);
    const origin = { x: 0, y: 5, z: 0 };
    const stroke = new BrushStroke({
      mode: "remove",
      layerName: "Ground",
      axis: "yz",
      anchor: "top",
      origin
    });

    assert.ok(applyBrushStroke(view, stroke, [origin], 3));
    assert.deepStrictEqual(
      [...new Set(removed.map((key) => key.split(",")[1]))].sort(),
      ["3", "4", "5"]
    );
    assert.strictEqual(removed.length, 9);
  });

  test("only reaches the aimed row when the wall rises into the air", () => {
    const { view, removed } = createColumnEngine(6);
    const origin = { x: 0, y: 5, z: 0 };
    const stroke = new BrushStroke({
      mode: "remove",
      layerName: "Ground",
      axis: "yz",
      origin
    });

    applyBrushStroke(view, stroke, [origin], 3);

    assert.deepStrictEqual(
      removed.sort(),
      ["0,5,-1", "0,5,0", "0,5,1"]
    );
  });
});
