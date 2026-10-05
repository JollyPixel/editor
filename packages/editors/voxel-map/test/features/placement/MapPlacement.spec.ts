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
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";

function setup() {
  const world = new VoxelWorld();
  const history = new VoxelHistory(world, { enabled: true });
  const selection: { lastVoxelLayer: string | null; } = {
    lastVoxelLayer: "Ground"
  };
  const concealed: string[] = [];
  const placement = new MapPlacement({
    world,
    history,
    selection,
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

  return {
    world,
    history,
    selection,
    concealed,
    placement
  };
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

describe("MapPlacement templates", () => {
  test("stamps a turned template into the last voxel layer as one undo step", () => {
    const { world, history, placement } = setup();
    const template = world.templates.createFromLayer("Draft", { name: "Draft" })!;
    placement.placeTemplate(template.id, { x: 10, y: 3, z: 10 });
    placement.store.transform({ rotation: 1 });

    assert.equal(placement.target, "Ground");
    assert.equal(placement.commit(), true);

    const ground = world.getLayer("Ground")!;
    const expected = template.placedVoxels(
      { x: 10, y: 3, z: 10 },
      VoxelTransform.fromPacked(VoxelTransform.pack({ rotation: 1 }))
    );
    assert.equal(placement.store.placement, null);
    assert.deepEqual(cellsOf(ground), [...expected].sort(compareCells));

    history.undo();
    assert.equal(ground.voxelCount, 0);
  });

  test("keeps a template placement without a target layer", () => {
    const { world, selection, placement } = setup();
    const template = world.templates.createFromLayer("Draft", { name: "Draft" })!;
    placement.placeTemplate(template.id, { x: 0, y: 0, z: 0 });
    selection.lastVoxelLayer = null;

    assert.equal(placement.target, null);
    assert.equal(placement.commit(), false);
    assert.notEqual(placement.store.placement, null);
  });

  test("refuses an unknown template", () => {
    const { placement } = setup();

    assert.equal(placement.placeTemplate("missing", { x: 0, y: 0, z: 0 }), false);
    assert.equal(placement.store.placing, false);
  });
});

describe("MapPlacement layers", () => {
  test("frames the layer content and conceals the layer until the session ends", () => {
    const { world, concealed, placement } = setup();

    assert.equal(placement.transformLayer("Draft"), true);

    const current = placement.store.placement!;
    const bounds = world.getLayer("Draft")!.worldBounds()!;
    assert.equal(placement.target, "Draft");
    assert.equal(placement.transforming("Draft"), true);
    assert.equal(placement.transforming("Ground"), false);
    assert.deepEqual(concealed, ["Draft"]);
    assert.deepEqual(current.boundsIn(current.source.resolve(world)!), {
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
    assert.equal(placement.store.placing, false);
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
      placement.store.transform(transform);
      const moved = placement.store.placement!.position;
      placement.store.move({
        x: moved.x + 5,
        y: moved.y + 1,
        z: moved.z - 2
      });
      const current = placement.store.placement!;
      const expected = [
        ...current.source.resolve(world)!.placedVoxels(
          current.position,
          current.transform
        )
      ].sort(compareCells);

      assert.equal(placement.commit(), true);
      assert.equal(placement.store.placement, null);
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
});
