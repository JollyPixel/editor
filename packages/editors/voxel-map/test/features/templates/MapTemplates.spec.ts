// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapTemplates } from "../../../src/features/templates/MapTemplates.ts";
import { mapDocumentOf } from "../../helpers/mapDocument.ts";

function setup() {
  const world = new VoxelWorld();
  const templates = new MapTemplates({
    world,
    mapDocument: mapDocumentOf(world),
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

describe("MapTemplates.remove", () => {
  test("removes a template once confirmed and ignores an unknown one", async() => {
    const { world } = setup();
    const prompts: string[] = [];
    const templates = new MapTemplates({
      world,
      mapDocument: mapDocumentOf(world),
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

describe("MapTemplates reconcile", () => {
  test("drops the selection of a template removed from the world", () => {
    const { world, templates } = setup();
    const kept = templates.saveLayer("Draft")!;
    const removed = templates.saveLayer("Draft")!;
    const changes: Array<string | null> = [];
    templates.store.subscribe("selectionChange", (id) => changes.push(id));

    world.templates.remove(kept);
    assert.equal(templates.store.selected, removed);

    world.templates.remove(removed);
    assert.equal(templates.store.selected, null);
    assert.deepEqual(changes, [null]);
  });

  test("stops reconciling once disposed", () => {
    const { world, templates } = setup();
    const id = templates.saveLayer("Draft")!;

    templates.dispose();
    world.templates.remove(id);

    assert.equal(templates.store.selected, id);
  });
});
