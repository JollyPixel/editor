// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlocksetDocument,
  BlocksetLink,
  BlocksetSlot,
  composeBlockId,
  MaterialGroup,
  VoxelDocument,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapMaterials } from "../../../src/features/materials/MapMaterials.ts";

// CONSTANTS
const kTerrain = new BlocksetSlot({ id: "terrain", slot: 1 });
const kRock = new BlocksetSlot({ id: "rock", slot: 2 });
const kGrass = composeBlockId(1, 1);
const kDirt = composeBlockId(1, 2);
const kSand = composeBlockId(1, 3);
const kStone = composeBlockId(2, 1);

function block(
  id: number,
  materialGroup?: string
): BlockDefinition {
  return {
    id,
    name: `block-${id}`,
    shapeId: "cube",
    ...(materialGroup === undefined ? {} : { materialGroup })
  };
}

function blockOwner(
  links: BlocksetLink[],
  blockId: number
): BlocksetLink | undefined {
  return links.find((link) => link.slot.owns(blockId));
}

function groupOwner(
  links: BlocksetLink[],
  groupId: string
): BlocksetLink | undefined {
  return links.find((link) => link.slot.localGroupId(groupId) !== null);
}

function setup(
  blocks: BlockDefinition[],
  groups: MaterialGroup[] = []
) {
  const document = new VoxelDocument();
  const links = [kTerrain, kRock].map((slot) => new BlocksetLink({
    document,
    blockset: new BlocksetDocument(),
    slot
  }));
  for (const group of groups) {
    groupOwner(links, group.id)?.defineMaterialGroup(group.toJSON());
  }
  for (const definition of blocks) {
    blockOwner(links, definition.id)?.defineBlock(definition);
  }

  const materials = new MapMaterials({
    document,
    blocksets: {
      ownerOf: (blockId) => blockOwner(links, blockId),
      defineBlock: (definition) => blockOwner(links, definition.id)?.defineBlock(definition) ?? false,
      defineMaterialGroup: (group) => (
        groupOwner(links, group.id)?.defineMaterialGroup(group.toJSON()) ?? false
      ),
      removeMaterialGroup: (id) => groupOwner(links, id)?.removeMaterialGroup(id) ?? false,
      renameMaterialGroup: (id, to) => groupOwner(links, id)?.renameMaterialGroup(id, to) ?? false
    }
  });

  return { document, materials };
}

describe("MapMaterials", () => {
  it("lists the materials of the block's blockset, finished or used, by name", () => {
    const { materials } = setup(
      [
        block(kGrass, "terrain/wet"),
        block(kDirt, "terrain/wet"),
        block(kSand),
        block(kStone, "rock/wet")
      ],
      [
        new MaterialGroup({ id: "terrain/gold", metalness: 1 }),
        new MaterialGroup({ id: "rock/dull" })
      ]
    );

    const listed = materials.availableTo(kSand);

    assert.deepEqual(listed.map((material) => material.name), ["gold", "wet"]);
    assert.deepEqual(listed[0].blockIds, []);
    assert.equal(listed[0].finish.metalness, 1);
    assert.deepEqual(listed[1].blockIds, [kGrass, kDirt]);
    assert.ok(listed[1].finish.equals(new MaterialGroup({ id: "terrain/wet" })));
    assert.equal(materials.of(kGrass)?.id, "terrain/wet");
    assert.equal(materials.of(kSand), undefined);
    assert.deepEqual(materials.availableTo(composeBlockId(9, 1)), []);
  });

  it("creates a fresh finished material on the block", () => {
    const { document, materials } = setup([
      block(kGrass, "terrain/Material"),
      block(kDirt)
    ]);

    assert.equal(materials.create(kDirt), true);

    assert.equal(document.blocks.get(kDirt)?.materialGroup, "terrain/Material 2");
    assert.ok(document.materialGroups.get("terrain/Material 2")?.equals(
      new MaterialGroup({ id: "terrain/Material 2" })
    ));
  });

  it("assigns a material and drops it again, keeping the finish", () => {
    const { document, materials } = setup(
      [block(kGrass)],
      [new MaterialGroup({ id: "terrain/gold" })]
    );
    const [gold] = materials.availableTo(kGrass);

    assert.equal(materials.assign(kGrass, gold), true);
    assert.equal(materials.assign(kGrass, gold), false);
    assert.equal(document.blocks.get(kGrass)?.materialGroup, "terrain/gold");

    assert.equal(materials.assign(kGrass, null), true);
    assert.equal(document.blocks.get(kGrass)?.materialGroup, undefined);
    assert.deepEqual(materials.availableTo(kGrass).map((material) => material.id), ["terrain/gold"]);
  });

  it("refinishes one field and drops an out of range or unchanged value", () => {
    const { document, materials } = setup(
      [block(kGrass, "terrain/gold")],
      [new MaterialGroup({ id: "terrain/gold", roughness: 0.4 })]
    );
    const gold = materials.of(kGrass)!;

    assert.equal(materials.refinish(gold, { metalness: 1 }), true);
    assert.equal(materials.refinish(gold, { metalness: 1 }), false);
    assert.equal(materials.refinish(gold, { metalness: 2 }), false);
    assert.equal(materials.refinish(gold, { normalScale: -1 }), false);

    const finish = document.materialGroups.get("terrain/gold");
    assert.equal(finish?.metalness, 1);
    assert.equal(finish?.roughness, 0.4);
  });

  it("defines the finish of a material only its blocks named", () => {
    const { document, materials } = setup([block(kGrass, "terrain/wet")]);

    assert.equal(materials.refinish(materials.of(kGrass)!, { roughness: 0.2 }), true);

    assert.equal(document.materialGroups.get("terrain/wet")?.roughness, 0.2);
  });

  it("renames a material on every block using it and moves its finish", () => {
    const { document, materials } = setup(
      [
        block(kGrass, "terrain/wet"),
        block(kDirt, "terrain/wet"),
        block(kSand, "terrain/dry")
      ],
      [new MaterialGroup({ id: "terrain/wet", roughness: 0.2 })]
    );
    const wet = materials.of(kGrass)!;

    assert.equal(materials.rename(wet, "dry"), "taken");
    assert.equal(materials.rename(wet, "  "), "unchanged");
    assert.equal(materials.rename(wet, "wet"), "unchanged");
    assert.equal(materials.rename(wet, " soaked "), "renamed");

    assert.equal(document.blocks.get(kGrass)?.materialGroup, "terrain/soaked");
    assert.equal(document.blocks.get(kDirt)?.materialGroup, "terrain/soaked");
    assert.equal(document.blocks.get(kSand)?.materialGroup, "terrain/dry");
    assert.equal(document.materialGroups.has("terrain/wet"), false);
    assert.equal(document.materialGroups.get("terrain/soaked")?.roughness, 0.2);
  });

  it("removes a material from every block and drops its finish", () => {
    const { document, materials } = setup(
      [
        block(kGrass, "terrain/wet"),
        block(kDirt, "terrain/wet")
      ],
      [new MaterialGroup({ id: "terrain/wet" })]
    );

    materials.remove(materials.of(kGrass)!);

    assert.equal(document.blocks.get(kGrass)?.materialGroup, undefined);
    assert.equal(document.blocks.get(kDirt)?.materialGroup, undefined);
    assert.equal(document.materialGroups.size, 0);
    assert.deepEqual(materials.availableTo(kGrass), []);
  });

  it("gives blocks sharing a material the same swatch, glowing with its emissive", () => {
    const { materials } = setup(
      [
        block(kGrass, "terrain/wet"),
        block(kDirt, "terrain/wet"),
        block(kSand, "terrain/lava"),
        block(kStone)
      ],
      [
        new MaterialGroup({ id: "terrain/lava", emissive: "#ff6600" }),
        new MaterialGroup({ id: "terrain/wet", emissiveIntensity: 0, emissive: "#ffffff" })
      ]
    );

    const swatches = materials.swatches();

    assert.equal(swatches.has(kStone), false);
    assert.strictEqual(swatches.get(kGrass), swatches.get(kDirt));
    assert.notEqual(swatches.get(kGrass)?.color, swatches.get(kSand)?.color);
    assert.equal(swatches.get(kGrass)?.glow, null);
    assert.equal(swatches.get(kSand)?.glow, "#ff6600");
  });
});
