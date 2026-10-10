// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  composeBlockId,
  MaterialGroup
} from "@jolly-pixel/voxel.renderer";
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  MOSS_BLOCKSET,
  ROCK_BLOCKSET,
  TERRAIN_BLOCKSET,
  setupMapBlocksets
} from "../../helpers/mapBlocksets.ts";

describe("MapBlocksets", () => {
  it("binds each linked blockset and projects its blocks into the document", () => {
    const { view, blocksets } = setupMapBlocksets();

    assert.equal(blocksets.open("terrain") !== undefined, true);
    assert.equal(blocksets.tileSizeOf("terrain"), 16);
    assert.deepEqual(view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture, {
      col: 0,
      row: 0,
      blocksetId: "terrain"
    });
    assert.equal(view.document.blocksets.get("terrain")?.tileSize, 16);
  });

  it("finds the owner of a world block id by its slot", () => {
    const { blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);

    assert.equal(blocksets.ownerOf(composeBlockId(2, 7))?.definition.id, "rock");
    assert.equal(blocksets.ownerOf(composeBlockId(5, 1)), undefined);
    assert.equal(blocksets.nextBlockId("terrain"), composeBlockId(1, 2));
    assert.equal(blocksets.nextBlockId("missing"), undefined);
  });

  it("routes world-space block writes to the owning blockset in its own space", () => {
    const { view, sources, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);
    const id = composeBlockId(2, 3);

    assert.equal(blocksets.defineBlock({
      id,
      name: "moss",
      shapeId: "cube",
      materialGroup: "rock/wet",
      defaultTexture: { col: 1, row: 1, blocksetId: "rock" }
    }), true);

    const local = sources.opened.get("rock")?.blockset.blocks.get(3);
    assert.deepEqual(local?.defaultTexture, { col: 1, row: 1 });
    assert.equal(local?.materialGroup, "wet");
    assert.equal(view.document.blocks.get(id)?.materialGroup, "rock/wet");
    assert.equal(sources.opened.get("terrain")?.blockset.blocks.has(3), false);

    assert.equal(blocksets.removeBlock(id), true);
    assert.equal(view.document.blocks.has(id), false);
    assert.equal(blocksets.defineBlock({ id: composeBlockId(9, 1), name: "x", shapeId: "cube" }), false);
  });

  it("writes a block with the alpha mode its pixels need in a single command", async() => {
    const { view, sources, blocksets } = setupMapBlocksets();
    const opened = sources.opened.get("terrain")!;
    const id = composeBlockId(1, 1);
    await opened.ready;

    const actions: string[] = [];
    opened.blockset.on("command", (command) => actions.push(command.action));
    sources.transparent = true;
    blocksets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.deepEqual(actions, ["block-defined"]);
    assert.equal(opened.blockset.blocks.get(1)?.alphaMode, "mask");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");
  });

  it("keeps the alpha mode of a block written before its blockset loaded", () => {
    const { view, sources, blocksets } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    sources.transparent = true;

    blocksets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.equal(view.document.blocks.get(id)?.alphaMode, undefined);
  });

  it("syncs the alpha mode of the blocks a blockset repaint changed", async() => {
    const { view, sources, blocksets } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    await sources.opened.get("terrain")!.ready;

    sources.transparent = true;
    blocksets.syncAlphaModes("terrain");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    sources.transparent = false;
    blocksets.syncAlphaModes("terrain", { x: 32, y: 32, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    blocksets.syncAlphaModes("terrain", { x: 0, y: 0, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "opaque");
  });

  it("routes material groups by their projected id", () => {
    const { view, sources, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);

    assert.equal(blocksets.defineMaterialGroup(
      new MaterialGroup({ id: "rock/wet", roughness: 0.2 })
    ), true);
    assert.equal(sources.opened.get("rock")?.blockset.materialGroups.get("wet")?.roughness, 0.2);
    assert.equal(view.document.materialGroups.get("rock/wet")?.roughness, 0.2);

    assert.equal(blocksets.removeMaterialGroup("rock/wet"), true);
    assert.equal(view.document.materialGroups.has("rock/wet"), false);
    assert.equal(blocksets.defineMaterialGroup(new MaterialGroup({ id: "loose" })), false);
  });

  it("maps a document position onto the blockset order when moving a block", () => {
    const { view, sources, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);
    blocksets.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    blocksets.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    const engineIds = [...view.document.blocks].map((block) => block.id);
    assert.equal(blocksets.moveBlock(composeBlockId(2, 3), engineIds.indexOf(composeBlockId(2, 1))), true);

    assert.deepEqual(
      [...sources.opened.get("rock")!.blockset.blocks].map((block) => block.id),
      [3, 1, 2]
    );
  });

  it("moves a block down to the document position it was dropped at", () => {
    const { view, sources, blocksets } = setupMapBlocksets([ROCK_BLOCKSET]);
    blocksets.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    blocksets.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    assert.equal(blocksets.moveBlock(composeBlockId(2, 1), 2), true);
    assert.deepEqual(
      [...sources.opened.get("rock")!.blockset.blocks].map((block) => block.id),
      [2, 3, 1]
    );
    assert.equal(blocksets.moveBlock(composeBlockId(2, 2), 1), true);
    assert.deepEqual(
      [...view.document.blocks].map((block) => block.id),
      [composeBlockId(2, 3), composeBlockId(2, 2), composeBlockId(2, 1)]
    );
  });

  it("duplicates a block with its tiles right after the source", () => {
    const { view, sources, blocksets } = setupMapBlocksets([ROCK_BLOCKSET]);
    const source = composeBlockId(2, 2);
    blocksets.defineBlock({
      id: source,
      name: "b",
      shapeId: "cube",
      materialGroup: "rock/wet",
      defaultTexture: { col: 1, row: 1, blocksetId: "rock" },
      faceTextures: { top: { col: 2, row: 0, blocksetId: "rock" } }
    });
    blocksets.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    const id = blocksets.duplicateBlock(source);

    assert.equal(id, composeBlockId(2, 4));
    const copy = view.document.blocks.get(id!);
    const original = view.document.blocks.get(source)!;
    assert.equal(copy?.name, "b copy");
    assert.equal(copy?.materialGroup, "rock/wet");
    assert.deepEqual(copy?.defaultTexture, original.defaultTexture);
    assert.deepEqual(copy?.faceTextures, original.faceTextures);
    assert.deepEqual(
      [...sources.opened.get("rock")!.blockset.blocks].map((block) => block.id),
      [1, 2, 4, 3]
    );
  });

  it("duplicates nothing for a block no blockset owns", () => {
    const { view, blocksets } = setupMapBlocksets([ROCK_BLOCKSET]);
    const before = [...view.document.blocks].map((block) => block.id);

    assert.equal(blocksets.duplicateBlock(composeBlockId(2, 9)), null);
    assert.equal(blocksets.duplicateBlock(composeBlockId(5, 1)), null);
    assert.deepEqual([...view.document.blocks].map((block) => block.id), before);
  });

  it("keeps the blocks of a blockset taking over the slot of an unlinked one", () => {
    const { view, blocksets, relink } = setupMapBlocksets([TERRAIN_BLOCKSET]);

    relink([MOSS_BLOCKSET]);

    assert.equal(blocksets.open("terrain") !== undefined, false);
    assert.equal(blocksets.open("moss") !== undefined, true);
    assert.equal(
      view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture?.blocksetId,
      "moss"
    );
  });

  it("resizes the tiles of a linked blockset", () => {
    const { view, blocksets } = setupMapBlocksets();

    assert.equal(blocksets.resizeTiles("terrain", 32), true);
    assert.equal(blocksets.tileSizeOf("terrain"), 32);
    assert.equal(view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture?.size, 16);
    assert.equal(blocksets.resizeTiles("missing", 32), false);
  });

  it("releases an unlinked blockset and takes its blocks out of the document", () => {
    const { view, sources, blocksets, relink } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);
    let changes = 0;
    blocksets.subscribe("change", () => {
      changes++;
    });

    relink([TERRAIN_BLOCKSET]);

    assert.deepEqual(sources.released, ["asset-rock"]);
    assert.equal(view.document.blocks.has(composeBlockId(2, 1)), false);
    assert.equal(view.document.blocks.has(composeBlockId(1, 1)), true);
    assert.equal(blocksets.open("rock") !== undefined, false);
    assert.equal(changes, 1);
  });

  it("labels its entries from the catalog and relabels on a catalog change", () => {
    const { catalog, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET]);

    assert.deepEqual(
      blocksets.entries.map(({ assetId, label }) => [assetId, label]),
      [["asset-terrain", "terrain"]]
    );

    catalog.list = [
      {
        id: "asset-terrain",
        kind: "blockset",
        source: "blocksets/granite.blockset.json"
      } as AssetRecordData
    ];
    catalog.emit("change");

    assert.equal(blocksets.entries[0].label, "granite");
  });

  it("activates the first blockset and ignores an unknown one", () => {
    const { blocksets, relink } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);
    const changes: Array<string | null> = [];
    blocksets.subscribe("activeChange", (blocksetId) => changes.push(blocksetId));

    assert.equal(blocksets.activeBlocksetId, "terrain");

    blocksets.activeBlocksetId = "missing";
    blocksets.activeBlocksetId = "rock";
    relink([TERRAIN_BLOCKSET]);

    assert.deepEqual(changes, ["rock", "terrain"]);
  });

  it("links a catalog asset under a fresh blockset id", () => {
    const { view, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET]);

    assert.deepEqual(
      blocksets.linkableAssets().map((record) => record.id),
      ["asset-moss", "asset-rock"]
    );
    assert.equal(blocksets.link("asset-rock"), "generated-0");
    assert.equal(view.document.blocksets.get("generated-0")?.asset?.id, "asset-rock");
  });
});
