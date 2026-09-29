// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelHistory,
  VoxelTransform,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TemplateStore } from "../../../src/features/templates/TemplateStore.ts";
import {
  beginTemplatePlacement,
  commitTemplatePlacement,
  renameTemplate,
  saveLayerAsTemplate
} from "../../../src/features/templates/templateActions.ts";

function setup() {
  const world = new VoxelWorld();
  const history = new VoxelHistory(world, { enabled: true });
  const templates = new TemplateStore();
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

  return {
    world,
    history,
    templates
  };
}

describe("saveLayerAsTemplate", () => {
  test("captures the layer under its name and selects the new template", () => {
    const { world, templates } = setup();

    const id = saveLayerAsTemplate(world, templates, "Draft");

    assert.notEqual(id, null);
    assert.equal(templates.selected, id);
    assert.equal(world.templates.get(id!)?.name, "Draft");
    assert.equal(world.templates.get(id!)?.voxelCount, 2);
  });

  test("returns null for an empty layer", () => {
    const { world, templates } = setup();

    assert.equal(saveLayerAsTemplate(world, templates, "Ground"), null);
    assert.equal(world.templates.size, 0);
  });
});

describe("renameTemplate", () => {
  test("trims the name and refuses a blank one", () => {
    const { world, templates } = setup();
    const id = saveLayerAsTemplate(world, templates, "Draft")!;

    assert.equal(renameTemplate(world, id, "  "), false);
    assert.equal(renameTemplate(world, id, " Wall "), true);
    assert.equal(world.templates.get(id)?.name, "Wall");
  });
});

describe("commitTemplatePlacement", () => {
  test("stamps the turned template into the layer as one undo step", () => {
    const { world, history, templates } = setup();
    const id = saveLayerAsTemplate(world, templates, "Draft")!;
    beginTemplatePlacement(world, templates, id, { x: 10, y: 3, z: 10 });
    templates.transformPlacement({ rotation: 1 });

    const placed = commitTemplatePlacement(world, history, templates, "Ground");

    const ground = world.getLayer("Ground")!;
    const expected = world.templates.get(id)!.placedVoxels(
      { x: 10, y: 3, z: 10 },
      VoxelTransform.fromPacked(VoxelTransform.pack({ rotation: 1 }))
    );
    assert.equal(placed, true);
    assert.equal(templates.placement, null);
    assert.equal(ground.voxelCount, 2);
    for (const [x, y, z, packed] of expected) {
      assert.equal(ground.getPackedVoxelAt({ x, y, z }), packed);
    }

    history.undo();
    assert.equal(ground.voxelCount, 0);
  });

  test("keeps the placement without a target layer", () => {
    const { world, history, templates } = setup();
    const id = saveLayerAsTemplate(world, templates, "Draft")!;
    beginTemplatePlacement(world, templates, id, { x: 0, y: 0, z: 0 });

    assert.equal(commitTemplatePlacement(world, history, templates, null), false);
    assert.notEqual(templates.placement, null);
  });
});

describe("beginTemplatePlacement", () => {
  test("refuses an unknown template", () => {
    const { world, templates } = setup();

    assert.equal(
      beginTemplatePlacement(world, templates, "missing", { x: 0, y: 0, z: 0 }),
      false
    );
    assert.equal(templates.placing, false);
  });
});
