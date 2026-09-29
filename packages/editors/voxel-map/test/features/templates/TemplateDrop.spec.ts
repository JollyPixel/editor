// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelHistory,
  VoxelWorld,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import { TemplateDrop } from "../../../src/features/templates/TemplateDrop.ts";

// CONSTANTS
const kViewportEdge = 100;

function setup() {
  const world = new VoxelWorld();
  world.addLayer("Draft");
  world.setVoxelBulk("Draft", [
    {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    }
  ]);
  const template = world.templates.createFromLayer("Draft", { name: "Draft" })!;
  const placement = new MapPlacement({
    world,
    history: new VoxelHistory(world, { enabled: true }),
    selection: { lastVoxelLayer: "Draft" }
  });
  const drop = new TemplateDrop({
    templateId: template.id,
    placement,
    pointAt: (clientX, clientY): VoxelCoord | null => {
      if (clientX >= kViewportEdge) {
        return null;
      }

      return { x: clientX, y: 0, z: clientY };
    }
  });

  return {
    world,
    template,
    placement,
    drop
  };
}

describe("TemplateDrop", () => {
  test("starts placing the template at the hovered viewport cell", () => {
    const { world, template, placement, drop } = setup();

    drop.hover(3, 4);

    assert.equal(drop.placing, true);
    const current = placement.store.placement;
    assert.equal(current?.source.resolve(world), template);
    assert.deepEqual(current?.position, { x: 3, y: 0, z: 4 });
  });

  test("moves the placement with the pointer", () => {
    const { placement, drop } = setup();

    drop.hover(3, 4);
    drop.hover(7, 1);

    assert.deepEqual(placement.store.placement?.position, { x: 7, y: 0, z: 1 });
  });

  test("cancels the placement when the pointer leaves the viewport", () => {
    const { placement, drop } = setup();

    drop.hover(3, 4);
    drop.hover(kViewportEdge, 4);

    assert.equal(drop.placing, false);
    assert.equal(placement.store.placement, null);
  });

  test("keeps the placement staged when dropped over the viewport", () => {
    const { placement, drop } = setup();

    drop.hover(3, 4);
    drop.finish("commit");

    assert.equal(drop.placing, false);
    assert.deepEqual(placement.store.placement?.position, { x: 3, y: 0, z: 4 });
  });

  test("cancels the placement when the drag is cancelled", () => {
    const { placement, drop } = setup();

    drop.hover(3, 4);
    drop.finish("cancel");

    assert.equal(placement.store.placement, null);
  });

  test("leaves an unrelated placement alone when cancelled outside the viewport", () => {
    const { template, placement, drop } = setup();
    placement.placeTemplate(template.id, { x: 9, y: 9, z: 9 });

    drop.hover(kViewportEdge, 0);
    drop.finish("cancel");

    assert.deepEqual(placement.store.placement?.position, { x: 9, y: 9, z: 9 });
  });
});
