// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelWorld,
  voxelBlockId,
  type VoxelLayer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { mapHistoryOf } from "../../helpers/mapHistory.ts";
import { MAP_HISTORY_SCOPE } from "../../../src/shared/mapHistory.ts";
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import { CellRegion } from "../../../src/features/placement/CellRegion.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import { SelectionStore } from "../../../src/state/index.ts";
import { mapDocumentOf } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

// CONSTANTS
const kLowerCorner = CellRegion.spanning(
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 4, z: 4 }
);

function setup() {
  const world = new VoxelWorld();
  const history = mapHistoryOf(world);
  const mapDocument = mapDocumentOf(world);
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    selection,
    mapDocument,
    access: mapAccess()
  });
  const placement = new MapPlacement({
    world,
    history,
    selection,
    mapDocument,
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
    }
  ]);
  selection.selectVoxelLayer("Draft");

  return {
    world,
    history,
    mapDocument,
    layers,
    selection,
    placement
  };
}

function blocksOf(
  layer: VoxelLayer
): string[] {
  const { x: ox, y: oy, z: oz } = layer.position;

  return [...layer.localVoxels()]
    .map(([x, y, z, packed]) => `${x + ox},${y + oy},${z + oz}:${voxelBlockId(packed)}`)
    .sort();
}

describe("MapPlacement copy and paste", () => {
  test("copies what floats, turned, and keeps the placement open", () => {
    const { world, placement } = setup();
    const changes: unknown[] = [];
    placement.clipboard.subscribe("change", (content) => changes.push(content));
    placement.liftRegion("Draft", kLowerCorner);
    placement.turn({ rotation: 1 });

    assert.equal(placement.copy(), true);

    const content = placement.clipboard.content!;
    assert.equal(changes.length, 1);
    assert.equal(placement.current?.kind, "region");
    assert.deepEqual(content.size, { x: 1, y: 1, z: 2 });
    assert.equal(world.getLayer("Draft")!.voxelCount, 1);
  });

  test("refuses to copy or paste without content", () => {
    const { placement } = setup();

    assert.equal(placement.copy(), false);
    assert.equal(placement.paste({ x: 0, y: 0, z: 0 }), false);
    assert.equal(placement.placing, false);
  });

  test("pasting commits a moved lift, then floats the copy into the selected layer", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    placement.liftRegion("Draft", kLowerCorner);
    placement.copy();
    placement.moveBoundsTo({ x: 0, y: 0, z: 3 });

    assert.equal(placement.paste({ x: 6, y: 0, z: 0 }), true);

    const current = placement.current!;
    assert.equal(current.kind, "copy");
    assert.equal(current.target, "Draft");
    assert.equal(current.caption, "Selection → Draft");
    assert.equal(placement.lifted, null);
    assert.deepEqual(blocksOf(draft), ["0,0,3:1", "1,0,3:2", "2,0,0:1"]);

    const depth = history.state(MAP_HISTORY_SCOPE).undoCount;
    assert.equal(placement.commit(), true);
    assert.equal(history.state(MAP_HISTORY_SCOPE).undoCount, depth + 1);
    assert.deepEqual(blocksOf(draft), [
      "0,0,3:1",
      "1,0,3:2",
      "2,0,0:1",
      "5,0,0:1",
      "6,0,0:2"
    ]);

    history.undo(MAP_HISTORY_SCOPE);
    assert.equal(draft.voxelCount, 3);
  });

  test("pasting replaces a template placement without placing it", () => {
    const { world, placement } = setup();
    const templateId = world.templates.createFromLayer("Draft", { name: "Row" })!.id;
    placement.placeTemplate(templateId, { x: 0, y: 4, z: 0 });
    placement.copy();
    placement.placeTemplate(templateId, { x: 0, y: 8, z: 0 });

    placement.paste({ x: 0, y: 2, z: 0 });

    assert.equal(placement.current?.kind, "copy");
    assert.equal(world.getLayer("Draft")!.voxelCount, 3);
  });

  test("forgets the clipboard when the map document resets", () => {
    const { mapDocument, placement } = setup();
    placement.liftRegion("Draft", kLowerCorner);
    placement.copy();

    mapDocument.emit("reset");

    assert.equal(placement.clipboard.content, null);
  });
});
