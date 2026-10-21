// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { VoxelWorldContentCommand } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TemplateDraftId } from "../../../../src/map/TemplateDraftId.ts";
import { TemplateDraft } from "../../../../src/features/templates/editing/TemplateDraft.ts";
import { VoxelLayerRef } from "../../../../src/state/index.ts";
import {
  DRAFT_LAYER,
  MAP_POSE,
  paintDraft,
  presencePeer,
  shownInView,
  templateEditingFixture
} from "../../../helpers/templateEditing.ts";

describe("TemplateEditing.close", () => {
  test("removes an applied draft and restores the map view, selection and camera", () => {
    const { world, view, selection, context, camera, editing } = templateEditingFixture();
    const ground = world.getLayer("Ground")!.id;
    editing.open("house");
    paintDraft(world, 2);
    editing.apply();

    assert.equal(editing.close(), true);

    assert.equal(world.getLayerById(DRAFT_LAYER), undefined);
    assert.equal(shownInView(world, view, ground), true);
    assert.equal(selection.voxelLayer, "Ground");
    assert.equal(context.draft, null);
    assert.deepEqual(camera.teleported, [MAP_POSE]);
    assert.equal(camera.focusExits, 1);
  });

  test("keeps a draft with changes not applied, and reopens it as left", () => {
    const { world, log, editing } = templateEditingFixture();
    editing.open("house");
    paintDraft(world, 2);

    editing.close();

    assert.equal(world.getLayerById(DRAFT_LAYER)?.voxelCount, 3);
    assert.equal(world.templates.get("house")?.voxelCount, 2);
    assert.notEqual(TemplateDraft.find(world, "house"), null);
    assert.equal(log.entries.length, 1);

    editing.open("house");
    assert.equal(world.getLayerById(DRAFT_LAYER)?.voxelCount, 3);
  });

  test("keeps the draft for a peer still editing it", () => {
    const { world, presence, editing } = templateEditingFixture();
    editing.open("house");
    presence.layerSelections = new Map([
      [new VoxelLayerRef(world.getLayerById(DRAFT_LAYER)!.name).key, [presencePeer("bob")]]
    ]);

    editing.close();

    assert.notEqual(world.getLayerById(DRAFT_LAYER), undefined);
  });
});

describe("TemplateEditing.discard", () => {
  test("drops the draft and leaves the template as last applied", async() => {
    const { world, context, editing } = templateEditingFixture();
    editing.open("house");
    paintDraft(world, 2);

    assert.equal(await editing.discard(), true);

    assert.equal(world.getLayerById(DRAFT_LAYER), undefined);
    assert.equal(world.templates.get("house")?.voxelCount, 2);
    assert.equal(context.draft, null);
  });
});

describe("TemplateEditing with peers", () => {
  test("two peers opening one template share one draft and see each other's edits", () => {
    const alice = templateEditingFixture();
    const bob = templateEditingFixture();
    const fromAlice: VoxelWorldContentCommand[] = [];
    const fromBob: VoxelWorldContentCommand[] = [];
    alice.world.on("command", (command) => fromAlice.push(command));
    bob.world.on("command", (command) => fromBob.push(command));

    alice.editing.open("house");
    bob.editing.open("house");
    paintDraft(bob.world, 2);
    for (const command of fromAlice.splice(0)) {
      bob.world.applyCommand(command);
    }
    for (const command of fromBob.splice(0)) {
      alice.world.applyCommand(command);
    }

    for (const { world } of [alice, bob]) {
      const drafts = world.getLayers().filter(TemplateDraftId.isDraft);
      assert.equal(drafts.length, 1);
      assert.equal(drafts[0].voxelCount, 3);
    }
  });

  test("leaves the template once a peer discards its draft", () => {
    const { world, context, log, editing } = templateEditingFixture();
    editing.open("house");

    world.removeLayer(world.getLayerById(DRAFT_LAYER)!.name);

    assert.equal(context.draft, null);
    assert.equal(editing.current, null);
    assert.equal(log.entries.length, 1);
  });
});
