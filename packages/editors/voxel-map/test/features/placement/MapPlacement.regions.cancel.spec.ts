// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import {
  VoxelWorld,
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
import { createEditorMap } from "../../helpers/editorMap.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

function setup() {
  const world = new VoxelWorld();
  const history = createWorldHistory(world);
  const editorMap = createEditorMap(world);
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    editContext: new EditContext(),
    selection,
    editorMap,
    access: mapAccess()
  });
  const concealed: string[] = [];
  const placement = new MapPlacement({
    world,
    history: mapSteps(history),
    selection,
    editorMap,
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

function readTemplate(
  world: VoxelWorld
): string {
  return world.templates.createFromLayer("Draft", { name: "Draft" })!.id;
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
  const kLowerCorner = CellRegion.spanning(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 4, z: 4 }
  );

  test("refuses to delete outside a region session", () => {
    const { world, placement } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });

    assert.equal(placement.deleteRegion(), false);
    assert.equal(placement.placing, true);
  });

  test("cancelling puts the lifted voxels back without writing history", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = scanCells(draft);
    const depth = history.state(MAP_HISTORY_SCOPE).undoCount;
    placement.liftRegion("Draft", kLowerCorner);
    placement.moveBoundsTo({ x: 8, y: 0, z: 8 });

    assert.equal(placement.cancel(), true);

    assert.deepEqual(scanCells(draft), before);
    assert.equal(history.state(MAP_HISTORY_SCOPE).undoCount, depth);
  });

  test("cancelLift puts a lifted region back, once", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = scanCells(draft);
    const depth = history.state(MAP_HISTORY_SCOPE).undoCount;
    placement.liftRegion("Draft", kLowerCorner);

    assert.equal(placement.lifted?.layerName, "Draft");
    assert.equal(history.state(MAP_HISTORY_SCOPE).undoCount, depth);
    assert.equal(placement.cancelLift(), true);
    assert.equal(placement.cancelLift(), false);
    assert.deepEqual(scanCells(draft), before);
    assert.equal(history.state(MAP_HISTORY_SCOPE).undoCount, depth);
  });

  test("puts the lifted voxels back when another placement starts or when disposed", () => {
    const { world, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = scanCells(draft);
    const templateId = readTemplate(world);

    placement.liftRegion("Draft", kLowerCorner);
    placement.placeTemplate(templateId, { x: 9, y: 0, z: 9 });
    assert.deepEqual(scanCells(draft), before);

    placement.liftRegion("Draft", kLowerCorner);
    placement.dispose();
    assert.deepEqual(scanCells(draft), before);
  });

  test("keeps targeting its own layer when another voxel layer is selected", () => {
    const { selection, placement } = setup();
    placement.liftRegion("Draft", kLowerCorner);

    selection.selectVoxelLayer("Ground");

    assert.equal(placement.current?.target, "Draft");
  });
});
