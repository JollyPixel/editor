// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import { Grants } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { mapHistoryOf } from "../../helpers/mapHistory.ts";
import { mapDocumentOf } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";
import { CellRegion } from "../../../src/features/placement/CellRegion.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import {
  MAP_CAPABILITIES,
  type MapCapability
} from "../../../src/access/MapAccess.ts";
import { SelectionStore } from "../../../src/state/index.ts";

// CONSTANTS
const kDraftRegion = CellRegion.spanning(
  { x: 0, y: 0, z: 0 },
  { x: 4, y: 4, z: 4 }
);

function setup() {
  const world = new VoxelWorld();
  const selection = new SelectionStore();
  const access = mapAccess();
  const placement = new MapPlacement({
    world,
    history: mapHistoryOf(world),
    selection,
    mapDocument: mapDocumentOf(world),
    access
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
    }
  ]);
  selection.selectVoxelLayer("Ground");
  const templateId = world.templates.createFromLayer("Draft", { name: "Draft" })!.id;

  return {
    world,
    access,
    placement,
    templateId
  };
}

describe("MapPlacement access", () => {
  test("starts no session that writes what the role can only view", () => {
    const { world, access, placement, templateId } = setup();
    access.current = MAP_CAPABILITIES.none;

    assert.equal(placement.placeTemplate(templateId, { x: 0, y: 0, z: 0 }), false);
    assert.equal(placement.transformLayer("Draft"), false);
    assert.equal(placement.liftRegion("Draft", kDraftRegion), false);
    assert.equal(placement.placing, false);
    assert.equal(world.getLayer("Draft")!.voxelCount, 2);
  });

  test("keeps an open placement uncommitted once the role loses voxel writes", () => {
    const { world, access, placement, templateId } = setup();
    placement.placeTemplate(templateId, { x: 10, y: 0, z: 10 });

    access.current = new Grants<MapCapability>(["layers"]);

    assert.equal(placement.commit(), false);
    assert.equal(placement.placing, true);
    assert.equal(world.getLayer("Ground")!.voxelCount, 0);
    assert.equal(placement.transformLayer("Draft"), true);
  });
});
