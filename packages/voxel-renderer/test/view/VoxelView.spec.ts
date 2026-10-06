// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelDocument } from "../../src/document/VoxelDocument.ts";
import { VoxelView } from "../../src/view/VoxelView.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeLogger } from "../helpers/fakes.ts";
import { chunkMeshes } from "../helpers/view.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import {
  CHUNK_SIZE,
  CUBE_ID
} from "../helpers/ids.ts";

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
  view.loadBlockset(makeAtlasDef(), mockTexture());
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

describe("VoxelView - frame requests", () => {
  function makeCountingView() {
    const document = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      layers: ["Ground"],
      blocks: [makeBlockDef(CUBE_ID, "cube", { name: "Cube" })]
    });
    const counter = { frames: 0 };
    const view = new VoxelView(document, {
      requestFrame: () => {
        counter.frames++;
      }
    });
    view.loadBlockset(makeAtlasDef(), mockTexture());
    view.init();
    counter.frames = 0;

    return { document, view, counter };
  }

  it("requests a frame for a voxel edit and a world load", () => {
    const { document, counter } = makeCountingView();

    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    assert.ok(counter.frames > 0);

    counter.frames = 0;
    document.load(new VoxelDocument({ chunkSize: CHUNK_SIZE }).save());
    assert.ok(counter.frames > 0);
  });

  it("requests a frame when every chunk is marked dirty", () => {
    const { view, counter } = makeCountingView();

    view.markAllChunksDirty("test");

    assert.equal(counter.frames, 1);
  });
});

describe("VoxelView - document subscriptions", () => {
  it("marks the chunks holding a block dirty when its definition changes", () => {
    const { document, view } = makePair();
    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    view.flush();
    assert.equal(dirtyChunks(document), 0);

    document.defineBlock(makeBlockDef(CUBE_ID + 1, "cube", { name: "Bark" }));
    assert.equal(dirtyChunks(document), 0);

    document.defineBlock(makeBlockDef(CUBE_ID, "cube", { name: "Bark" }));
    assert.equal(dirtyChunks(document), 1);
  });

  it("syncs the atlases before a blockset command reaches other listeners", () => {
    const { document, view } = makePair();
    const seen: boolean[] = [];
    document.on("command", () => {
      seen.push(view.atlases.get("atlas") !== undefined);
    });

    document.removeBlockset("atlas");

    assert.deepEqual(seen, [false]);
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

  it("warns about a blockset the loaded world declares without a texture", () => {
    const warnings: string[] = [];
    const { document } = makePair(makeLogger(warnings));

    const source = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      blocksets: [makeAtlasDef({ id: "stone" })]
    });
    document.load(source.save());

    assert.equal(
      warnings.some((message) => message.includes("'stone' is not loaded")),
      true
    );
  });

  it("marks the chunks holding a block dirty when a remote peer removes it", () => {
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

  it("leaves the blockset declarations of the document when disposed", () => {
    const { document, view } = makePair();

    view.dispose();

    assert.ok(document.blocksets.has("atlas"));
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
      blocksets: [makeAtlasDef({ id: "stone" })]
    });
    source.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });

    view.load(source.save(), {
      blocksets: [{ def: makeAtlasDef({ id: "stone" }), texture: mockTexture() }]
    });

    assert.ok(view.atlases.get("stone"));
    assert.ok(chunkMeshes(view).length > 0);
  });

  it("does not replace the texture of an atlas it already holds", () => {
    const { view } = makePair();
    const loaded = view.atlases.get("atlas");

    view.load(view.document.save(), {
      blocksets: [{ def: makeAtlasDef(), texture: mockTexture() }]
    });

    assert.equal(view.atlases.get("atlas")?.texture, loaded?.texture);
  });
});

describe("VoxelView.loadBlockset", () => {
  it("declares the blockset on the document without emitting a command", () => {
    const { document, view } = makePair();
    const commands: string[] = [];
    document.on("command", (command) => commands.push(command.action));

    view.loadBlockset(makeAtlasDef({ id: "stone" }), mockTexture());

    assert.deepEqual(commands, []);
    assert.ok(document.blocksets.get("stone"));
    assert.ok(view.atlases.get("stone"));
  });
});
