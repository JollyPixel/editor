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
import { MapTemplates } from "../../../src/features/templates/MapTemplates.ts";

function setup() {
  const world = new VoxelWorld();
  const history = new VoxelHistory(world, { enabled: true });
  const templates = new MapTemplates({
    world,
    history,
    confirm: () => Promise.resolve(true)
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

  return {
    world,
    history,
    templates
  };
}

describe("MapTemplates.saveLayer", () => {
  test("captures the layer under its name and selects the new template", () => {
    const { world, templates } = setup();

    const id = templates.saveLayer("Draft");

    assert.notEqual(id, null);
    assert.equal(templates.store.selected, id);
    assert.equal(world.templates.get(id!)?.name, "Draft");
    assert.equal(world.templates.get(id!)?.voxelCount, 2);
  });

  test("returns null for an empty layer", () => {
    const { world, templates } = setup();

    assert.equal(templates.saveLayer("Ground"), null);
    assert.equal(world.templates.size, 0);
  });
});

describe("MapTemplates.rename", () => {
  test("trims the name and refuses a blank one", () => {
    const { world, templates } = setup();
    const id = templates.saveLayer("Draft")!;

    assert.equal(templates.rename(id, "  "), false);
    assert.equal(templates.rename(id, " Wall "), true);
    assert.equal(world.templates.get(id)?.name, "Wall");
  });
});

describe("MapTemplates.commitPlacement", () => {
  test("stamps the turned template into the layer as one undo step", () => {
    const { world, history, templates } = setup();
    const id = templates.saveLayer("Draft")!;
    templates.beginPlacement(id, { x: 10, y: 3, z: 10 });
    templates.store.transformPlacement({ rotation: 1 });

    const placed = templates.commitPlacement("Ground");

    const ground = world.getLayer("Ground")!;
    const expected = world.templates.get(id)!.placedVoxels(
      { x: 10, y: 3, z: 10 },
      VoxelTransform.fromPacked(VoxelTransform.pack({ rotation: 1 }))
    );
    assert.equal(placed, true);
    assert.equal(templates.store.placement, null);
    assert.equal(ground.voxelCount, 2);
    for (const [x, y, z, packed] of expected) {
      assert.equal(ground.getPackedVoxelAt({ x, y, z }), packed);
    }

    history.undo();
    assert.equal(ground.voxelCount, 0);
  });

  test("keeps the placement without a target layer", () => {
    const { templates } = setup();
    const id = templates.saveLayer("Draft")!;
    templates.beginPlacement(id, { x: 0, y: 0, z: 0 });

    assert.equal(templates.commitPlacement(null), false);
    assert.notEqual(templates.store.placement, null);
  });
});

describe("MapTemplates.beginPlacement", () => {
  test("refuses an unknown template", () => {
    const { templates } = setup();

    assert.equal(
      templates.beginPlacement("missing", { x: 0, y: 0, z: 0 }),
      false
    );
    assert.equal(templates.store.placing, false);
  });
});

describe("MapTemplates.remove", () => {
  test("removes a template once confirmed and ignores an unknown one", async() => {
    const { world, history } = setup();
    const prompts: string[] = [];
    const templates = new MapTemplates({
      world,
      history,
      confirm: (options) => {
        prompts.push(options.message);

        return Promise.resolve(true);
      }
    });
    const id = templates.saveLayer("Draft")!;

    assert.equal(await templates.remove("missing"), false);
    assert.equal(await templates.remove(id), true);
    assert.equal(world.templates.size, 0);
    assert.equal(prompts.length, 1);
  });
});
