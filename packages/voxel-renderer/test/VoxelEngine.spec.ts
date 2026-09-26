// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import type {
  VoxelCommand,
  VoxelCommandOrigin
} from "../src/commands/index.ts";
import {
  chunkMeshes,
  makeEngine,
  placeCube
} from "./helpers/engine.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import { mockTexture } from "./helpers/mockTexture.ts";
import { MISSING_TILESET_ID } from "../src/tileset/index.ts";
import {
  blockDefinedCmd,
  makeAddedCommand
} from "./helpers/networkCommands.ts";

interface Emission {
  action: string;
  origin: VoxelCommandOrigin;
}

function recordEmissions(
  engine: VoxelEngine
): Emission[] {
  const emissions: Emission[] = [];
  engine.on("command", (command, { origin }) => {
    emissions.push({ action: command.action, origin });
  });

  return emissions;
}

describe("VoxelEngine - construction", () => {
  it("creates the layers passed via options and no mesh until a tick", () => {
    const engine = new VoxelEngine({ layers: ["Ground"] });

    assert.ok(engine.world.getLayer("Ground"));
    assert.equal(chunkMeshes(engine).length, 0);
  });

  it("subscribes the onCommand option before any command is applied", () => {
    const origins: VoxelCommandOrigin[] = [];
    const engine = makeEngine({
      onCommand: (_command, { origin }) => origins.push(origin)
    });

    engine.world.addLayer("Ground");

    assert.deepEqual(origins, ["local"]);
  });
});

describe("VoxelEngine - command origin", () => {
  it("tags a local world mutation as local", () => {
    const engine = makeEngine();
    const emissions = recordEmissions(engine);

    engine.world.addLayer("Ground");

    assert.deepEqual(emissions, [{ action: "added", origin: "local" }]);
  });

  it("defaults apply() to a local origin", () => {
    const engine = makeEngine();
    const emissions = recordEmissions(engine);

    engine.apply({ action: "tileset-added", tileset: { id: "b", src: "b", tileSize: 16 } });

    assert.deepEqual(emissions, [{ action: "tileset-added", origin: "local" }]);
  });

  const kRemoteCommands: VoxelCommand[] = [
    makeAddedCommand("Remote"),
    {
      action: "voxels-set",
      layerName: "Ground",
      metadata: { entries: [{ position: { x: 5, y: 0, z: 5 }, blockId: 1 }] }
    },
    {
      action: "reordered",
      layerName: "Ground",
      metadata: { direction: "up" }
    },
    blockDefinedCmd({ id: 4 })
  ];

  for (const command of kRemoteCommands) {
    it(`applies a remote '${command.action}' once, tagged remote`, () => {
      const engine = makeEngine({ layers: ["Ground", "Top"] });
      const emissions = recordEmissions(engine);

      assert.equal(engine.apply(command, { origin: "remote" }), true);

      assert.deepEqual(emissions, [{ action: command.action, origin: "remote" }]);
    });
  }

  it("neither reports nor emits a remote layer command that changes nothing", () => {
    const engine = makeEngine({ layers: ["Ground", "Top"] });
    const emissions = recordEmissions(engine);

    assert.equal(engine.apply({
      action: "reordered",
      layerName: "Ground",
      metadata: { direction: "down" }
    }, { origin: "remote" }), false);

    assert.deepEqual(emissions, []);
  });

  it("keeps tagging local mutations as local after a remote command", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    const emissions = recordEmissions(engine);

    engine.apply(makeAddedCommand("Remote"), { origin: "remote" });
    placeCube(engine, "Ground", { x: 1, y: 0, z: 0 });

    assert.deepEqual(emissions.map(({ origin }) => origin), ["remote", "local"]);
  });

  it("dirties every chunk when a remote block definition lands", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    engine.tick(0);

    engine.apply(kRemoteCommands[3], { origin: "remote" });

    assert.ok([...engine.world.getAllChunks()].every(({ chunk }) => chunk.dirty));
  });
});

describe("VoxelEngine - tilesets", () => {
  it("declares the tilesets of a loaded document", () => {
    const engine = makeEngine();
    const data = engine.save();
    data.tilesets = [
      { id: "atlas", src: "/atlas.png", tileSize: 16 },
      { id: "later", src: "later-asset", tileSize: 32 }
    ];

    engine.load(data);

    assert.deepEqual(engine.tilesets.definitions().map((def) => def.id), ["atlas", "later"]);
    assert.ok(engine.tilesetManager.get("atlas"));
    assert.equal(engine.tilesetManager.get("later"), undefined);
  });

  it("saves declared tilesets", () => {
    const engine = makeEngine();
    engine.addTileset({ id: "later", src: "later-asset", tileSize: 32 });

    const data = engine.save();

    assert.deepEqual(data.tilesets.map((def) => def.id), ["atlas", "later"]);
  });

  it("drops the atlas of a tileset missing from a loaded document", () => {
    const engine = makeEngine();
    const data = engine.save();
    data.tilesets = [];

    engine.load(data);

    assert.equal(engine.tilesetManager.get("atlas"), undefined);
  });

  it("keeps the blocks defined before a world loads", () => {
    const engine = makeEngine();
    engine.defineBlock(makeBlockDef(9, "cube"));

    engine.load(engine.save());

    assert.equal(engine.blockRegistry.has(9), true);
  });

  it("fills the missing tileset of a defined block", () => {
    const engine = makeEngine();
    engine.defineBlock({
      id: 10,
      name: "new",
      shapeId: "cube",
      defaultTexture: [0, 0]
    });

    assert.equal(engine.blockRegistry.get(10)?.defaultTexture?.tilesetId, "atlas");
  });

  it("emits applied tileset commands only", () => {
    const engine = makeEngine();
    const emissions = recordEmissions(engine);

    assert.equal(engine.addTileset({ id: "b", src: "b", tileSize: 16 }), true);
    assert.equal(engine.addTileset({ id: "b", src: "b", tileSize: 16 }), false);
    assert.equal(engine.removeTileset("b"), true);
    assert.equal(engine.removeTileset("b"), false);

    assert.deepEqual(
      emissions.map(({ action }) => action),
      ["tileset-added", "tileset-removed"]
    );
  });

  it("rebuilds the atlas of a tileset loaded again with another tile size", () => {
    const engine = makeEngine();
    const slot = engine.tilesets.get("atlas")?.slot;

    engine.loadTileset({ id: "atlas", src: "/atlas.png", tileSize: 32 }, mockTexture());

    assert.equal(engine.tilesets.get("atlas")?.slot, slot);
    assert.equal(engine.tilesets.get("atlas")?.tileSize, 32);
    assert.equal(engine.tilesetManager.atlas("atlas").def.tileSize, 32);
  });

  it("redraws the blocks of a removed tileset with the missing texture", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    engine.flush();
    assert.equal(chunkMeshes(engine).length, 1);

    assert.equal(engine.removeTileset("atlas"), true);
    engine.flush();

    assert.equal(engine.tilesetManager.get("atlas"), undefined);
    const meshes = chunkMeshes(engine);
    assert.equal(meshes.length, 1);
    assert.ok(meshes[0].name.includes(MISSING_TILESET_ID));
    assert.equal(
      meshes[0].geometry.getAttribute("position").count,
      6 * 4
    );
  });

  it("keeps culling against a block drawn with the missing texture", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    engine.loadTileset({ id: "b", src: "b", tileSize: 16 }, mockTexture());
    engine.defineBlock(makeBlockDef(7, "cube", {
      defaultTexture: { col: 0, row: 0, tilesetId: "b" }
    }));
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(engine, "Ground", { x: 1, y: 0, z: 0 }, 7);

    engine.removeTileset("b");
    engine.flush();

    assert.deepEqual(
      chunkMeshes(engine)
        .map((mesh) => mesh.geometry.getAttribute("position").count)
        .sort(),
      [5 * 4, 5 * 4]
    );
  });

  it("stops culling against a block whose tileset has no texture yet", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    engine.addTileset({ id: "later", src: "later", tileSize: 16 });
    engine.defineBlock(makeBlockDef(7, "cube", {
      defaultTexture: { col: 0, row: 0, tilesetId: "later" }
    }));
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(engine, "Ground", { x: 1, y: 0, z: 0 }, 7);

    engine.flush();

    const meshes = chunkMeshes(engine);
    assert.equal(meshes.length, 1);
    assert.equal(meshes[0].geometry.getAttribute("position").count, 6 * 4);
  });
});
