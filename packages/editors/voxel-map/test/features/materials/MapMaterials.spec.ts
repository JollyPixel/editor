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
  ROCK_SLOT,
  SAND_ID,
  setupMaterials,
  STONE_ID,
  TERRAIN_SLOT
} from "../../helpers/mapMaterials.ts";

describe("MapMaterials", () => {
  it("lists the materials of the block's blockset, finished or used, by name", () => {
    const { materials } = setupMaterials(
      [
        block(GRASS_ID, "terrain/wet"),
        block(DIRT_ID, "terrain/wet"),
        block(SAND_ID),
        block(STONE_ID, "rock/wet")
      ],
      [
        new MaterialGroup({ id: "terrain/gold", metalness: 1 }),
        new MaterialGroup({ id: "rock/dull" })
      ]
    );

    const listed = materials.availableTo(SAND_ID);

    assert.deepEqual(listed.map((material) => material.name), ["gold", "wet"]);
    assert.deepEqual(listed[0].blockIds, []);
    assert.equal(listed[0].finish.metalness, 1);
    assert.deepEqual(listed[1].blockIds, [GRASS_ID, DIRT_ID]);
    assert.ok(listed[1].finish.equals(new MaterialGroup({ id: "terrain/wet" })));
    assert.equal(materials.findForBlock(GRASS_ID)?.id, "terrain/wet");
    assert.equal(materials.findForBlock(SAND_ID), undefined);
    assert.deepEqual(materials.availableTo(composeBlockId(9, 1)), []);
  });

  it("lists the materials of one blockset slot", () => {
    const { materials } = setupMaterials(
      [block(GRASS_ID, "terrain/wet"), block(STONE_ID, "rock/wet")],
      [new MaterialGroup({ id: "rock/dull" })]
    );

    assert.deepEqual(materials.inSlot(ROCK_SLOT).map((material) => material.id), ["rock/dull", "rock/wet"]);
    assert.deepEqual(materials.inSlot(TERRAIN_SLOT).map((material) => material.id), ["terrain/wet"]);
  });

  it("assigns a material and drops it again, keeping the finish", () => {
    const { document, materials } = setupMaterials(
      [block(GRASS_ID)],
      [new MaterialGroup({ id: "terrain/gold" })]
    );
    const [gold] = materials.availableTo(GRASS_ID);

    assert.equal(materials.assign(GRASS_ID, gold.id), true);
    assert.equal(materials.assign(GRASS_ID, gold.id), false);
    assert.equal(document.blocks.get(GRASS_ID)?.materialGroup, "terrain/gold");

    assert.equal(materials.assign(GRASS_ID, null), true);
    assert.equal(document.blocks.get(GRASS_ID)?.materialGroup, undefined);
    assert.deepEqual(materials.availableTo(GRASS_ID).map((material) => material.id), ["terrain/gold"]);
  });

  it("refinishes one field and drops an out of range or unchanged value", () => {
    const { document, materials } = setupMaterials(
      [block(GRASS_ID, "terrain/gold")],
      [new MaterialGroup({ id: "terrain/gold", roughness: 0.4 })]
    );
    const gold = materials.findForBlock(GRASS_ID)!;

    assert.equal(materials.refinish(gold, { metalness: 1 }), true);
    assert.equal(materials.refinish(gold, { metalness: 1 }), false);
    assert.equal(materials.refinish(gold, { metalness: 2 }), false);
    assert.equal(materials.refinish(gold, { normalScale: -1 }), false);

    const finish = document.materialGroups.get("terrain/gold");
    assert.equal(finish?.metalness, 1);
    assert.equal(finish?.roughness, 0.4);
  });

  it("resets some finish fields or the whole finish to defaults, keeping the swatch", () => {
    const { document, materials } = setupMaterials(
      [block(GRASS_ID, "terrain/gold")],
      [
        new MaterialGroup({
          id: "terrain/gold",
          roughness: 0.4,
          metalness: 1,
          emissive: "#ff0000",
          swatch: "#ffcc00"
        })
      ]
    );
    const gold = materials.findForBlock(GRASS_ID)!;

    assert.equal(materials.resetFinish(gold, ["roughness", "metalness"]), true);
    const surfaceReset = document.materialGroups.get("terrain/gold");
    assert.equal(surfaceReset?.roughness, MaterialGroup.defaults.roughness);
    assert.equal(surfaceReset?.metalness, MaterialGroup.defaults.metalness);
    assert.equal(surfaceReset?.emissive, "#ff0000");

    assert.equal(materials.resetFinish(gold), true);
    assert.equal(materials.resetFinish(gold), false);
    const reset = document.materialGroups.get("terrain/gold");
    assert.equal(reset?.emissive, MaterialGroup.defaults.emissive);
    assert.equal(reset?.swatch, "#ffcc00");
  });

  it("refinishes the light level as a whole step from 0 to 15", () => {
    const { document, materials } = setupMaterials(
      [block(GRASS_ID, "terrain/glow")],
      [new MaterialGroup({ id: "terrain/glow" })]
    );
    const glow = materials.findForBlock(GRASS_ID)!;

    assert.equal(materials.refinish(glow, { lightLevel: 12 }), true);
    assert.equal(materials.refinish(glow, { lightLevel: 16 }), false);
    assert.equal(materials.refinish(glow, { lightLevel: 2.5 }), false);

    assert.equal(document.materialGroups.get("terrain/glow")?.lightLevel, 12);
  });

  it("defines the finish of a material only its blocks named", () => {
    const { document, materials } = setupMaterials([block(GRASS_ID, "terrain/wet")]);

    assert.equal(materials.refinish(materials.findForBlock(GRASS_ID)!, { roughness: 0.2 }), true);

    assert.equal(document.materialGroups.get("terrain/wet")?.roughness, 0.2);
  });

  it("gives blocks sharing a material the same swatch, glowing with its emissive", () => {
    const { materials } = setupMaterials(
      [
        block(GRASS_ID, "terrain/wet"),
        block(DIRT_ID, "terrain/wet"),
        block(SAND_ID, "terrain/lava"),
        block(STONE_ID)
      ],
      [
        new MaterialGroup({ id: "terrain/lava", emissive: "#ff6600" }),
        new MaterialGroup({ id: "terrain/wet", emissiveIntensity: 0, emissive: "#ffffff" })
      ]
    );

    const swatches = materials.swatches();

    assert.equal(swatches.has(STONE_ID), false);
    assert.strictEqual(swatches.get(GRASS_ID), swatches.get(DIRT_ID));
    assert.notEqual(swatches.get(GRASS_ID)?.color, swatches.get(SAND_ID)?.color);
    assert.equal(swatches.get(GRASS_ID)?.glow, null);
    assert.equal(swatches.get(SAND_ID)?.glow, "#ff6600");
  });

  it("paints a stored swatch colour and derives one for a group without", () => {
    const { materials } = setupMaterials(
      [block(GRASS_ID, "terrain/gold"), block(DIRT_ID, "terrain/wet")],
      [new MaterialGroup({ id: "terrain/gold", swatch: "#ffcc00" })]
    );

    const swatches = materials.swatches();

    assert.equal(swatches.get(GRASS_ID)?.color, "#ffcc00");
    assert.equal(swatches.get(DIRT_ID)?.color, MaterialSwatch.derivedColor("terrain/wet"));
  });
});
