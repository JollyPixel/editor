// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlocksetSlot,
  composeBlockId,
  MaterialGroup
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapMaterial } from "../../../src/features/materials/MapMaterial.ts";
import {
  MaterialShelves,
  type MaterialShelf
} from "../../../src/features/materials/MaterialShelves.ts";

// CONSTANTS
const kTerrain = new BlocksetSlot({ id: "terrain", slot: 1 });
const kRock = new BlocksetSlot({ id: "rock", slot: 2 });

function shelf(
  slot: BlocksetSlot,
  label: string,
  groups: MaterialGroup[],
  blockIds: number[] = []
): MaterialShelf {
  return {
    blocksetId: slot.id,
    label,
    slot,
    materials: groups.map((finish) => new MapMaterial({ slot, finish, blockIds }))
  };
}

describe("MaterialShelves", () => {
  it("lists one blockset's materials without a parent node", () => {
    const shelves = new MaterialShelves([
      shelf(kTerrain, "Terrain", [
        new MaterialGroup({ id: "terrain/gold", swatch: "#ffcc00", emissive: "#ff0000" })
      ], [composeBlockId(1, 1), composeBlockId(1, 2)])
    ]);

    const [gold] = shelves.toTreeNodes();

    assert.equal(gold.id, "terrain/gold");
    assert.equal(gold.label, "gold");
    assert.equal(gold.detail, "2");
    assert.equal(gold.renamable, true);
    assert.deepEqual(gold.swatch, {
      title: "Swatch: gold",
      color: "#ffcc00",
      ring: "#ff0000"
    });
  });

  it("groups materials under one node per blockset", () => {
    const shelves = new MaterialShelves([
      shelf(kTerrain, "Terrain", [new MaterialGroup({ id: "terrain/wet" })]),
      shelf(kRock, "Rock", [])
    ]);

    const nodes = shelves.toTreeNodes();

    assert.deepEqual(nodes.map((node) => node.label), ["Terrain", "Rock"]);
    assert.deepEqual(nodes[0].children?.map((node) => node.id), ["terrain/wet"]);
    assert.equal(nodes[0].children?.[0].detail, undefined);
    assert.equal(shelves.materialCount, 1);
  });

  it("finds a material and the shelf of a material or blockset node", () => {
    const shelves = new MaterialShelves([
      shelf(kTerrain, "Terrain", [new MaterialGroup({ id: "terrain/wet" })]),
      shelf(kRock, "Rock", [])
    ]);
    const rockNode = MaterialShelves.nodeIdOf("rock");

    assert.equal(shelves.material("terrain/wet")?.name, "wet");
    assert.equal(shelves.material(rockNode), undefined);
    assert.equal(shelves.shelfOf("terrain/wet")?.label, "Terrain");
    assert.equal(shelves.shelfOf(rockNode)?.label, "Rock");
    assert.equal(shelves.has("rock/missing"), false);
    assert.deepEqual([...shelves].map((entry) => entry.blocksetId), ["terrain", "rock"]);
  });
});
