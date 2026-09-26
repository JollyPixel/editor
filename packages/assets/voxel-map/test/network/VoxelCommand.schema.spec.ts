// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { voxelCommandProtocol } from "#src/network/VoxelCommand.schema.ts";
import {
  voxelSetCmd,
  worldReplaceCmd
} from "../helpers/networkCommands.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

function accepts(
  payload: unknown
): boolean {
  return new MessageParser(voxelCommandProtocol).parse(payload).ok;
}

function layerCommand(
  action: string,
  metadata: unknown
): unknown {
  return {
    ...kHeader,
    action,
    layerName: "Ground",
    metadata
  };
}

describe("voxelCommandProtocol", () => {
  test("parses a command to its action", () => {
    const parsed = new MessageParser(voxelCommandProtocol).parse(voxelSetCmd());

    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.val.event, "voxel-set");
  });

  test("rejects a payload that is not a voxel command", () => {
    assert.strictEqual(accepts({ not: "a command" }), false);
    assert.strictEqual(accepts({ ...voxelSetCmd(), clientId: 42 }), false);
  });

  test("accepts a world replacement", () => {
    assert.strictEqual(accepts(worldReplaceCmd()), true);
  });

  test("rejects block and material group commands, which belong to tilesets", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "block-defined",
      block: { id: 1 }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "block-moved",
      blockId: 1,
      toIndex: 0
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-defined",
      group: { id: "gold" }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-resized",
      tilesetId: "stone",
      tileSize: 64
    }), false);
  });

  test("accepts tileset links and removals", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", src: "asset-stone", tileSize: 32 }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", slot: 3, src: "asset-stone", tileSize: 32 }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-removed",
      tilesetId: "stone"
    }), true);
  });

  test("rejects an invalid tile size, slot or tileset id", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", src: "asset-stone", tileSize: 0 }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", src: "asset-stone", tileSize: 8192 }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "", src: "asset-stone", tileSize: 16 }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", slot: 128, src: "asset-stone", tileSize: 16 }
    }), false);
  });

  test("an asset tileset needs no tile size, a URL tileset does", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: {
        id: "stone",
        asset: { id: "asset-stone", kind: "tileset" }
      }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", src: "asset-stone" }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", tileSize: 32 }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tileset-added",
      tileset: {
        id: "stone",
        asset: { id: "asset-stone" }
      }
    }), false);
  });

  test("rejects a voxel-set missing its transform", () => {
    assert.strictEqual(accepts(layerCommand("voxel-set", {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    })), false);
  });

  test("accepts bulk entries whose transform is optional", () => {
    assert.strictEqual(accepts(layerCommand("voxels-set", {
      entries: [
        { position: { x: 0, y: 0, z: 0 }, blockId: 1 },
        { position: { x: 1, y: 0, z: 0 }, blockId: 1, rotation: 1 }
      ]
    })), true);
    assert.strictEqual(accepts(layerCommand("voxels-removed", {
      entries: [{ position: { x: 0, y: 0 } }]
    })), false);
  });

  test("accepts a patch made of integer cells only", () => {
    assert.strictEqual(accepts(layerCommand("voxels-patched", {
      cells: [0, 0, 0, 1, 0, -4, 2, 8, 0, 0]
    })), true);
    assert.strictEqual(accepts(layerCommand("voxels-patched", {
      cells: [0, 0, 0.5, 1, 0]
    })), false);
    assert.strictEqual(accepts(layerCommand("voxels-patched", {})), false);
  });

  test("accepts a position update carrying a position or a delta", () => {
    const delta = { x: 1, y: 0, z: 0 };

    assert.strictEqual(accepts(layerCommand("position-updated", { delta })), true);
    assert.strictEqual(accepts(layerCommand("position-updated", { position: delta })), true);
    assert.strictEqual(accepts(layerCommand("position-updated", {})), false);
  });

  test("rejects an object missing required fields", () => {
    assert.strictEqual(accepts(layerCommand("object-added", {
      object: { id: "o1", name: "spawn", x: 0, y: 0, z: 0, visible: true }
    })), true);
    assert.strictEqual(accepts(layerCommand("object-added", {
      object: { id: "o1" }
    })), false);
  });

  test("rejects an unknown reorder direction", () => {
    assert.strictEqual(accepts(layerCommand("reordered", { direction: "left" })), false);
  });

  test("rejects a world-replace with the wrong version", () => {
    const command = worldReplaceCmd();

    assert.strictEqual(accepts({
      ...command,
      data: {
        ...(command as { data: object; }).data,
        version: 1
      }
    }), false);
  });
});
