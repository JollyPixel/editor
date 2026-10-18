// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { LayerTemplateDrop } from "../../../src/features/templates/LayerTemplateDrop.ts";
import {
  ObjectRef,
  VoxelLayerRef
} from "../../../src/state/index.ts";

// CONSTANTS
const kGround = new VoxelLayerRef("Ground").key;
const kDeco = new VoxelLayerRef("Deco").key;
const kDoor = new ObjectRef("Triggers", "door").key;
const kInside = { clientX: 50, clientY: 50 };
const kOutside = { clientX: 50, clientY: 150 };

function createDrop(
  editable = true
) {
  const saved: string[] = [];
  const zone = {
    highlighted: false,
    bounds: () => {
      return { left: 0, right: 100, top: 0, bottom: 100 };
    },
    highlight: (active: boolean) => {
      zone.highlighted = active;
    }
  };
  const drop = new LayerTemplateDrop({
    zone,
    editable: () => editable,
    save: (layerName) => {
      saved.push(layerName);
    }
  });

  return { drop, saved, zone };
}

describe("LayerTemplateDrop", () => {
  test("claims voxel layers over the zone and saves each one dropped", () => {
    const { drop, saved, zone } = createDrop();
    const movedIds = [kGround, kDeco];

    assert.equal(drop.over({ movedIds, ...kInside }), true);
    assert.equal(zone.highlighted, true);
    drop.drop({ movedIds, ...kInside });

    assert.deepEqual(saved, ["Ground", "Deco"]);
    assert.equal(zone.highlighted, false);
  });

  test("refuses points outside the zone, objects and a role without templates", () => {
    const { drop, zone } = createDrop();
    const readOnly = createDrop(false);

    assert.equal(drop.over({ movedIds: [kGround], ...kOutside }), false);
    assert.equal(drop.over({ movedIds: [kGround, kDoor], ...kInside }), false);
    assert.equal(readOnly.drop.over({ movedIds: [kGround], ...kInside }), false);

    assert.equal(zone.highlighted, false);
    assert.equal(readOnly.zone.highlighted, false);
  });

  test("clears the highlight when the drag leaves without dropping", () => {
    const { drop, saved, zone } = createDrop();

    drop.over({ movedIds: [kGround], ...kInside });
    drop.leave();

    assert.deepEqual(saved, []);
    assert.equal(zone.highlighted, false);
  });
});
