// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  KeyBindings,
  isApplePlatform,
  type KeyCode
} from "@jolly-pixel/controls";
import {
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { mapHistoryOf } from "../../helpers/mapHistory.ts";
import { bindMarqueeShortcuts } from "../../../src/features/marquee/marqueeShortcuts.ts";
import { CellRegion } from "../../../src/features/placement/CellRegion.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import {
  SelectionStore,
  ToolStore
} from "../../../src/state/index.ts";
import { mapDocumentOf } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

// CONSTANTS
const kSelectAll: KeyboardEventInit = isApplePlatform() ?
  {
    key: "a",
    metaKey: true
  } :
  {
    key: "a",
    ctrlKey: true
  };

function setup() {
  const keyboard = new KeyBindings();
  const world = new VoxelWorld();
  world.addLayer("Draft");
  world.setVoxelBulk("Draft", [
    {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    },
    {
      position: { x: 3, y: 2, z: 1 },
      blockId: 1
    }
  ]);
  const templateId = world.templates.createFromLayer("Draft", {
    name: "House"
  })!.id;
  const selection = new SelectionStore();
  selection.selectVoxelLayer("Draft");
  const tool = new ToolStore();
  const placement = new MapPlacement({
    world,
    history: mapHistoryOf(world),
    selection,
    mapDocument: mapDocumentOf(world),
    access: mapAccess()
  });
  bindMarqueeShortcuts({
    keyboard,
    world,
    tool,
    selection,
    placement
  });

  function press(
    code: KeyCode,
    init: KeyboardEventInit = {}
  ): void {
    keyboard.dispatch(new KeyboardEvent("keydown", {
      code,
      ...init
    }));
  }

  return {
    world,
    templateId,
    tool,
    placement,
    press
  };
}

describe("MarqueeShortcuts", () => {
  test("Delete and Backspace delete a lifted region only", () => {
    const { world, templateId, placement, press } = setup();
    const draft = world.getLayer("Draft")!;

    placement.placeTemplate(templateId, { x: 9, y: 0, z: 9 });
    press("Delete", { key: "Delete" });
    assert.equal(placement.current?.kind, "template");
    assert.equal(draft.voxelCount, 2);

    placement.liftRegion("Draft", CellRegion.spanning(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 }
    ));
    press("Backspace", { key: "Backspace" });
    assert.equal(placement.placing, false);
    assert.equal(draft.voxelCount, 1);
  });

  test("Mod+A lifts the whole selected voxel layer with the select tool", () => {
    const { tool, placement, press } = setup();

    press("KeyA", kSelectAll);
    assert.equal(placement.placing, false);

    tool.current = "select";
    press("KeyA", kSelectAll);
    assert.equal(placement.current?.kind, "region");
    assert.deepEqual(placement.current?.bounds, {
      min: { x: 0, y: 0, z: 0 },
      size: { x: 4, y: 3, z: 2 }
    });
  });

  test("Mod+A over a lifted region lifts the whole layer, the region included", () => {
    const { world, tool, placement, press } = setup();
    tool.current = "select";
    placement.liftRegion("Draft", CellRegion.spanning(
      { x: 3, y: 2, z: 1 },
      { x: 3, y: 2, z: 1 }
    ));

    press("KeyA", kSelectAll);

    assert.equal(placement.current?.template.voxelCount, 2);
    assert.equal(world.getLayer("Draft")!.voxelCount, 0);
  });

  test("Mod+A leaves a template placement alone", () => {
    const { templateId, tool, placement, press } = setup();
    tool.current = "select";
    placement.placeTemplate(templateId, { x: 9, y: 0, z: 9 });

    press("KeyA", kSelectAll);

    assert.equal(placement.current?.kind, "template");
  });
});
