// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  composeBlockId,
  MaterialGroup
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MaterialSwatch } from "../../../src/features/materials/MaterialSwatch.ts";
import {
  block,
  DIRT_ID,
  GRASS_ID,
  SAND_ID,
  setupMaterials,
  STONE_ID,
  TERRAIN_SLOT
} from "../../helpers/mapMaterials.ts";

describe("MapMaterials lifecycle", () => {
  it("creates an unused material in a blockset with a stored swatch", () => {
    const { document, materials } = setupMaterials([
      block(GRASS_ID, "terrain/Material"),
      block(DIRT_ID)
    ]);

    assert.equal(materials.create(TERRAIN_SLOT), "terrain/Material 2");

    const created = document.materialGroups.get("terrain/Material 2");
    assert.equal(document.blocks.get(DIRT_ID)?.materialGroup, undefined);
    assert.equal(created?.swatch, MaterialSwatch.derivedColor("terrain/Material 2"));
    assert.deepEqual(
      materials.availableTo(DIRT_ID).map((material) => material.name),
      ["Material", "Material 2"]
    );
  });

  it("duplicates the current finish under a free copy name with its own swatch and no blocks", () => {
    const { document, materials } = setupMaterials(
      [block(GRASS_ID, "terrain/gold")],
      [
        new MaterialGroup({ id: "terrain/gold", metalness: 1, emissive: "#ff8800", swatch: "#ffcc00" }),
        new MaterialGroup({ id: "terrain/gold copy" })
      ]
    );
    const gold = materials.findForBlock(GRASS_ID)!;
    materials.refinish(gold, { roughness: 0.3 });

    assert.equal(materials.duplicate(gold), "terrain/gold copy 2");

    const copy = document.materialGroups.get("terrain/gold copy 2");
    assert.equal(copy?.metalness, 1);
    assert.equal(copy?.roughness, 0.3);
    assert.equal(copy?.emissive, "#ff8800");
    assert.equal(copy?.swatch, MaterialSwatch.derivedColor("terrain/gold copy 2"));
    assert.equal(document.blocks.get(GRASS_ID)?.materialGroup, "terrain/gold");
  });

  it("creates a material in the block's blockset and applies it", () => {
    const { document, materials } = setupMaterials([
      block(GRASS_ID, "terrain/Material"),
      block(STONE_ID)
    ]);

    assert.equal(materials.createForBlock(STONE_ID), "rock/Material");
    assert.equal(document.blocks.get(STONE_ID)?.materialGroup, "rock/Material");
    assert.equal(document.materialGroups.has("rock/Material"), true);
    assert.equal(materials.createForBlock(composeBlockId(9, 1)), null);
  });

  it("keeps a stored swatch through a rename and recolours it", () => {
    const { document, materials } = setupMaterials([block(GRASS_ID)]);
    const groupId = materials.create(TERRAIN_SLOT)!;
    const swatch = document.materialGroups.get(groupId)?.swatch;

    assert.equal(materials.rename(materials.inSlot(TERRAIN_SLOT)[0], "gold"), "renamed");
    const gold = materials.inSlot(TERRAIN_SLOT)[0];
    assert.equal(gold.swatch.color, swatch);

    assert.equal(materials.refinish(gold, { swatch: "#ff0000" }), true);
    assert.equal(materials.refinish(gold, { swatch: "red" }), false);
    assert.equal(materials.inSlot(TERRAIN_SLOT)[0].swatch.color, "#ff0000");
  });

  it("finds a name taken by another material of the same blockset only", () => {
    const { materials } = setupMaterials(
      [block(GRASS_ID, "terrain/wet"), block(DIRT_ID, "terrain/mud")],
      [new MaterialGroup({ id: "terrain/dry" }), new MaterialGroup({ id: "rock/moss" })]
    );
    const wet = materials.findForBlock(GRASS_ID)!;

    assert.equal(materials.isNameTaken(wet, " dry "), true);
    assert.equal(materials.isNameTaken(wet, "mud"), true);
    assert.equal(materials.isNameTaken(wet, "wet"), false);
    assert.equal(materials.isNameTaken(wet, "moss"), false);
  });

  it("renames a material on every block using it and moves its finish", () => {
    const { document, materials } = setupMaterials(
      [
        block(GRASS_ID, "terrain/wet"),
        block(DIRT_ID, "terrain/wet"),
        block(SAND_ID, "terrain/dry")
      ],
      [new MaterialGroup({ id: "terrain/wet", roughness: 0.2 })]
    );
    const wet = materials.findForBlock(GRASS_ID)!;

    assert.equal(materials.rename(wet, "dry"), "taken");
    assert.equal(materials.rename(wet, "  "), "unchanged");
    assert.equal(materials.rename(wet, "wet"), "unchanged");
    assert.equal(materials.rename(wet, " soaked "), "renamed");

    assert.equal(document.blocks.get(GRASS_ID)?.materialGroup, "terrain/soaked");
    assert.equal(document.blocks.get(DIRT_ID)?.materialGroup, "terrain/soaked");
    assert.equal(document.blocks.get(SAND_ID)?.materialGroup, "terrain/dry");
    assert.equal(document.materialGroups.has("terrain/wet"), false);
    assert.equal(document.materialGroups.get("terrain/soaked")?.roughness, 0.2);
  });

  it("removes a material from every block and drops its finish", () => {
    const { document, materials } = setupMaterials(
      [
        block(GRASS_ID, "terrain/wet"),
        block(DIRT_ID, "terrain/wet")
      ],
      [new MaterialGroup({ id: "terrain/wet" })]
    );

    materials.remove(materials.findForBlock(GRASS_ID)!);

    assert.equal(document.blocks.get(GRASS_ID)?.materialGroup, undefined);
    assert.equal(document.blocks.get(DIRT_ID)?.materialGroup, undefined);
    assert.equal(document.materialGroups.size, 0);
    assert.deepEqual(materials.availableTo(GRASS_ID), []);
  });
});
