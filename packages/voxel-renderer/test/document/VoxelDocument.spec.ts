// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelDocument } from "../../src/document/VoxelDocument.ts";
import type {
  VoxelCommand,
  VoxelCommandOrigin
} from "../../src/commands.ts";
import type {
  VoxelInvalidation
} from "../../src/document/VoxelDocument.types.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";
import {
  CHUNK_SIZE,
  CUBE_ID,
  LEAVES_ID
} from "../helpers/ids.ts";

type Trace =
  | { event: "command"; action: string; origin: VoxelCommandOrigin; }
  | { event: "invalidated"; reason: VoxelInvalidation["reason"]; }
  | { event: "loaded"; };

function makeDocument(
  layers: string[] = ["Ground"]
): VoxelDocument {
  return new VoxelDocument({
    chunkSize: CHUNK_SIZE,
    layers,
    blocks: [makeBlockDef(CUBE_ID, "cube", { name: "Cube" })],
    tilesets: [makeAtlasDef()]
  });
}

function trace(
  document: VoxelDocument
): Trace[] {
  const events: Trace[] = [];
  document.on("command", (command, { origin }) => events.push({
    event: "command",
    action: command.action,
    origin
  }));
  document.on("invalidated", ({ reason }) => events.push({
    event: "invalidated",
    reason
  }));
  document.on("loaded", () => events.push({ event: "loaded" }));

  return events;
}

describe("VoxelDocument - block definitions", () => {
  it("invalidates before emitting, once for a whole batch", () => {
    const document = makeDocument();
    const events = trace(document);

    document.defineBlocks([
      makeBlockDef(LEAVES_ID, "cube", { name: "Leaves" }),
      makeBlockDef(LEAVES_ID + 1, "cube", { name: "Bark" })
    ]);

    assert.deepEqual(events, [
      { event: "invalidated", reason: "block-defined" },
      { event: "command", action: "block-defined", origin: "local" },
      { event: "command", action: "block-defined", origin: "local" }
    ]);
  });

  it("emits nothing for an empty batch", () => {
    const document = makeDocument();
    const events = trace(document);

    document.defineBlocks([]);

    assert.deepEqual(events, []);
  });

  it("stamps the default tileset on a definition that names none", () => {
    const document = makeDocument();

    document.defineBlock(makeBlockDef(LEAVES_ID, "cube", { name: "Leaves" }));

    const stored = document.blocks.get(LEAVES_ID);
    assert.equal(stored?.defaultTexture?.tilesetId, "atlas");
  });
});

describe("VoxelDocument.apply", () => {
  it("re-emits block-moved with the index the registry settled on", () => {
    const document = makeDocument();
    document.defineBlock(makeBlockDef(LEAVES_ID, "cube", { name: "Leaves" }));
    const commands: VoxelCommand[] = [];
    document.on("command", (command) => commands.push(command));

    document.moveBlock(LEAVES_ID, -5);

    assert.equal(document.blocks.indexOf(LEAVES_ID), 0);
    assert.deepEqual(commands, [
      {
        action: "block-moved",
        blockId: LEAVES_ID,
        toIndex: 0
      }
    ]);
  });

  it("carries a remote origin through to the command listeners", () => {
    const document = makeDocument();
    const events = trace(document);

    document.apply({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: CUBE_ID,
        rotation: 0,
        flipX: false,
        flipY: false,
        flipZ: false
      }
    }, { origin: "remote" });

    assert.deepEqual(events, [
      { event: "command", action: "voxel-set", origin: "remote" }
    ]);
  });

  it("invalidates on a tileset command and emits it afterwards", () => {
    const document = makeDocument();
    const events = trace(document);

    document.addTileset(makeAtlasDef({ id: "stone" }));

    assert.deepEqual(events, [
      { event: "invalidated", reason: "tileset-added" },
      { event: "command", action: "tileset-added", origin: "local" }
    ]);
  });

  it("emits nothing when the command is rejected", () => {
    const document = makeDocument();
    const events = trace(document);

    assert.equal(document.removeTileset("unknown"), false);
    assert.deepEqual(events, []);
  });
});

describe("VoxelDocument.registerTileset", () => {
  it("invalidates without emitting a command", () => {
    const document = makeDocument();
    const events = trace(document);

    assert.equal(document.registerTileset(makeAtlasDef({ id: "stone" })), true);
    assert.deepEqual(events, [
      { event: "invalidated", reason: "tileset-registered" }
    ]);
  });

  it("reports a definition it already holds", () => {
    const document = makeDocument();

    assert.equal(document.registerTileset(makeAtlasDef()), false);
  });
});

describe("VoxelDocument.load", () => {
  it("replays the world without emitting its commands, then announces it", () => {
    const source = makeDocument();
    source.world.setVoxel("Ground", {
      position: { x: 1, y: 0, z: 1 },
      blockId: CUBE_ID
    });

    const document = makeDocument([]);
    const events = trace(document);

    document.load(source.save());

    assert.deepEqual(events, [{ event: "loaded" }]);
    assert.equal(
      document.world.getVoxelAt({ x: 1, y: 0, z: 1 })?.blockId,
      CUBE_ID
    );
  });

  it("declares the extra tilesets after the snapshot replaced the list", () => {
    const source = makeDocument();
    const document = makeDocument([]);

    document.load(source.save(), {
      tilesets: [makeAtlasDef({ id: "stone" })]
    });

    assert.deepEqual(
      [...document.tilesets].map((def) => def.id).sort(),
      ["atlas", "stone"]
    );
  });

  it("drops the history of the world it replaced", () => {
    const document = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      layers: ["Ground"],
      blocks: [makeBlockDef(CUBE_ID, "cube", { name: "Cube" })],
      history: { enabled: true }
    });
    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    assert.equal(document.history.canUndo, true);

    document.load(document.save());

    assert.equal(document.history.canUndo, false);
  });
});
