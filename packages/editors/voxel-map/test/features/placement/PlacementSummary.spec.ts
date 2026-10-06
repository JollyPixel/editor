// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { Placement } from "../../../src/features/placement/Placement.ts";
import {
  LayerSource,
  TemplateSource
} from "../../../src/features/placement/PlacementSource.ts";
import { PlacementSummary } from "../../../src/features/placement/PlacementSummary.ts";

function setup() {
  const world = new VoxelWorld();
  world.addLayer("Draft");
  world.setVoxelBulk("Draft", [
    {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    }
  ]);
  const template = world.templates.createFromLayer("Draft", {
    name: "House"
  })!;

  return {
    world,
    templatePlacement: Placement.at(
      new TemplateSource(template.id),
      { x: 0, y: 0, z: 0 }
    ),
    layerPlacement: Placement.at(
      LayerSource.capture(world, "Draft")!,
      { x: 0, y: 0, z: 0 }
    )
  };
}

describe("PlacementSummary", () => {
  test("names the template and the layer it lands in", () => {
    const { world, templatePlacement } = setup();

    const summary = PlacementSummary.of(templatePlacement, world, "Ground");

    assert.strictEqual(summary.icon, "template");
    assert.strictEqual(summary.caption, "House → Ground");
    assert.strictEqual(summary.committable, true);
    assert.strictEqual(
      summary.commitLabel("Enter"),
      "Commit into Ground (Enter)"
    );
  });

  test("a template without a target layer cannot be committed", () => {
    const { world, templatePlacement } = setup();

    const summary = PlacementSummary.of(templatePlacement, world, null);

    assert.strictEqual(summary.caption, "House");
    assert.strictEqual(summary.committable, false);
    assert.strictEqual(
      summary.commitLabel("Enter"),
      "Commit (add a voxel layer first)"
    );
  });

  test("a layer transform names the layer once", () => {
    const { world, layerPlacement } = setup();

    const summary = PlacementSummary.of(layerPlacement, world, "Draft");

    assert.strictEqual(summary.icon, "voxel-layer");
    assert.strictEqual(summary.caption, "Draft");
  });
});
