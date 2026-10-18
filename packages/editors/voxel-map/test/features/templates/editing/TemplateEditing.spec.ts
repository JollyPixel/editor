// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { Grants } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  DRAFT_LAYER,
  paintDraft,
  shownInView,
  templateEditingFixture
} from "../../../helpers/templateEditing.ts";
import { mapAccess } from "../../../helpers/mapAccess.ts";
import type { MapCapability } from "../../../../src/access/MapAccess.ts";

describe("TemplateEditing.open", () => {
  test("copies the template into a hidden draft layer with its pivot on the origin", () => {
    const { world, editing } = templateEditingFixture();

    assert.equal(editing.open("house"), true);

    const draft = world.getLayerById(DRAFT_LAYER)!;
    assert.equal(draft.visible, false);
    assert.equal(draft.voxelCount, 2);
    assert.deepEqual(
      [-1, 0].map((x) => draft.getVoxelAt({ x, y: 0, z: 0 })?.blockId),
      [1, 2]
    );
  });

  test("shows only the draft, selects it and frames it", () => {
    const { world, view, selection, context, camera, editing } = templateEditingFixture();
    const ground = world.getLayer("Ground")!.id;

    editing.open("house");

    assert.equal(shownInView(world, view, DRAFT_LAYER), true);
    assert.equal(shownInView(world, view, ground), false);
    assert.equal(selection.voxelLayer, world.getLayerById(DRAFT_LAYER)!.name);
    assert.equal(context.draft?.layerId, DRAFT_LAYER);
    assert.equal(camera.framed.length, 1);
    assert.equal(camera.framed[0]?.isEmpty(), false);
  });

  test("refuses an unknown template and a role that cannot add layers", () => {
    const { world, editing } = templateEditingFixture(
      mapAccess(new Grants<MapCapability>(["voxels", "templates"]))
    );

    assert.equal(editing.open("house"), false);
    assert.equal(templateEditingFixture().editing.open("unknown"), false);
    assert.equal(world.getLayerById(DRAFT_LAYER), undefined);
  });
});

describe("TemplateEditing history", () => {
  test("undo inside the template steps back draft edits only", () => {
    const { world, history, editing } = templateEditingFixture();
    world.setVoxel("Ground", {
      position: { x: 5, y: 0, z: 0 },
      blockId: 1
    });
    const mapSteps = history.state.undoCount;

    editing.open("house");
    assert.equal(history.state.undoCount, 0);
    paintDraft(world, 2);
    assert.equal(history.undo(), true);

    assert.equal(world.getLayerById(DRAFT_LAYER)!.voxelCount, 2);
    assert.equal(world.getLayer("Ground")!.voxelCount, 3);
    assert.equal(history.undo(), false);

    editing.close();
    assert.equal(history.state.undoCount, mapSteps);
  });
});

describe("TemplateEditing.apply", () => {
  test("redefines the template from the draft under the same id and name", () => {
    const { world, editing } = templateEditingFixture();
    editing.open("house");
    paintDraft(world, 1);

    assert.equal(editing.apply(), true);

    const house = world.templates.get("house")!;
    assert.equal(house.name, "House");
    assert.equal(house.voxelCount, 3);
    assert.deepEqual(house.size, { x: 3, y: 1, z: 1 });
  });

  test("keeps the pivot on the same cell when the draft grows below its corner", () => {
    const { world, editing } = templateEditingFixture();
    const before = world.templates.get("house")!.pivot;
    editing.open("house");
    paintDraft(world, -2);

    editing.apply();

    assert.deepEqual(world.templates.get("house")!.pivot, {
      x: before.x + 1,
      y: before.y,
      z: before.z
    });
  });

  test("refuses an empty draft and a draft without change", () => {
    const { world, log, editing } = templateEditingFixture();
    editing.open("house");
    const template = world.templates.get("house");

    assert.equal(editing.apply(), false);

    world.removeVoxelBulk(world.getLayerById(DRAFT_LAYER)!.name, [
      { position: { x: -1, y: 0, z: 0 } },
      { position: { x: 0, y: 0, z: 0 } }
    ]);

    assert.equal(editing.apply(), false);
    assert.equal(world.templates.get("house"), template);
    assert.equal(log.entries.length, 1);
  });
});
