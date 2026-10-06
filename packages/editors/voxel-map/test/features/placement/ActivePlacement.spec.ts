// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { ActivePlacement } from "../../../src/features/placement/ActivePlacement.ts";
import { Placement } from "../../../src/features/placement/Placement.ts";
import {
  LayerSource,
  TemplateSource
} from "../../../src/features/placement/PlacementSource.ts";

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
  const layerSource = LayerSource.capture(world, "Draft")!;

  return {
    template,
    templatePlacement: Placement.at(
      new TemplateSource(template.id),
      { x: 0, y: 0, z: 0 }
    ),
    layerSource,
    layerPlacement: Placement.at(layerSource, { x: 0, y: 0, z: 0 })
  };
}

describe("ActivePlacement", () => {
  test("names the template and the layer it lands in", () => {
    const { template, templatePlacement } = setup();

    const active = new ActivePlacement(templatePlacement, template, "Ground");

    assert.strictEqual(active.icon, "template");
    assert.strictEqual(active.caption, "House → Ground");
    assert.strictEqual(active.committable, true);
    assert.strictEqual(
      active.commitLabel("Enter"),
      "Commit into Ground (Enter)"
    );
  });

  test("a template without a target layer cannot be committed", () => {
    const { template, templatePlacement } = setup();

    const active = new ActivePlacement(templatePlacement, template, null);

    assert.strictEqual(active.caption, "House");
    assert.strictEqual(active.committable, false);
    assert.strictEqual(
      active.commitLabel("Enter"),
      "Commit (add a voxel layer first)"
    );
  });

  test("a layer transform names the layer once", () => {
    const { layerSource, layerPlacement } = setup();

    const active = new ActivePlacement(
      layerPlacement,
      layerSource.snapshot,
      "Draft"
    );

    assert.strictEqual(active.icon, "voxel-layer");
    assert.strictEqual(active.caption, "Draft");
  });

  test("equals compares the placement, the resolved template and the target", () => {
    const { template, templatePlacement } = setup();
    const active = new ActivePlacement(templatePlacement, template, "Ground");

    assert.equal(
      active.equals(new ActivePlacement(templatePlacement, template, "Ground")),
      true
    );
    assert.equal(
      active.equals(new ActivePlacement(templatePlacement, template, "Roof")),
      false
    );
    assert.equal(
      active.equals(new ActivePlacement(
        templatePlacement,
        template.withPatch({ name: "Hut" }),
        "Ground"
      )),
      false
    );
    assert.equal(active.equals(null), false);
  });
});
