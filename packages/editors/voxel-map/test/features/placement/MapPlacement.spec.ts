// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { VoxelTransform, VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createWorldHistory,
  mapSteps
} from "../../helpers/mapHistory.ts";
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import type { ActivePlacement } from "../../../src/features/placement/ActivePlacement.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import {
  EditContext,
  SelectionStore
} from "../../../src/state/index.ts";
import { createEditorMap } from "../../helpers/editorMap.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

function setup() {
  const world = new VoxelWorld();
  const history = createWorldHistory(world);
  const editorMap = createEditorMap(world);
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    editContext: new EditContext(),
    selection,
    editorMap,
    access: mapAccess()
  });
  const concealed: string[] = [];
  const placement = new MapPlacement({
    world,
    history: mapSteps(history),
    selection,
    editorMap,
    conceal: (layerName) => {
      concealed.push(layerName);

      return () => {
        concealed.splice(concealed.indexOf(layerName), 1);
      };
    },
    access: mapAccess()
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
    },
    {
      position: { x: 2, y: 0, z: 0 },
      blockId: 1
    },
    {
      position: { x: 0, y: 1, z: 1 },
      blockId: 3,
      rotation: 1
    }
  ]);
  selection.selectVoxelLayer("Ground");

  const changes: Array<ActivePlacement | null> = [];
  placement.subscribe("change", (current) => changes.push(current));

  return {
    world,
    history,
    selection,
    layers,
    concealed,
    placement,
    changes
  };
}

function readTemplate(
  world: VoxelWorld
): string {
  return world.templates.createFromLayer("Draft", { name: "Draft" })!.id;
}

describe("MapPlacement session", () => {
  test("begins on a rounded cell, untransformed", () => {
    const { world, placement } = setup();

    placement.placeTemplate(readTemplate(world), { x: 3.6, y: 0.2, z: -1.5 });

    const current = placement.current!;
    assert.equal(placement.placing, true);
    assert.deepEqual(current.placement.position, { x: 4, y: 0, z: -1 });
    assert.equal(current.placement.transform, VoxelTransform.Identity);
  });

  test("announces a move to a new cell and ignores moves within the same cell", () => {
    const { world, placement, changes } = setup();
    placement.placeTemplate(readTemplate(world), { x: 4, y: 0, z: -2 });
    changes.length = 0;

    placement.move({ x: 4.2, y: 0, z: -2 });
    placement.move({ x: 6, y: 1, z: -2 });

    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0]?.placement.position, { x: 6, y: 1, z: -2 });
  });

  test("composes turns after the current transform", () => {
    const { world, placement } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });

    placement.turn({ rotation: 1 });
    placement.turn({ rotation: 1 });
    placement.turn({ flipY: true });

    const expected = VoxelTransform.fromPacked(
      VoxelTransform.pack({ rotation: 2, flipY: true })
    );
    assert.ok(placement.current?.placement.transform.equals(expected));
  });

  test("mirrors in place and keeps turning around the pivot", () => {
    const { world, placement } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });
    const before = placement.current!.bounds;

    for (const transform of [{ flipX: true }, { flipY: true }, { flipZ: true }]) {
      placement.turn(transform);

      assert.deepEqual(placement.current!.bounds, before);
    }

    const pivot = placement.current!.placement.position;
    placement.turn({ rotation: 1 });

    assert.deepEqual(placement.current!.placement.position, pivot);
  });

  test("ignores identity turns and edits without a session", () => {
    const { world, placement, changes } = setup();

    placement.move({ x: 1, y: 1, z: 1 });
    placement.turn({ rotation: 1 });
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });
    placement.turn({ rotation: 4 });

    assert.equal(changes.length, 1);
  });

  test("moves the placed bounds onto a cell", () => {
    const { world, placement } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });

    placement.moveBoundsTo({ x: 10, y: 2, z: -4 });

    assert.deepEqual(placement.current?.bounds.min, { x: 10, y: 2, z: -4 });
  });

  test("cancelling ends the session once", () => {
    const { world, placement, changes } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });
    changes.length = 0;

    assert.equal(placement.cancel(), true);
    assert.equal(placement.cancel(), false);
    assert.deepEqual(changes, [null]);
  });
});

describe("MapPlacement reconcile", () => {
  test("ends the session once when its template is removed", () => {
    const { world, placement, changes } = setup();
    const templateId = readTemplate(world);
    placement.placeTemplate(templateId, { x: 0, y: 0, z: 0 });
    changes.length = 0;

    world.templates.remove(templateId);

    assert.equal(placement.current, null);
    assert.equal(placement.placing, false);
    assert.deepEqual(changes, [null]);
  });

  test("announces a renamed template without moving the session", () => {
    const { world, placement, changes } = setup();
    const templateId = readTemplate(world);
    placement.placeTemplate(templateId, { x: 0, y: 0, z: 0 });
    changes.length = 0;

    world.templates.update(templateId, { name: "House" });

    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.caption, "House → Ground");
  });

  test("ends a layer transform once its layer is removed", () => {
    const { world, placement, concealed, changes } = setup();
    placement.transformLayer("Draft");
    changes.length = 0;

    world.removeLayer("Draft");

    assert.equal(placement.current, null);
    assert.deepEqual(changes, [null]);
    assert.deepEqual(concealed, []);
  });

  test("ignores voxel edits that leave the session as it was", () => {
    const { world, placement, changes } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });
    changes.length = 0;

    world.setVoxelBulk("Ground", [
      {
        position: { x: 5, y: 0, z: 5 },
        blockId: 1
      }
    ]);

    assert.deepEqual(changes, []);
  });

  test("follows the selected voxel layer as the template target", () => {
    const { world, selection, placement, changes } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });
    changes.length = 0;

    selection.selectVoxelLayer("Draft");

    assert.equal(placement.current?.target, "Draft");
    assert.deepEqual(changes.map((current) => current?.target), ["Draft"]);
  });
});
