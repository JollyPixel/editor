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
  VOXEL_ABSENT,
  voxelBlockId,
  type VoxelTemplateVoxel,
  type VoxelLayer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import { CellRegion } from "../../../src/features/placement/CellRegion.ts";
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

  test("mirrors in place and keeps turning around the pivot", () => {
    const { world, placement } = setup();
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });
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

describe("MapPlacement regions", () => {
  function blocksOf(
    layer: VoxelLayer
  ): Array<[number, number, number, number]> {
    return cellsOf(layer).map(([x, y, z, packed]) => [
      x,
      y,
      z,
      voxelBlockId(packed)
    ]);
  }

  const kLowerCorner = CellRegion.spanning(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 4, z: 4 }
  );

  test("lifts the voxels inside the region out of the layer, framed by their content", () => {
    const { world, placement, concealed } = setup();

    assert.equal(placement.liftRegion("Draft", kLowerCorner), true);

    assert.deepEqual(blocksOf(world.getLayer("Draft")!), [[2, 0, 0, 1]]);
    const current = placement.current!;
    assert.equal(current.kind, "region");
    assert.equal(current.target, "Draft");
    assert.equal(current.deletable, true);
    assert.equal(current.caption, "Selection → Draft");
    assert.equal(current.template.voxelCount, 3);
    assert.deepEqual(current.bounds, {
      min: { x: 0, y: 0, z: 0 },
      size: { x: 2, y: 2, z: 2 }
    });
    assert.deepEqual(concealed, []);
  });

  test("lifts and moves only the voxels connected to a cell, as one undo step", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = cellsOf(draft);

    assert.equal(placement.liftConnected("Draft", { x: 1, y: 0, z: 0 }), true);
    assert.deepEqual(blocksOf(draft), [[0, 1, 1, 3]]);
    assert.deepEqual(placement.current!.bounds, {
      min: { x: 0, y: 0, z: 0 },
      size: { x: 3, y: 1, z: 1 }
    });

    placement.moveBoundsTo({ x: 0, y: 0, z: 2 });
    assert.equal(placement.commit(), true);
    assert.deepEqual(blocksOf(draft), [
      [0, 0, 2, 1],
      [0, 1, 1, 3],
      [1, 0, 2, 2],
      [2, 0, 2, 1]
    ]);

    history.undo();
    assert.deepEqual(cellsOf(draft), before);
  });

  test("refuses to lift connected voxels from an empty cell or a missing layer", () => {
    const { placement } = setup();

    assert.equal(placement.liftConnected("Draft", { x: 5, y: 0, z: 5 }), false);
    assert.equal(placement.liftConnected("Missing", { x: 0, y: 0, z: 0 }), false);
    assert.equal(placement.placing, false);
  });

  test("refuses a region without voxels or without its layer", () => {
    const { placement } = setup();
    const empty = CellRegion.spanning(
      { x: 5, y: 0, z: 5 },
      { x: 6, y: 0, z: 6 }
    );

    assert.equal(placement.liftRegion("Draft", empty), false);
    assert.equal(placement.liftRegion("Missing", kLowerCorner), false);
    assert.equal(placement.placing, false);
  });

  test("moves the lifted voxels and clears the cells they left, as one undo step", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = cellsOf(draft);
    placement.liftRegion("Draft", kLowerCorner);

    placement.moveBoundsTo({ x: 1, y: 0, z: 0 });

    assert.equal(placement.commit(), true);
    assert.equal(placement.current, null);
    assert.deepEqual(blocksOf(draft), [
      [1, 0, 0, 1],
      [1, 1, 1, 3],
      [2, 0, 0, 2]
    ]);

    history.undo();
    assert.deepEqual(cellsOf(draft), before);
  });

  test("turns the lifted voxels around their pivot and leaves voxels outside the region", () => {
    const { world, placement } = setup();
    placement.liftRegion("Draft", kLowerCorner);
    placement.turn({ rotation: 1 });
    const current = placement.current!;
    const expected = [
      ...current.template.placedVoxels(
        current.placement.position,
        current.placement.transform
      ),
      [
        2,
        0,
        0,
        world.getLayer("Draft")!.getPackedVoxelAt({ x: 2, y: 0, z: 0 }),
        VOXEL_ABSENT
      ]
    ].sort(compareCells);

    placement.commit();

    assert.deepEqual(cellsOf(world.getLayer("Draft")!), expected);
  });

  test("an unmoved commit ends the session without writing history", () => {
    const { history, placement } = setup();
    const depth = history.undoDepth;
    placement.liftRegion("Draft", kLowerCorner);

    assert.equal(placement.commit(), true);
    assert.equal(placement.placing, false);
    assert.equal(history.undoDepth, depth);
  });

  test("deleting removes only the lifted voxels, as one undo step", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = cellsOf(draft);
    placement.liftRegion("Draft", kLowerCorner);
    placement.moveBoundsTo({ x: 8, y: 0, z: 8 });

    assert.equal(placement.deleteRegion(), true);
    assert.equal(placement.placing, false);
    assert.deepEqual(blocksOf(draft), [[2, 0, 0, 1]]);

    history.undo();
    assert.deepEqual(cellsOf(draft), before);
  });

  test("refuses to delete outside a region session", () => {
    const { world, placement } = setup();
    placement.placeTemplate(templateOf(world), { x: 0, y: 0, z: 0 });

    assert.equal(placement.deleteRegion(), false);
    assert.equal(placement.placing, true);
  });

  test("cancelling puts the lifted voxels back without writing history", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = cellsOf(draft);
    const depth = history.undoDepth;
    placement.liftRegion("Draft", kLowerCorner);
    placement.moveBoundsTo({ x: 8, y: 0, z: 8 });

    assert.equal(placement.cancel(), true);

    assert.deepEqual(cellsOf(draft), before);
    assert.equal(history.undoDepth, depth);
  });

  test("cancelLift puts a lifted region back, once", () => {
    const { world, history, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = cellsOf(draft);
    const depth = history.undoDepth;
    placement.liftRegion("Draft", kLowerCorner);

    assert.equal(placement.lifted?.layerName, "Draft");
    assert.equal(history.undoDepth, depth);
    assert.equal(placement.cancelLift(), true);
    assert.equal(placement.cancelLift(), false);
    assert.deepEqual(cellsOf(draft), before);
    assert.equal(history.undoDepth, depth);
  });

  test("puts the lifted voxels back when another placement starts or when disposed", () => {
    const { world, placement } = setup();
    const draft = world.getLayer("Draft")!;
    const before = cellsOf(draft);
    const templateId = templateOf(world);

    placement.liftRegion("Draft", kLowerCorner);
    placement.placeTemplate(templateId, { x: 9, y: 0, z: 9 });
    assert.deepEqual(cellsOf(draft), before);

    placement.liftRegion("Draft", kLowerCorner);
    placement.dispose();
    assert.deepEqual(cellsOf(draft), before);
  });

  test("keeps targeting its own layer when another voxel layer is selected", () => {
    const { selection, placement } = setup();
    placement.liftRegion("Draft", kLowerCorner);

    selection.selectVoxelLayer("Ground");

    assert.equal(placement.current?.target, "Draft");
  });
});
