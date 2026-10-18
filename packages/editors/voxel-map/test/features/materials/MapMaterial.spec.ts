// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MaterialGroup } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  block,
  DIRT_ID,
  GRASS_ID,
  setupMaterials,
  STONE_ID
} from "../../helpers/mapMaterials.ts";

function setupGold() {
  const { document, materials } = setupMaterials(
    [block(GRASS_ID, "terrain/gold"), block(DIRT_ID), block(STONE_ID)],
    [
      new MaterialGroup({ id: "terrain/gold", roughness: 0.4, emissive: "#ff0000" }),
      new MaterialGroup({ id: "terrain/plain" })
    ]
  );
  const [gold, plain] = materials.availableTo(GRASS_ID);

  return {
    gold,
    plain,
    blocks: document.blocks
  };
}

function editable(): boolean {
  return true;
}

describe("MapMaterial", () => {
  it("applies to an editable block of its blockset, or removes itself from a block using it", () => {
    const { gold, blocks } = setupGold();

    assert.equal(gold.useOn(blocks.get(DIRT_ID), editable).kind, "apply");
    assert.equal(gold.useOn(blocks.get(GRASS_ID), editable).kind, "unapply");
  });

  it("explains why it cannot apply to no block, another blockset's block or a read-only block", () => {
    const { gold, blocks } = setupGold();

    const reasons = [
      gold.useOn(undefined, editable),
      gold.useOn(blocks.get(STONE_ID), editable),
      gold.useOn(blocks.get(DIRT_ID), () => false)
    ].map((use) => (use.kind === "blocked" ? use.reason : use.kind));

    assert.deepEqual(reasons, [
      "Select a block to apply this material",
      `block-${STONE_ID} belongs to another blockset`,
      "You can only view the blocks of this blockset"
    ]);
  });

  it("tells whether some finish fields or the whole finish are at their defaults", () => {
    const { gold, plain } = setupGold();

    assert.equal(gold.isDefault(["metalness", "normalScale"]), true);
    assert.equal(gold.isDefault(["metalness", "roughness"]), false);
    assert.equal(gold.isDefault(), false);
    assert.equal(plain.isDefault(), true);
  });
});
