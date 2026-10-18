// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import {
  VoxelWorld,
  VOXEL_ABSENT,
  voxelBlockId,
  type VoxelTemplateVoxel,
  type VoxelLayer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createWorldHistory,
  mapSteps
} from "../../helpers/mapHistory.ts";
import { MAP_HISTORY_SCOPE } from "../../../src/shared/mapHistory.ts";
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import { CellRegion } from "../../../src/features/placement/CellRegion.ts";
import type { ActivePlacement } from "../../../src/features/placement/ActivePlacement.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import {
  EditContext,
  SelectionStore
} from "../../../src/state/index.ts";
import { createMapDocument } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

function setup() {
  const world = new VoxelWorld();
  const history = createWorldHistory(world);
  const mapDocument = createMapDocument(world);
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    editContext: new EditContext(),
    selection,
    mapDocument,
    access: mapAccess()
  });
  const concealed: string[] = [];
  const placement = new MapPlacement({
    world,
    history: mapSteps(history),
    selection,
    mapDocument,
    conceal: (layerName) => {
      concealed.push(layerName);

      return () => {
        concealed.splice(concealed.indexOf(layerName), 1);
      };
    },
    access: mapAccess()
  });
  world.addLayer("Draft");
  world.addLayer("Ground");
  world.setVoxelBulk("Draft", [
    {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    },
    {
      position: { x: 1, y: 0, z: 0 },
      blockId: 2
    },
    {
      position: { x: 2, y: 0, z: 0 },
      blockId: 1
    },
    {
      position: { x: 0, y: 1, z: 1 },
      blockId: 3,
      rotation: 1
    }
  ]);
  selection.selectVoxelLayer("Ground");

  const changes: Array<ActivePlacement | null> = [];
  placement.subscribe("change", (current) => changes.push(current));

  return {
    world,
    history,
    selection,
    layers,
    concealed,
    placement,
    changes
  };
}

function scanCells(
  layer: VoxelLayer
): VoxelTemplateVoxel[] {
  const { x: ox, y: oy, z: oz } = layer.position;

  return [...layer.localVoxels()]
    .map(([x, y, z, packed, partner]): VoxelTemplateVoxel => [
      x + ox,
      y + oy,
      z + oz,
      packed,
      partner
    ])
    .sort(compareCells);
}

function compareCells(
  a: readonly number[],
  b: readonly number[]
): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

describe("MapPlacement regions", () => {
  function readBlocks(
    layer: VoxelLayer
  ): Array<[number, number, number, number]> {
    return scanCells(layer).map(([x, y, z, packed]) => [
      x,
      y,
      z,
      voxelBlockId(packed)
    ]);
  }

  const kLowerCorner = CellRegion.spanning(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 4, z: 4 }
  );

  test("lifts the voxels inside the region out of the layer, framed by their content", () => {
    const { world, placement, concealed } = setup();

    assert.equal(placement.liftRegion("Draft", kLowerCorner), true);

    assert.deepEqual(readBlocks(world.getLayer("Draft")!), [[2, 0, 0, 1]]);
    const current = placement.current!;
    assert.equal(current.kind, "region");
    assert.equal(current.target, "Draft");
    assert.equal(current.deletable, true);
    assert.equal(current.caption, "Selection → Draft");
    assert.equal(current.template.voxelCount, 3);
    assert.deepEqual(current.bounds, {
      min: { x: 0, y: 0, z: 0 },
      size: { x: 2, y: 2, z: 2 }
    });
    assert.deepEqual(concealed, []);
  });

  test("lifts and moves only the voxels connected to a cell, as one undo step", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = scanCells(draft);

    assert.equal(placement.liftConnected("Draft", { x: 1, y: 0, z: 0 }), true);
    assert.deepEqual(readBlocks(draft), [[0, 1, 1, 3]]);
    assert.deepEqual(placement.current!.bounds, {
      min: { x: 0, y: 0, z: 0 },
      size: { x: 3, y: 1, z: 1 }
    });

    placement.moveBoundsTo({ x: 0, y: 0, z: 2 });
    assert.equal(placement.commit(), true);
    assert.deepEqual(readBlocks(draft), [
      [0, 0, 2, 1],
      [0, 1, 1, 3],
      [1, 0, 2, 2],
      [2, 0, 2, 1]
    ]);

    history.undo(MAP_HISTORY_SCOPE);
    assert.deepEqual(scanCells(draft), before);
  });

  test("refuses to lift connected voxels from an empty cell or a missing layer", () => {
    const { placement } = setup();

    assert.equal(placement.liftConnected("Draft", { x: 5, y: 0, z: 5 }), false);
    assert.equal(placement.liftConnected("Missing", { x: 0, y: 0, z: 0 }), false);
    assert.equal(placement.placing, false);
  });

  test("refuses a region without voxels or without its layer", () => {
    const { placement } = setup();
    const empty = CellRegion.spanning(
      { x: 5, y: 0, z: 5 },
      { x: 6, y: 0, z: 6 }
    );

    assert.equal(placement.liftRegion("Draft", empty), false);
    assert.equal(placement.liftRegion("Missing", kLowerCorner), false);
    assert.equal(placement.placing, false);
  });

  test("moves the lifted voxels and clears the cells they left, as one undo step", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = scanCells(draft);
    placement.liftRegion("Draft", kLowerCorner);

    placement.moveBoundsTo({ x: 1, y: 0, z: 0 });

    assert.equal(placement.commit(), true);
    assert.equal(placement.current, null);
    assert.deepEqual(readBlocks(draft), [
      [1, 0, 0, 1],
      [1, 1, 1, 3],
      [2, 0, 0, 2]
    ]);

    history.undo(MAP_HISTORY_SCOPE);
    assert.deepEqual(scanCells(draft), before);
  });

  test("turns the lifted voxels around their pivot and leaves voxels outside the region", () => {
    const { world, placement } = setup();
    placement.liftRegion("Draft", kLowerCorner);
    placement.turn({ rotation: 1 });
    const current = placement.current!;
    const expected = [
      ...current.template.placedVoxels(
        current.placement.position,
        current.placement.transform
      ),
      [
        2,
        0,
        0,
        world.getLayer("Draft")!.getPackedVoxelAt({ x: 2, y: 0, z: 0 }),
        VOXEL_ABSENT
      ]
    ].sort(compareCells);

    placement.commit();

    assert.deepEqual(scanCells(world.getLayer("Draft")!), expected);
  });

  test("an unmoved commit ends the session without writing history", () => {
    const { history, placement } = setup();
    const depth = history.state(MAP_HISTORY_SCOPE).undoCount;
    placement.liftRegion("Draft", kLowerCorner);

    assert.equal(placement.commit(), true);
    assert.equal(placement.placing, false);
    assert.equal(history.state(MAP_HISTORY_SCOPE).undoCount, depth);
  });

  test("deleting removes only the lifted voxels, as one undo step", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = scanCells(draft);
    placement.liftRegion("Draft", kLowerCorner);
    placement.moveBoundsTo({ x: 8, y: 0, z: 8 });

    assert.equal(placement.deleteRegion(), true);
    assert.equal(placement.placing, false);
    assert.deepEqual(readBlocks(draft), [[2, 0, 0, 1]]);

    history.undo(MAP_HISTORY_SCOPE);
    assert.deepEqual(scanCells(draft), before);
  });
});
