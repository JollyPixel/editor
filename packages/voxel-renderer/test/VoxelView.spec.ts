// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelDocument } from "../src/VoxelDocument.ts";
import { VoxelView } from "../src/VoxelView.ts";
import { makeAtlasDef } from "./helpers/atlas.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import { makeLogger } from "./helpers/fakes.ts";
import { chunkMeshes } from "./helpers/engine.ts";
import { mockTexture } from "./helpers/mockTexture.ts";
import {
  CHUNK_SIZE,
  CUBE_ID
} from "./helpers/ids.ts";

interface Pair {
  document: VoxelDocument;
  view: VoxelView;
}

function makePair(
  logger = makeLogger()
): Pair {
  const document = new VoxelDocument({
    chunkSize: CHUNK_SIZE,
    layers: ["Ground"],
    blocks: [makeBlockDef(CUBE_ID, "cube", { name: "Cube" })]
  });
  const view = new VoxelView(document, { logger });
  view.loadTileset(makeAtlasDef(), mockTexture());
  view.init();

  return {
    document,
    view
  };
}

function dirtyChunks(
  document: VoxelDocument
): number {
  return [...document.world.getAllChunks()]
    .filter(({ chunk }) => chunk.dirty)
    .length;
}

describe("VoxelView - document subscriptions", () => {
  it("marks every chunk dirty when a block definition changes", () => {
    const { document, view } = makePair();
    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    view.flush();
    assert.equal(dirtyChunks(document), 0);

    document.defineBlock(makeBlockDef(CUBE_ID + 1, "cube", { name: "Bark" }));

    assert.equal(dirtyChunks(document), 1);
  });

  it("syncs the atlases before a tileset command reaches other listeners", () => {
    const { document, view } = makePair();
    const seen: boolean[] = [];
    document.on("command", () => {
      seen.push(view.tilesetManager.get("atlas") !== undefined);
    });

    document.removeTileset("atlas");

    assert.deepEqual(seen, [false]);
  });

  it("drops an atlas whose tileset the document removed", () => {
    const { document, view } = makePair();
    assert.ok(view.tilesetManager.get("atlas"));

    document.removeTileset("atlas");

    assert.equal(view.tilesetManager.get("atlas"), undefined);
  });

  it("rebuilds from scratch when the document loads a world", () => {
    const { document, view } = makePair();
    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    view.flush();
    assert.ok(chunkMeshes(view).length > 0);

    const empty = new VoxelDocument({ chunkSize: CHUNK_SIZE });
    document.load(empty.save());

    assert.equal(chunkMeshes(view).length, 0);
  });

  it("warns about a tileset the loaded world declares without a texture", () => {
    const warnings: string[] = [];
    const { document } = makePair(makeLogger(warnings));

    const source = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      tilesets: [makeAtlasDef({ id: "stone" })]
    });
    document.load(source.save());

    assert.equal(
      warnings.some((message) => message.includes("'stone' is not loaded")),
      true
    );
  });

  it("marks every chunk dirty when a remote peer removes a block", () => {
    const { document, view } = makePair();
    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    view.flush();

    document.apply(
      { action: "block-removed", blockId: CUBE_ID },
      { origin: "remote" }
    );

    assert.equal(dirtyChunks(document), 1);
  });

  it("leaves the tileset declarations of the document when disposed", () => {
    const { document, view } = makePair();

    view.dispose();

    assert.ok(document.tilesets.has("atlas"));
  });

  it("stops following the document once disposed", () => {
    const { document, view } = makePair();
    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    view.flush();

    view.dispose();
    document.defineBlock(makeBlockDef(CUBE_ID + 1, "cube", { name: "Bark" }));

    assert.equal(dirtyChunks(document), 0);
  });
});

describe("VoxelView.load", () => {
  it("registers the staged textures before the loaded world is meshed", () => {
    const { view } = makePair();
    const source = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      layers: ["Ground"],
      blocks: [makeBlockDef(CUBE_ID, "cube", { name: "Cube" })],
      tilesets: [makeAtlasDef({ id: "stone" })]
    });
    source.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });

    view.load(source.save(), {
      tilesets: [{ def: makeAtlasDef({ id: "stone" }), texture: mockTexture() }]
    });

    assert.ok(view.tilesetManager.get("stone"));
    assert.ok(chunkMeshes(view).length > 0);
  });

  it("does not replace the texture of an atlas it already holds", () => {
    const { view } = makePair();
    const loaded = view.tilesetManager.get("atlas");

    view.load(view.document.save(), {
      tilesets: [{ def: makeAtlasDef(), texture: mockTexture() }]
    });

    assert.equal(view.tilesetManager.get("atlas")?.texture, loaded?.texture);
  });
});

describe("VoxelView.loadTileset", () => {
  it("declares the tileset on the document without emitting a command", () => {
    const { document, view } = makePair();
    const commands: string[] = [];
    document.on("command", (command) => commands.push(command.action));

    view.loadTileset(makeAtlasDef({ id: "stone" }), mockTexture());

    assert.deepEqual(commands, []);
    assert.ok(document.tilesets.get("stone"));
    assert.ok(view.tilesetManager.get("stone"));
  });
});
