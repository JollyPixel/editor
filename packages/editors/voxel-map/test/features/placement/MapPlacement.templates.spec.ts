// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import {
  VoxelTransform,
  VoxelWorld,
  type VoxelTemplateVoxel,
  type VoxelLayer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { createWorldHistory } from "../../helpers/mapHistory.ts";
import { MAP_HISTORY_SCOPE } from "../../../src/shared/mapHistory.ts";
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import type { ActivePlacement } from "../../../src/features/placement/ActivePlacement.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import { SelectionStore } from "../../../src/state/index.ts";
import { createMapDocument } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

function setup() {
  const world = new VoxelWorld();
  const history = createWorldHistory(world);
  const mapDocument = createMapDocument(world);
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    selection,
    mapDocument,
    access: mapAccess()
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

function scanCells(
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
    placement.turn({ rotation: 1 });

    assert.equal(placement.current?.target, "Ground");
    assert.equal(placement.commit(), true);

    const ground = world.getLayer("Ground")!;
    const expected = template.placedVoxels(
      { x: 10, y: 3, z: 10 },
      VoxelTransform.fromPacked(VoxelTransform.pack({ rotation: 1 }))
    );
    assert.equal(placement.current, null);
    assert.deepEqual(scanCells(ground), [...expected].sort(compareCells));

    history.undo(MAP_HISTORY_SCOPE);
    assert.equal(ground.voxelCount, 0);
  });

  test("keeps a template placement without a target layer", () => {
    const { world, placement } = setup();
    placement.placeTemplate(readTemplate(world), { x: 0, y: 0, z: 0 });
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
      assert.deepEqual(scanCells(world.getLayer("Draft")!), expected);
    }
  });

  test("an unmoved, untransformed commit leaves the layer as it was", () => {
    const { world, placement } = setup();
    const before = scanCells(world.getLayer("Draft")!);
    const position = { ...world.getLayer("Draft")!.position };

    placement.transformLayer("Draft");
    placement.commit();

    assert.deepEqual(scanCells(world.getLayer("Draft")!), before);
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
