// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { mapHistoryOf } from "../../helpers/mapHistory.ts";
import { MAP_HISTORY_SCOPE } from "../../../src/shared/mapHistory.ts";
import { CellRegion } from "../../../src/features/placement/CellRegion.ts";
import { MapHistory } from "../../../src/features/placement/MapHistory.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import { SelectionStore } from "../../../src/state/index.ts";
import { mapDocumentOf } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

// CONSTANTS
const kOrigin = CellRegion.spanning(
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 }
);

function setup() {
  const world = new VoxelWorld();
  world.addLayer("Draft");
  const voxels = mapHistoryOf(world);
  const placement = new MapPlacement({
    world,
    history: voxels,
    selection: new SelectionStore(),
    mapDocument: mapDocumentOf(world),
    access: mapAccess()
  });
  const history = new MapHistory({
    history: voxels,
    placement,
    access: mapAccess()
  });
  world.setVoxel("Draft", {
    position: { x: 0, y: 0, z: 0 },
    blockId: 1
  });
  world.setVoxel("Draft", {
    position: { x: 1, y: 0, z: 0 },
    blockId: 1
  });
  const draft = world.getLayer("Draft")!;

  return {
    draft,
    voxels,
    placement,
    history
  };
}

describe("MapHistory", () => {
  test("undo while lifted puts the region back and keeps earlier steps", () => {
    const { draft, voxels, placement, history } = setup();
    placement.liftRegion("Draft", kOrigin);

    assert.equal(history.undo(), true);
    assert.equal(placement.placing, false);
    assert.equal(draft.voxelCount, 2);
    assert.equal(voxels.state(MAP_HISTORY_SCOPE).undoCount, 2);

    assert.equal(history.undo(), true);
    assert.equal(draft.voxelCount, 1);
  });

  test("redo while lifted puts the region back, then redoes", () => {
    const { draft, voxels, placement, history } = setup();
    voxels.undo(MAP_HISTORY_SCOPE);
    placement.liftRegion("Draft", kOrigin);

    assert.equal(history.redo(), true);
    assert.equal(placement.placing, false);
    assert.equal(draft.voxelCount, 2);
  });

  test("reports the step counts of its scope on every change", () => {
    const { draft, placement, history } = setup();
    const counts: number[][] = [];
    history.subscribe("change", ({ undoCount, redoCount }) => counts.push([undoCount, redoCount]));
    placement.liftRegion("Draft", kOrigin);

    history.undo();
    history.undo();

    assert.deepEqual(counts, [[1, 1]]);
    assert.deepEqual([history.state.undoCount, history.state.redoCount], [1, 1]);
    assert.equal(draft.voxelCount, 1);
  });
});
