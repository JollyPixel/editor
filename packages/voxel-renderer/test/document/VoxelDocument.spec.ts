// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelDocument } from "../../src/document/VoxelDocument.ts";
import type { VoxelCommand, VoxelCommandOrigin } from "../../src/document/commands/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";
import { recordCommands } from "../helpers/fakes.ts";
import {
  CHUNK_SIZE,
  CUBE_ID,
  LEAVES_ID
} from "../helpers/ids.ts";

type Trace =
  | { event: "command"; action: string; origin: VoxelCommandOrigin; }
  | { event: "loaded"; };

function makeDocument(
  layers: string[] = ["Ground"]
): VoxelDocument {
  return new VoxelDocument({
    chunkSize: CHUNK_SIZE,
    layers,
    blocks: [makeBlockDef(CUBE_ID, "cube", { name: "Cube" })],
    blocksets: [makeAtlasDef()]
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
  document.on("loaded", () => events.push({ event: "loaded" }));

  return events;
}

describe("VoxelDocument - block definitions", () => {
  it("emits the resolved definition of each block of a batch", () => {
    const document = makeDocument();
    const events = trace(document);
    const commands = recordCommands(document);

    document.defineBlocks([
      makeBlockDef(LEAVES_ID, "cube", { name: "Leaves" }),
      makeBlockDef(LEAVES_ID + 1, "cube", { name: "Bark" })
    ]);

    assert.deepEqual(events, [
      { event: "command", action: "block-defined", origin: "local" },
      { event: "command", action: "block-defined", origin: "local" }
    ]);
    assert.deepEqual(commands, [
      { action: "block-defined", block: document.blocks.get(LEAVES_ID) },
      { action: "block-defined", block: document.blocks.get(LEAVES_ID + 1) }
    ]);
  });

  it("emits nothing for an empty batch", () => {
    const document = makeDocument();
    const events = trace(document);

    document.defineBlocks([]);

    assert.deepEqual(events, []);
  });

  it("stamps the default blockset on a definition that names none", () => {
    const document = makeDocument();

    document.defineBlock(makeBlockDef(LEAVES_ID, "cube", { name: "Leaves" }));

    const stored = document.blocks.get(LEAVES_ID);
    assert.equal(stored?.defaultTexture?.blocksetId, "atlas");
  });
});

describe("VoxelDocument - block lookup by position", () => {
  it("joins a placed voxel to its definition and properties", () => {
    const document = makeDocument();
    document.defineBlock(
      makeBlockDef(LEAVES_ID, "cube", {
        name: "Leaves",
        properties: { hardness: 1, flammable: true }
      })
    );
    document.world.setVoxel("Ground", {
      position: { x: 1, y: 2, z: 3 },
      blockId: LEAVES_ID
    });

    assert.equal(document.blockAt({ x: 1, y: 2, z: 3 })?.name, "Leaves");
    assert.deepEqual(
      document.blockPropertiesAt({ x: 1, y: 2, z: 3 }),
      { hardness: 1, flammable: true }
    );
  });

  it("reports air and a voxel whose block was unregistered as absent", () => {
    const document = makeDocument();
    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: CUBE_ID
    });
    document.removeBlock(CUBE_ID);

    for (const position of [{ x: 9, y: 9, z: 9 }, { x: 0, y: 0, z: 0 }]) {
      assert.equal(document.blockAt(position), undefined);
      assert.equal(document.blockPropertiesAt(position), undefined);
    }
  });
});

describe("VoxelDocument.apply", () => {
  it("re-emits block-moved with the index the registry settled on", () => {
    const document = makeDocument();
    document.defineBlock(makeBlockDef(LEAVES_ID, "cube", { name: "Leaves" }));
    const commands: VoxelCommand[] = [];
    document.on("command", (command) => commands.push(command));

    document.moveBlock(LEAVES_ID, -5);

    assert.equal(document.blocks.findIndex(LEAVES_ID), 0);
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

    document.applyCommand({
      action: "voxel-set",
      layerId: document.world.getLayer("Ground")!.id,
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

  it("emits an applied blockset command", () => {
    const document = makeDocument();
    const events = trace(document);

    document.addBlockset(makeAtlasDef({ id: "stone" }));

    assert.deepEqual(events, [
      { event: "command", action: "blockset-added", origin: "local" }
    ]);
  });

  it("emits nothing when the command is rejected", () => {
    const document = makeDocument();
    const events = trace(document);

    assert.equal(document.addBlockset(makeAtlasDef()), false);
    assert.equal(document.removeBlockset("unknown"), false);
    assert.deepEqual(events, []);
  });
});
