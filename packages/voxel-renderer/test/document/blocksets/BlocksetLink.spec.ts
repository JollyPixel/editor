// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlocksetDocument,
  BlocksetLink,
  BlocksetSlot
} from "../../../src/document/blocksets/index.ts";
import { composeBlockId } from "../../../src/document/blocks/index.ts";
import { VoxelDocument } from "../../../src/document/VoxelDocument.ts";

function makeBlockset(): BlocksetDocument {
  return new BlocksetDocument({
    tileSize: 16,
    blocks: [
      {
        id: 1,
        name: "grass",
        shapeId: "cube",
        materialGroup: "soft",
        blendGroup: "meadow",
        defaultTexture: { col: 0, row: 0 }
      },
      {
        id: 2,
        name: "stone",
        shapeId: "cube",
        defaultTexture: { col: 1, row: 0 }
      }
    ],
    materialGroups: [{ id: "soft", roughness: 0.5 }],
    blendGroups: [{ id: "meadow", exclude: ["rock"] }]
  });
}

function link(
  slot: number,
  document = new VoxelDocument(),
  blockset = makeBlockset()
) {
  return {
    document,
    blockset,
    link: new BlocksetLink({
      document,
      blockset,
      slot: new BlocksetSlot({ id: "terrain", slot })
    })
  };
}

function ids(
  document: VoxelDocument
): number[] {
  return [...document.blocks].map((block) => block.id);
}

describe("BlocksetLink", () => {
  it("projects the blockset blocks and groups under its slot", () => {
    const { document } = link(2);

    const grass = document.blocks.get(composeBlockId(2, 1));
    assert.deepEqual(ids(document), [composeBlockId(2, 1), composeBlockId(2, 2)]);
    assert.deepEqual(grass?.defaultTexture, {
      col: 0,
      row: 0,
      blocksetId: "terrain"
    });
    assert.equal(grass?.materialGroup, "terrain/soft");
    assert.equal(document.materialGroups.get("terrain/soft")?.roughness, 0.5);
    assert.equal(grass?.blendGroup, "terrain/meadow");
    assert.deepEqual(
      document.blendGroups.get("terrain/meadow")?.exclude,
      ["terrain/rock"]
    );
  });

  it("mirrors block and group commands as the blockset changes", () => {
    const { document, blockset } = link(1);

    blockset.defineBlock({
      id: 3,
      name: "sand",
      shapeId: "cube",
      defaultTexture: { col: 2, row: 0 }
    });
    blockset.removeBlock(1);
    blockset.moveBlock(3, 0);
    blockset.defineMaterialGroup({ id: "hard", metalness: 1 });
    blockset.removeMaterialGroup("soft");
    blockset.defineBlendGroup({ id: "beach", width: 6 });
    blockset.removeBlendGroup("meadow");

    assert.deepEqual(ids(document), [composeBlockId(1, 3), composeBlockId(1, 2)]);
    assert.equal(document.materialGroups.has("terrain/soft"), false);
    assert.equal(document.materialGroups.get("terrain/hard")?.metalness, 1);
    assert.equal(document.blendGroups.has("terrain/meadow"), false);
    assert.equal(document.blendGroups.get("terrain/beach")?.width, 6);
  });

  it("re-projects rescaled tiles after a tile size change", () => {
    const { document, blockset } = link(0);

    blockset.resizeTiles(32);

    assert.deepEqual(document.blocks.get(2)?.defaultTexture, {
      col: 0.5,
      row: 0,
      size: 16,
      blocksetId: "terrain"
    });
  });

  it("leaves the blocks of other slots alone and unprojects on dispose", () => {
    const document = new VoxelDocument();
    document.defineBlock({
      id: composeBlockId(3, 1),
      name: "other",
      shapeId: "cube"
    });
    document.defineMaterialGroup({ id: "other/soft" });
    document.defineBlendGroup({ id: "other/meadow" });

    link(1, document).link.dispose();

    assert.deepEqual(ids(document), [composeBlockId(3, 1)]);
    assert.deepEqual([...document.materialGroups.ids()], ["other/soft"]);
    assert.deepEqual([...document.blendGroups].map(({ id }) => id), ["other/meadow"]);
  });

  it("writes world blocks back into the blockset in its own space", () => {
    const { document, blockset, link: terrain } = link(2);
    const id = composeBlockId(2, 3);

    assert.equal(terrain.nextBlockId, id);
    assert.equal(terrain.defineBlock({
      id,
      name: "moss",
      shapeId: "cube",
      materialGroup: "terrain/wet",
      defaultTexture: { col: 1, row: 1, blocksetId: "terrain" }
    }), true);

    const local = blockset.blocks.get(3);
    assert.deepEqual(local?.defaultTexture, { col: 1, row: 1 });
    assert.equal(local?.materialGroup, "wet");
    assert.equal(document.blocks.get(id)?.materialGroup, "terrain/wet");

    assert.equal(terrain.removeBlock(id), true);
    assert.equal(document.blocks.has(id), false);
  });

  it("writes world material groups back under their local id", () => {
    const { document, blockset, link: terrain } = link(2);

    assert.equal(terrain.defineMaterialGroup({
      id: "terrain/wet",
      roughness: 0.2
    }), true);
    assert.equal(blockset.materialGroups.get("wet")?.roughness, 0.2);
    assert.equal(document.materialGroups.get("terrain/wet")?.roughness, 0.2);

    assert.equal(terrain.removeMaterialGroup("terrain/wet"), true);
    assert.equal(document.materialGroups.has("terrain/wet"), false);
    assert.equal(terrain.removeMaterialGroup("other/wet"), false);
  });

  it("renames a world material group and re-projects its blocks", () => {
    const { document, blockset, link: terrain } = link(2);
    const grass = composeBlockId(2, 1);

    assert.equal(terrain.renameMaterialGroup("terrain/soft", "other/hard"), false);
    assert.equal(terrain.renameMaterialGroup("terrain/soft", "terrain/hard"), true);

    assert.equal(blockset.blocks.get(1)?.materialGroup, "hard");
    assert.equal(document.blocks.get(grass)?.materialGroup, "terrain/hard");
    assert.equal(document.materialGroups.get("terrain/hard")?.roughness, 0.5);
    assert.equal(document.materialGroups.has("terrain/soft"), false);
  });

  it("maps a world position onto the blockset order when moving a block", () => {
    const document = new VoxelDocument();
    const { blockset, link: rock } = link(2, document);
    new BlocksetLink({
      document,
      blockset: new BlocksetDocument({
        blocks: [{ id: 1, name: "a", shapeId: "cube" }]
      }),
      slot: new BlocksetSlot({ id: "base", slot: 1 })
    });
    rock.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    const worldIds = ids(document);
    assert.equal(
      rock.moveBlock(composeBlockId(2, 3), worldIds.indexOf(composeBlockId(2, 1))),
      true
    );
    assert.deepEqual([...blockset.blocks].map((block) => block.id), [3, 1, 2]);
  });

  it("moves a block down to the world position it was dropped at", () => {
    const { document, blockset, link: rock } = link(2);
    rock.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    assert.equal(rock.moveBlock(composeBlockId(2, 1), 2), true);
    assert.deepEqual([...blockset.blocks].map((block) => block.id), [2, 3, 1]);
    assert.equal(rock.moveBlock(composeBlockId(2, 2), 1), true);
    assert.deepEqual(ids(document), [
      composeBlockId(2, 3),
      composeBlockId(2, 2),
      composeBlockId(2, 1)
    ]);
  });
});
