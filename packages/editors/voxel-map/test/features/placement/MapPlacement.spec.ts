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
  VoxelWorld,
  type VoxelTemplateVoxel,
  type VoxelLayer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import type { ActivePlacement } from "../../../src/features/placement/ActivePlacement.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import { SelectionStore } from "../../../src/state/index.ts";
import { mapDocumentOf } from "../../helpers/mapDocument.ts";

function setup() {
  const world = new VoxelWorld();
  const history = new VoxelHistory(world, { enabled: true });
  const mapDocument = mapDocumentOf(world);
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    selection,
    mapDocument
  });
  const concealed: string[] = [];
  const placement = new MapPlacement({
    world,
    history,
    selection,
    mapDocument,
    conceal: (layerName) => {
      concealed.push(layerName);

      return () => {
        concealed.splice(concealed.indexOf(layerName), 1);
      };
    }
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

function templateOf(
  world: VoxelWorld
): string {
  return world.templates.createFromLayer("Draft", { name: "Draft" })!.id;
}

function cellsOf(
  layer: VoxelLayer
): VoxelTemplateVoxel[] {
  const { x: ox, y: oy, z: oz } = layer.position;

  return [...layer.localVoxels()]
    .map(([x, y, z, packed, partner]): VoxelTemplateVoxel => [
      x + ox,
      y + oy,
      z + oz,
      packed,
      partner
    ])
    .sort(compareCells);
}

function compareCells(
  a: readonly number[],
  b: readonly number[]
): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

describe("MapPlacement session", () => {
  test("begins on a rounded cell, untransformed", () => {
    const { world, placement } = setup();

    placement.placeTemplate(templateOf(world), { x: 3.6, y: 0.2, z: -1.5 });

    const current = placement.current!;
    assert.equal(placement.placing, true);
    assert.deepEqual(current.placement.position, { x: 4, y: 0, z: -1 });
    assert.equal(current.placement.transform, VoxelTransform.Identity);
  });

  test("announces a move to a new cell and ignores moves within the same cell", () => {
    const { world, placement, changes } = setup();
    placement.placeTemplate(templateOf(world), { x: 4, y: 0, z: -2 });
    changes.length = 0;

    placement.move({ x: 4.2, y: 0, z: -2 });
    placement.move({ x: 6, y: 1, z: -2 });

    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0]?.placement.position, { x: 6, y: 1, z: -2 });
  });

  test("composes turns after the current transform", () => {
    const { world, placement } = setup();
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });

    placement.turn({ rotation: 1 });
    placement.turn({ rotation: 1 });
    placement.turn({ flipY: true });

    const expected = VoxelTransform.fromPacked(
      VoxelTransform.pack({ rotation: 2, flipY: true })
    );
    assert.ok(placement.current?.placement.transform.equals(expected));
  });

  test("ignores identity turns and edits without a session", () => {
    const { world, placement, changes } = setup();

    placement.move({ x: 1, y: 1, z: 1 });
    placement.turn({ rotation: 1 });
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });
    placement.turn({ rotation: 4 });

    assert.equal(changes.length, 1);
  });

  test("moves the placed bounds onto a cell", () => {
    const { world, placement } = setup();
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });

    placement.moveBoundsTo({ x: 10, y: 2, z: -4 });

    assert.deepEqual(placement.current?.bounds.min, { x: 10, y: 2, z: -4 });
  });

  test("cancelling ends the session once", () => {
    const { world, placement, changes } = setup();
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });
    changes.length = 0;

    assert.equal(placement.cancel(), true);
    assert.equal(placement.cancel(), false);
    assert.deepEqual(changes, [null]);
  });
});

describe("MapPlacement reconcile", () => {
  test("ends the session once when its template is removed", () => {
    const { world, placement, changes } = setup();
    const templateId = templateOf(world);
    placement.placeTemplate(templateId, { x: 0, y: 0, z: 0 });
    changes.length = 0;

    world.templates.remove(templateId);

    assert.equal(placement.current, null);
    assert.equal(placement.placing, false);
    assert.deepEqual(changes, [null]);
  });

  test("announces a renamed template without moving the session", () => {
    const { world, placement, changes } = setup();
    const templateId = templateOf(world);
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
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });
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
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });
    changes.length = 0;

    selection.selectVoxelLayer("Draft");

    assert.equal(placement.current?.target, "Draft");
    assert.deepEqual(changes.map((current) => current?.target), ["Draft"]);
  });
});

describe("MapPlacement templates", () => {
  test("stamps a turned template into the last voxel layer as one undo step", () => {
    const { world, history, placement } = setup();
    const template = world.templates.createFromLayer("Draft", { name: "Draft" })!;
    placement.placeTemplate(template.id, { x: 10, y: 3, z: 10 });
    placement.turn({ rotation: 1 });

    assert.equal(placement.current?.target, "Ground");
    assert.equal(placement.commit(), true);

    const ground = world.getLayer("Ground")!;
    const expected = template.placedVoxels(
      { x: 10, y: 3, z: 10 },
      VoxelTransform.fromPacked(VoxelTransform.pack({ rotation: 1 }))
    );
    assert.equal(placement.current, null);
    assert.deepEqual(cellsOf(ground), [...expected].sort(compareCells));

    history.undo();
    assert.equal(ground.voxelCount, 0);
  });

  test("keeps a template placement without a target layer", () => {
    const { world, placement } = setup();
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });
    world.removeLayer("Draft");
    world.removeLayer("Ground");

    assert.equal(placement.current?.target, null);
    assert.equal(placement.commit(), false);
    assert.equal(placement.placing, true);
  });

  test("refuses an unknown template", () => {
    const { placement } = setup();

    assert.equal(placement.placeTemplate("missing", { x: 0, y: 0, z: 0 }), false);
    assert.equal(placement.placing, false);
  });
});

describe("MapPlacement layers", () => {
  test("frames the layer content and conceals the layer until the session ends", () => {
    const { world, concealed, placement } = setup();

    assert.equal(placement.transformLayer("Draft"), true);

    const current = placement.current!;
    const bounds = world.getLayer("Draft")!.worldBounds()!;
    assert.equal(current.target, "Draft");
    assert.equal(placement.transforming("Draft"), true);
    assert.equal(placement.transforming("Ground"), false);
    assert.deepEqual(concealed, ["Draft"]);
    assert.deepEqual(current.bounds, {
      min: {
        x: bounds.min.x,
        y: bounds.min.y,
        z: bounds.min.z
      },
      size: {
        x: 3,
        y: 2,
        z: 2
      }
    });

    assert.equal(placement.cancel(), true);
    assert.deepEqual(concealed, []);
    assert.equal(placement.cancel(), false);
  });

  test("refuses an empty or unknown layer", () => {
    const { placement } = setup();

    assert.equal(placement.transformLayer("Ground"), false);
    assert.equal(placement.transformLayer("Missing"), false);
    assert.equal(placement.placing, false);
  });

  test("lands a moved and turned layer exactly where the marquee shows it", () => {
    const { world, placement } = setup();
    for (const transform of [
      { rotation: 1 },
      { rotation: 3 },
      { flipX: true },
      { rotation: 2, flipZ: true },
      {}
    ]) {
      placement.transformLayer("Draft");
      placement.turn(transform);
      const moved = placement.current!.placement.position;
      placement.move({
        x: moved.x + 5,
        y: moved.y + 1,
        z: moved.z - 2
      });
      const current = placement.current!;
      const expected = [
        ...current.template.placedVoxels(
          current.placement.position,
          current.placement.transform
        )
      ].sort(compareCells);

      assert.equal(placement.commit(), true);
      assert.equal(placement.current, null);
      assert.deepEqual(cellsOf(world.getLayer("Draft")!), expected);
    }
  });

  test("an unmoved, untransformed commit leaves the layer as it was", () => {
    const { world, placement } = setup();
    const before = cellsOf(world.getLayer("Draft")!);
    const position = { ...world.getLayer("Draft")!.position };

    placement.transformLayer("Draft");
    placement.commit();

    assert.deepEqual(cellsOf(world.getLayer("Draft")!), before);
    assert.deepEqual(world.getLayer("Draft")!.position, position);
  });

  test("disposing releases the concealed layer and stops listening", () => {
    const { world, concealed, placement, changes } = setup();
    placement.transformLayer("Draft");
    changes.length = 0;

    placement.dispose();
    world.removeLayer("Draft");

    assert.deepEqual(concealed, []);
    assert.deepEqual(changes, []);
  });
});
