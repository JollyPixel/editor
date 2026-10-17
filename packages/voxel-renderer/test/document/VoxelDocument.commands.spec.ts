// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelDocument } from "../../src/document/VoxelDocument.ts";
import type { VoxelCommand, VoxelCommandOrigin } from "../../src/document/commands/index.ts";
import type { BlockRedefinition } from "../../src/document/blocks/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";
import { blockDefinedCmd, makeAddedCommand } from "../helpers/networkCommands.ts";
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

describe("VoxelDocument - command origin", () => {
  it("subscribes the onCommand option before any command is applied", () => {
    const origins: VoxelCommandOrigin[] = [];
    const document = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      onCommand: (_command, { origin }) => origins.push(origin)
    });

    document.world.addLayer("Ground");

    assert.deepEqual(origins, ["local"]);
  });

  it("tags a local world mutation as local", () => {
    const document = makeDocument([]);
    const events = trace(document);

    document.world.addLayer("Ground");

    assert.deepEqual(events, [
      { event: "command", action: "added", origin: "local" }
    ]);
  });

  it("defaults apply() to a local origin", () => {
    const document = makeDocument();
    const events = trace(document);

    document.applyCommand({
      action: "blockset-added",
      blockset: { id: "b", src: "b", tileSize: 16 }
    });

    assert.deepEqual(events, [
      { event: "command", action: "blockset-added", origin: "local" }
    ]);
  });

  const kRemoteCommands: [string, (document: VoxelDocument) => VoxelCommand][] = [
    ["added", () => makeAddedCommand("Remote")],
    ["voxels-set", (document) => {
      return {
        action: "voxels-set",
        layerId: document.world.getLayer("Ground")!.id,
        metadata: { entries: [{ position: { x: 5, y: 0, z: 5 }, blockId: 1 }] }
      };
    }],
    ["layer-moved", (document) => {
      return {
        action: "layer-moved",
        layerId: document.world.getLayer("Ground")!.id,
        metadata: { rank: "z" }
      };
    }],
    ["block-defined", () => blockDefinedCmd({ id: 4 })]
  ];

  for (const [action, commandOf] of kRemoteCommands) {
    it(`applies a remote '${action}' once, tagged remote`, () => {
      const document = makeDocument(["Ground", "Top"]);
      const events = trace(document);
      const command = commandOf(document);

      assert.equal(document.applyCommand(command, { origin: "remote" }), true);

      assert.deepEqual(events, [
        { event: "command", action: command.action, origin: "remote" }
      ]);
    });
  }

  it("neither reports nor emits a remote layer command that changes nothing", () => {
    const document = makeDocument(["Ground", "Top"]);
    const events = trace(document);

    const ground = document.world.getLayer("Ground")!;
    assert.equal(document.applyCommand({
      action: "layer-moved",
      layerId: ground.id,
      metadata: { rank: ground.rank }
    }, { origin: "remote" }), false);

    assert.deepEqual(events, []);
  });

  it("keeps tagging local mutations as local after a remote command", () => {
    const document = makeDocument();
    const events = trace(document);

    document.applyCommand(makeAddedCommand("Remote"), { origin: "remote" });
    document.world.setVoxel("Ground", {
      position: { x: 1, y: 0, z: 0 },
      blockId: CUBE_ID
    });

    assert.deepEqual(events, [
      { event: "command", action: "added", origin: "remote" },
      { event: "command", action: "voxel-set", origin: "local" }
    ]);
  });
});

describe("VoxelDocument - block redefinition", () => {
  it("tells what each block definition changed from the one it replaced", () => {
    const document = makeDocument();
    const redefinitions: Array<BlockRedefinition | undefined> = [];
    document.on("command", (_command, { redefinition }) => {
      redefinitions.push(redefinition);
    });

    document.defineBlock(makeBlockDef(LEAVES_ID, "cube"));
    document.defineBlock(makeBlockDef(LEAVES_ID, "cube", { name: "Leaves" }));
    document.defineBlock(makeBlockDef(LEAVES_ID, "cube", {
      name: "Leaves",
      defaultTexture: { col: 2, row: 0 }
    }));
    document.applyCommand(blockDefinedCmd({ id: LEAVES_ID }), { origin: "remote" });

    assert.deepEqual(redefinitions, ["added", "metadata", "tiles", "tiles"]);
  });

  it("leaves the redefinition out of other commands", () => {
    const document = makeDocument();
    const redefinitions: Array<BlockRedefinition | undefined> = [];
    document.on("command", (_command, { redefinition }) => {
      redefinitions.push(redefinition);
    });

    document.moveBlock(CUBE_ID, 0);
    document.addBlockset(makeAtlasDef({ id: "stone" }));

    assert.deepEqual(redefinitions, [undefined]);
  });
});

describe("VoxelDocument - material groups", () => {
  it("emits the normalized group", () => {
    const document = makeDocument();
    const emitted: VoxelCommand[] = [];
    document.on("command", (command) => emitted.push(command));
    const events = trace(document);

    assert.equal(document.defineMaterialGroup({ id: "gold", metalness: 1 }), true);

    assert.deepEqual(events, [
      { event: "command", action: "material-group-defined", origin: "local" }
    ]);
    assert.deepEqual(emitted, [{
      action: "material-group-defined",
      group: {
        id: "gold",
        roughness: 1,
        metalness: 1,
        emissive: "#000000",
        emissiveIntensity: 1,
        normalScale: 1,
        lightLevel: 0
      }
    }]);
  });

  it("rejects an invalid group without emitting", () => {
    const document = makeDocument();
    const events = trace(document);

    assert.equal(document.defineMaterialGroup({ id: "gold", metalness: 3 }), false);
    assert.equal(document.removeMaterialGroup("gold"), false);
    assert.deepEqual(events, []);
  });

  it("keeps the groups across a world save and load", () => {
    const document = makeDocument();
    document.defineMaterialGroup({ id: "gold", roughness: 0.3, metalness: 1 });
    const saved = document.save();

    document.load(saved);

    assert.equal("materialGroups" in saved, false);
    assert.deepEqual(document.materialGroups.toJSON(), [{
      id: "gold",
      roughness: 0.3,
      metalness: 1,
      emissive: "#000000",
      emissiveIntensity: 1,
      normalScale: 1,
      lightLevel: 0
    }]);
  });
});

describe("VoxelDocument.save", () => {
  it("saves declared blocksets", () => {
    const document = makeDocument();
    document.addBlockset({ id: "later", src: "later-asset", tileSize: 32 });

    const data = document.save();

    assert.deepEqual(data.blocksets.map((def) => def.id), ["atlas", "later"]);
  });
});
