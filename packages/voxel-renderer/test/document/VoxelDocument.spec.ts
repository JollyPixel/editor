// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelDocument } from "../../src/document/VoxelDocument.ts";
import type {
  VoxelCommand,
  VoxelCommandOrigin
} from "../../src/document/commands/index.ts";
import type { BlockRedefinition } from "../../src/document/blocks/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";
import {
  makeLogger,
  recordCommands
} from "../helpers/fakes.ts";
import {
  blockDefinedCmd,
  makeAddedCommand
} from "../helpers/networkCommands.ts";
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

    document.apply({
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

      assert.equal(document.apply(command, { origin: "remote" }), true);

      assert.deepEqual(events, [
        { event: "command", action: command.action, origin: "remote" }
      ]);
    });
  }

  it("neither reports nor emits a remote layer command that changes nothing", () => {
    const document = makeDocument(["Ground", "Top"]);
    const events = trace(document);

    const ground = document.world.getLayer("Ground")!;
    assert.equal(document.apply({
      action: "layer-moved",
      layerId: ground.id,
      metadata: { rank: ground.rank }
    }, { origin: "remote" }), false);

    assert.deepEqual(events, []);
  });

  it("keeps tagging local mutations as local after a remote command", () => {
    const document = makeDocument();
    const events = trace(document);

    document.apply(makeAddedCommand("Remote"), { origin: "remote" });
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
    document.apply(blockDefinedCmd({ id: LEAVES_ID }), { origin: "remote" });

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
        normalScale: 1
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
      normalScale: 1
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

describe("VoxelDocument.load", () => {
  it("keeps the blocks defined before a world loads", () => {
    const document = makeDocument();
    document.defineBlock(makeBlockDef(9, "cube"));

    document.load(document.save());

    assert.equal(document.blocks.has(9), true);
  });

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

  it("declares the extra blocksets after the snapshot replaced the list", () => {
    const source = makeDocument();
    const document = makeDocument([]);

    document.load(source.save(), {
      blocksets: [makeAtlasDef({ id: "stone" })]
    });

    assert.deepEqual(
      [...document.blocksets].map((def) => def.id).sort(),
      ["atlas", "stone"]
    );
  });

  it("merges every layer except the ones it is told to keep", () => {
    const source = makeDocument(["Base", "Ground", "Water", "Top"]);
    const document = makeDocument([]);

    document.load(source.save(), {
      mergeLayers: { except: ["Water"] }
    });

    assert.deepEqual(
      document.world.getLayers().map((layer) => layer.name),
      ["Top", "Water", "Base"]
    );
  });

  it("warns about a kept layer the loaded world does not have", () => {
    const warnings: string[] = [];
    const document = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      logger: makeLogger(warnings)
    });

    document.load(makeDocument(["Base", "Top"]).save(), {
      mergeLayers: { except: ["Water"] }
    });

    assert.equal(document.world.getLayers().length, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /'Water'/);
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
