// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TilesetDocument,
  type TilesetDocumentJSON
} from "../../src/tileset/index.ts";
import type {
  TilesetDocumentCommand,
  VoxelCommandOrigin
} from "../../src/commands/index.ts";
import { resolveBlockDefinition } from "../../src/blocks/BlockDefinition.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

interface Emission {
  action: string;
  origin: VoxelCommandOrigin;
}

function recordEmissions(
  document: TilesetDocument
): Emission[] {
  const emissions: Emission[] = [];
  document.on("command", (command, { origin }) => {
    emissions.push({ action: command.action, origin });
  });

  return emissions;
}

describe("TilesetDocument", () => {
  it("starts with the default tile size and rejects an invalid one", () => {
    assert.equal(new TilesetDocument().tileSize, 32);
    assert.equal(new TilesetDocument({ tileSize: 8 }).tileSize, 8);
    assert.throws(() => new TilesetDocument({ tileSize: 0 }), RangeError);
  });

  it("strips the tileset id from the tiles of a defined block", () => {
    const document = new TilesetDocument();

    assert.equal(document.defineBlock(makeBlockDef(3, "cube", {
      faceTextures: { top: { tilesetId: "world", col: 1, row: 1 } },
      defaultTexture: { tilesetId: "world", col: 2, row: 0 }
    })), true);

    const block = document.blocks.get(3);
    assert.deepEqual(block?.defaultTexture, { col: 2, row: 0 });
    assert.deepEqual(block?.faceTextures, { top: { col: 1, row: 1 } });
  });

  it("removes and reorders blocks, emitting only applied commands", () => {
    const document = new TilesetDocument({
      blocks: [makeBlockDef(1, "cube"), makeBlockDef(2, "cube")]
    });
    const emissions = recordEmissions(document);

    assert.equal(document.moveBlock(2, 0), true);
    assert.equal(document.moveBlock(2, 0), false);
    assert.equal(document.removeBlock(1), true);
    assert.equal(document.removeBlock(1), false);

    assert.deepEqual([...document.blocks].map(({ id }) => id), [2]);
    assert.deepEqual(emissions, [
      { action: "block-moved", origin: "local" },
      { action: "block-removed", origin: "local" }
    ]);
  });

  it("defines and removes material groups", () => {
    const document = new TilesetDocument();

    assert.equal(document.defineMaterialGroup({ id: "gold", metalness: 1 }), true);
    assert.equal(document.defineMaterialGroup({ id: "gold", metalness: 1 }), false);
    assert.equal(document.materialGroups.get("gold")?.metalness, 1);
    assert.equal(document.removeMaterialGroup("gold"), true);
    assert.equal(document.materialGroups.size, 0);
  });

  it("rescales every block when the tile size changes", () => {
    const document = new TilesetDocument({
      tileSize: 16,
      blocks: [makeBlockDef(1, "cube", {
        defaultTexture: { col: 2, row: 2 }
      })]
    });
    const emissions = recordEmissions(document);

    assert.equal(document.resizeTiles(32), true);
    assert.equal(document.resizeTiles(32), false);
    assert.equal(document.resizeTiles(0), false);

    assert.equal(document.tileSize, 32);
    assert.deepEqual(document.blocks.get(1)?.defaultTexture, {
      col: 1,
      row: 1,
      size: 16
    });
    assert.deepEqual(emissions, [
      { action: "tile-size-updated", origin: "local" }
    ]);
  });

  it("applies a remote command under its origin", () => {
    const document = new TilesetDocument();
    const emissions = recordEmissions(document);
    const command: TilesetDocumentCommand = {
      action: "block-defined",
      block: {
        ...makeBlockDef(4, "cube"),
        faceTextures: {},
        collidable: true,
        properties: {},
        defaultTexture: { tilesetId: "peer", col: 0, row: 0 }
      }
    };

    assert.equal(document.apply(command, { origin: "remote" }), true);

    assert.deepEqual(document.blocks.get(4)?.defaultTexture, { col: 0, row: 0 });
    assert.deepEqual(emissions, [
      { action: "block-defined", origin: "remote" }
    ]);
  });

  it("round-trips through JSON", () => {
    const source = new TilesetDocument({
      tileSize: 8,
      blocks: [makeBlockDef(1, "cube"), makeBlockDef(2, "stair")],
      materialGroups: [{ id: "gold", metalness: 1 }]
    });
    source.moveBlock(2, 0);
    const json: TilesetDocumentJSON = JSON.parse(JSON.stringify(source.toJSON()));

    const restored = new TilesetDocument({
      blocks: [makeBlockDef(9, "cube")]
    });
    const loads: string[] = [];
    restored.on("loaded", () => loads.push("loaded"));
    restored.load(json);

    assert.deepEqual(restored.toJSON(), source.toJSON());
    assert.deepEqual([...restored.blocks].map(({ id }) => id), [2, 1]);
    assert.equal(restored.blocks.has(9), false);
    assert.deepEqual(loads, ["loaded"]);
  });

  it("rejects a document with an invalid tile size", () => {
    const document = new TilesetDocument();

    assert.throws(
      () => document.load({ tileSize: 0, blocks: [], materialGroups: [] }),
      RangeError
    );
  });

  it("rejects a block id outside the tileset-local range", () => {
    const document = new TilesetDocument();

    assert.throws(() => document.defineBlock(makeBlockDef(0x10000, "cube")), RangeError);
    assert.throws(
      () => new TilesetDocument({ blocks: [makeBlockDef(0, "cube")] }),
      RangeError
    );
    assert.equal(document.blocks.size, 0);
  });

  it("leaves itself untouched when a loaded block is invalid", () => {
    const document = new TilesetDocument({
      tileSize: 8,
      blocks: [makeBlockDef(1, "cube")]
    });

    assert.throws(
      () => document.load({
        tileSize: 16,
        blocks: [
          resolveBlockDefinition(makeBlockDef(2, "cube")),
          resolveBlockDefinition(makeBlockDef(0x10000, "cube"))
        ],
        materialGroups: []
      }),
      RangeError
    );
    assert.equal(document.tileSize, 8);
    assert.deepEqual([...document.blocks].map(({ id }) => id), [1]);
  });

  it("clears to an empty document", () => {
    const document = new TilesetDocument({
      tileSize: 8,
      blocks: [makeBlockDef(1, "cube")],
      materialGroups: [{ id: "gold" }]
    });

    document.clear();

    assert.deepEqual(document.toJSON(), {
      tileSize: 32,
      blocks: [],
      materialGroups: []
    });
  });
});
