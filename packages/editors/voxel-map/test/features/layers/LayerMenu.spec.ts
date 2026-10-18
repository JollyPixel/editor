// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import { Grants } from "@jolly-pixel/network/client";
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { LayerMenu } from "../../../src/features/layers/LayerMenu.ts";
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import type { MapCapability } from "../../../src/access/MapAccess.ts";
import {
  EditContext,
  ObjectLayerRef,
  ObjectRef,
  SelectionStore,
  VoxelLayerRef,
  type LayerRef
} from "../../../src/state/index.ts";
import { createMapDocument } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

// CONSTANTS
const kPoint = { x: 0, y: 0 };
const kFull: MapCapability[] = ["layers", "objects", "templates"];

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("Ground");
  world.addLayer("Deco");
  world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
  world.objectLayers.add("Triggers");
  world.objectLayers.add("Spawns");
  world.objectLayers.addObject("Triggers", {
    id: "door",
    name: "Door",
    visible: true,
    x: 0,
    y: 0,
    z: 0
  });

  return world;
}

function open(
  ref: LayerRef,
  capabilities: MapCapability[] = kFull,
  world = makeWorld()
) {
  const ran: string[] = [];
  const access = mapAccess(new Grants<MapCapability>(capabilities));
  const menu = new LayerMenu({
    world,
    layers: new MapLayers({
      world,
      editContext: new EditContext(),
      selection: new SelectionStore(),
      mapDocument: createMapDocument(world),
      access
    }),
    templatesEditable: access.current.has("templates"),
    commands: {
      run: (_ref, command) => {
        ran.push(command);
      },
      runRoot: (command) => {
        ran.push(command);
      },
      mergeInto: (_ref, target) => {
        ran.push(`merge ${target}`);

        return Promise.resolve();
      },
      moveTo: (_ref, objectLayer) => {
        ran.push(`move ${objectLayer}`);
      }
    }
  });
  const session = menu.session(ref);

  return { menu, session, ran, world };
}

function choices(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.flatMap((entry) => {
    if (entry === "separator" || entry.disabled === true) {
      return [];
    }

    return entry.items === undefined ? [entry.id] : choices(entry.items);
  });
}

describe("LayerMenu", () => {
  test("offers framing, duplication, merging and templates on a painted voxel layer", () => {
    assert.deepEqual(choices(open(new VoxelLayerRef("Ground")).session.items), [
      "frame",
      "duplicate",
      "merge:Deco",
      "save-template",
      "show-only",
      "show-all",
      "delete"
    ]);
  });

  test("cannot frame or template an empty voxel layer", () => {
    const offered = choices(open(new VoxelLayerRef("Deco")).session.items);

    assert.equal(offered.includes("frame"), false);
    assert.equal(offered.includes("save-template"), false);
  });

  test("moves an object to another object layer and locks it", () => {
    assert.deepEqual(choices(open(new ObjectRef("Triggers", "door")).session.items), [
      "frame",
      "rename",
      "duplicate",
      "move:Spawns",
      "lock",
      "show-only",
      "show-all",
      "delete"
    ]);
  });

  test("offers to unlock a locked object", () => {
    const world = makeWorld();
    world.objectLayers.updateObject("Triggers", "door", { locked: true });

    const offered = choices(open(new ObjectRef("Triggers", "door"), kFull, world).session.items);

    assert.ok(offered.includes("unlock"));
    assert.equal(offered.includes("lock"), false);
  });

  test("adds objects to an object layer and frames only one that holds some", () => {
    assert.deepEqual(choices(open(new ObjectLayerRef("Triggers")).session.items), [
      "frame",
      "add-object",
      "show-only",
      "show-all",
      "delete"
    ]);
    assert.equal(
      choices(open(new ObjectLayerRef("Spawns")).session.items).includes("frame"),
      false
    );
  });

  test("leaves only the local actions to a role without the matching grant", () => {
    assert.deepEqual(choices(open(new VoxelLayerRef("Ground"), ["objects"]).session.items), [
      "frame",
      "show-only",
      "show-all"
    ]);
    assert.deepEqual(choices(open(new ObjectLayerRef("Triggers"), ["layers"]).session.items), [
      "frame",
      "show-only",
      "show-all",
      "delete"
    ]);
  });

  test("routes merge and move choices to their targets", async() => {
    const voxel = open(new VoxelLayerRef("Ground"));
    const object = open(new ObjectRef("Triggers", "door"));

    await voxel.session.run("merge:Deco", kPoint);
    await voxel.session.run("save-template", kPoint);
    await object.session.run("move:Spawns", kPoint);
    await object.session.run("merge:Deco", kPoint);

    assert.deepEqual(voxel.ran, ["merge Deco", "save-template"]);
    assert.deepEqual(object.ran, ["move Spawns"]);
  });

  test("runs nothing once another peer removed the row", async() => {
    const { session, ran, world } = open(new VoxelLayerRef("Ground"));
    world.removeLayer("Ground");

    await session.run("delete", kPoint);

    assert.deepEqual(ran, []);
  });

  test("adds a layer from the empty area only with the layers grant", async() => {
    assert.deepEqual(choices(open(new VoxelLayerRef("Ground")).menu.rootSession().items), [
      "add-layer",
      "show-all"
    ]);
    const { menu, ran } = open(new VoxelLayerRef("Ground"), ["objects"]);
    const readOnly = menu.rootSession();
    await readOnly.run("add-layer", kPoint);
    await readOnly.run("show-all", kPoint);

    assert.deepEqual(ran, ["show-all"]);
  });
});
