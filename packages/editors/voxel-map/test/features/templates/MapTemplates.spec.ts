// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelTemplate,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { MapTemplates } from "../../../src/features/templates/MapTemplates.ts";
import { createMapDocument } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";
import { MAP_CAPABILITIES } from "../../../src/access/MapAccess.ts";

function setup(
  access = mapAccess(),
  answer: () => string | null = () => "Wall"
) {
  const world = new VoxelWorld();
  const prompts: string[] = [];
  const log = new LogQueue();
  const templates = new MapTemplates({
    world,
    mapDocument: createMapDocument(world),
    confirm: () => Promise.resolve(true),
    prompt: (options) => {
      prompts.push(options.defaultValue ?? "");

      return Promise.resolve(answer());
    },
    access,
    log
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
    templates,
    prompts,
    log
  };
}

function takeSnapshot(
  world: VoxelWorld
): VoxelTemplate {
  return VoxelTemplate.fromLayer(world.getLayer("Draft")!, {
    id: "selection",
    name: "Selection"
  });
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

  test("returns null and reports an empty layer", () => {
    const { world, templates, log } = setup();

    assert.equal(templates.saveLayer("Ground"), null);
    assert.equal(world.templates.size, 0);
    assert.deepEqual(
      log.entries.map((entry) => entry.content),
      ["Ground has no voxels to save as a template"]
    );
  });
});

describe("MapTemplates.saveSnapshot", () => {
  test("saves the snapshot under the prompted name and selects it", async() => {
    const { world, templates, prompts } = setup();

    const id = await templates.saveSnapshot(takeSnapshot(world), "Draft selection");

    assert.notEqual(id, null);
    assert.deepEqual(prompts, ["Draft selection"]);
    assert.equal(templates.store.selected, id);
    assert.equal(world.templates.get(id!)?.name, "Wall");
    assert.equal(world.templates.get(id!)?.voxelCount, 2);
  });

  test("saves nothing when the name prompt is cancelled", async() => {
    const { world, templates } = setup(mapAccess(), () => null);

    assert.equal(await templates.saveSnapshot(takeSnapshot(world), "Draft"), null);
    assert.equal(world.templates.size, 0);
  });

  test("saves nothing when template access is lost while the prompt is open", async() => {
    const access = mapAccess();
    const { world, templates } = setup(access, () => {
      access.current = MAP_CAPABILITIES.none;

      return "Wall";
    });

    assert.equal(await templates.saveSnapshot(takeSnapshot(world), "Draft"), null);
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
      mapDocument: createMapDocument(world),
      confirm: (options) => {
        prompts.push(options.message);

        return Promise.resolve(true);
      },
      access: mapAccess(),
      log: new LogQueue()
    });
    const id = templates.saveLayer("Draft")!;

    assert.equal(await templates.remove("missing"), false);
    assert.equal(await templates.remove(id), true);
    assert.equal(world.templates.size, 0);
    assert.equal(prompts.length, 1);
  });
});

describe("MapTemplates access", () => {
  test("refuses every template write for a role that cannot write templates", async() => {
    const { world, templates, prompts } = setup(mapAccess(MAP_CAPABILITIES.none));
    const id = world.templates.createFromLayer("Draft", { name: "Draft" })!.id;

    assert.equal(templates.editable, false);
    assert.equal(templates.saveLayer("Draft"), null);
    assert.equal(await templates.saveSnapshot(takeSnapshot(world), "Draft"), null);
    assert.deepEqual(prompts, []);
    assert.equal(templates.rename(id, "Wall"), false);
    assert.equal(await templates.remove(id), false);
    assert.deepEqual(Array.from(world.templates, (template) => template.name), ["Draft"]);
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
