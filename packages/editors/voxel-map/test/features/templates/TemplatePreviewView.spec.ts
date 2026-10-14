// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { resolveTemplatePreview } from "../../../src/features/templates/TemplatePreviewView.ts";

function worldWithTemplate() {
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
    template
  };
}

describe("resolveTemplatePreview", () => {
  test("hides the preview while the world has no template", () => {
    const world = new VoxelWorld();

    assert.deepEqual(
      resolveTemplatePreview(world.templates, "template_0"),
      { kind: "hidden" }
    );
  });

  test("shows an empty well until an existing template is selected", () => {
    const { world } = worldWithTemplate();

    assert.deepEqual(resolveTemplatePreview(world.templates, null), { kind: "empty" });
    assert.deepEqual(resolveTemplatePreview(world.templates, "removed"), { kind: "empty" });
  });

  test("shows the selected template", () => {
    const { world, template } = worldWithTemplate();

    assert.deepEqual(
      resolveTemplatePreview(world.templates, template.id),
      {
        kind: "template",
        template
      }
    );
  });
});
