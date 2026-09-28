// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import type {
  VoxelCommand,
  VoxelCommandOrigin
} from "../../src/document/commands/index.ts";
import {
  chunkMeshes,
  createView,
  faceCountOf,
  makeView,
  placeCube
} from "../helpers/view.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import { MISSING_TILESET_ID } from "../../src/document/tilesets/index.ts";
import {
  blockDefinedCmd,
  makeAddedCommand
} from "../helpers/networkCommands.ts";

interface Emission {
  action: string;
  origin: VoxelCommandOrigin;
}

function recordEmissions(
  view: VoxelView
): Emission[] {
  const emissions: Emission[] = [];
  view.document.on("command", (command, { origin }) => {
    emissions.push({ action: command.action, origin });
  });

  return emissions;
}

describe("VoxelView - construction", () => {
  it("creates the layers passed via options and no mesh until a tick", () => {
    const view = createView({ layers: ["Ground"] });

    assert.ok(view.document.world.getLayer("Ground"));
    assert.equal(chunkMeshes(view).length, 0);
  });

  it("subscribes the onCommand option before any command is applied", () => {
    const origins: VoxelCommandOrigin[] = [];
    const view = makeView({
      onCommand: (_command, { origin }) => origins.push(origin)
    });

    view.document.world.addLayer("Ground");

    assert.deepEqual(origins, ["local"]);
  });
});

describe("VoxelView - command origin", () => {
  it("tags a local world mutation as local", () => {
    const view = makeView();
    const emissions = recordEmissions(view);

    view.document.world.addLayer("Ground");

    assert.deepEqual(emissions, [{ action: "added", origin: "local" }]);
  });

  it("defaults apply() to a local origin", () => {
    const view = makeView();
    const emissions = recordEmissions(view);

    view.document.apply({ action: "tileset-added", tileset: { id: "b", src: "b", tileSize: 16 } });

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
      const view = makeView({ layers: ["Ground", "Top"] });
      const emissions = recordEmissions(view);

      assert.equal(view.document.apply(command, { origin: "remote" }), true);

      assert.deepEqual(emissions, [{ action: command.action, origin: "remote" }]);
    });
  }

  it("neither reports nor emits a remote layer command that changes nothing", () => {
    const view = makeView({ layers: ["Ground", "Top"] });
    const emissions = recordEmissions(view);

    assert.equal(view.document.apply({
      action: "reordered",
      layerName: "Ground",
      metadata: { direction: "down" }
    }, { origin: "remote" }), false);

    assert.deepEqual(emissions, []);
  });

  it("keeps tagging local mutations as local after a remote command", () => {
    const view = makeView({ layers: ["Ground"] });
    const emissions = recordEmissions(view);

    view.document.apply(makeAddedCommand("Remote"), { origin: "remote" });
    placeCube(view, "Ground", { x: 1, y: 0, z: 0 });

    assert.deepEqual(emissions.map(({ origin }) => origin), ["remote", "local"]);
  });

  it("dirties every chunk when a remote block definition lands", () => {
    const view = makeView({ layers: ["Ground"] });
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    view.tick(0);

    view.document.apply(kRemoteCommands[3], { origin: "remote" });

    assert.ok([...view.document.world.getAllChunks()].every(({ chunk }) => chunk.dirty));
  });
});

describe("VoxelView - tilesets", () => {
  it("declares the tilesets of a loaded document", () => {
    const view = makeView();
    const data = view.document.save();
    data.tilesets = [
      { id: "atlas", src: "/atlas.png", tileSize: 16 },
      { id: "later", src: "later-asset", tileSize: 32 }
    ];

    view.load(data);

    assert.deepEqual(view.document.tilesets.definitions().map((def) => def.id), ["atlas", "later"]);
    assert.ok(view.atlases.get("atlas"));
    assert.equal(view.atlases.get("later"), undefined);
  });

  it("saves declared tilesets", () => {
    const view = makeView();
    view.document.addTileset({ id: "later", src: "later-asset", tileSize: 32 });

    const data = view.document.save();

    assert.deepEqual(data.tilesets.map((def) => def.id), ["atlas", "later"]);
  });

  it("drops the atlas of a tileset missing from a loaded document", () => {
    const view = makeView();
    const data = view.document.save();
    data.tilesets = [];

    view.load(data);

    assert.equal(view.atlases.get("atlas"), undefined);
  });

  it("keeps the blocks defined before a world loads", () => {
    const view = makeView();
    view.document.defineBlock(makeBlockDef(9, "cube"));

    view.load(view.document.save());

    assert.equal(view.document.blocks.has(9), true);
  });

  it("fills the missing tileset of a defined block", () => {
    const view = makeView();
    view.document.defineBlock({
      id: 10,
      name: "new",
      shapeId: "cube",
      defaultTexture: [0, 0]
    });

    assert.equal(view.document.blocks.get(10)?.defaultTexture?.tilesetId, "atlas");
  });

  it("emits applied tileset commands only", () => {
    const view = makeView();
    const emissions = recordEmissions(view);

    assert.equal(view.document.addTileset({ id: "b", src: "b", tileSize: 16 }), true);
    assert.equal(view.document.addTileset({ id: "b", src: "b", tileSize: 16 }), false);
    assert.equal(view.document.removeTileset("b"), true);
    assert.equal(view.document.removeTileset("b"), false);

    assert.deepEqual(
      emissions.map(({ action }) => action),
      ["tileset-added", "tileset-removed"]
    );
  });

  it("rebuilds the atlas of a tileset loaded again with another tile size", () => {
    const view = makeView();
    const slot = view.document.tilesets.get("atlas")?.slot;

    view.loadTileset({ id: "atlas", src: "/atlas.png", tileSize: 32 }, mockTexture());

    assert.equal(view.document.tilesets.get("atlas")?.slot, slot);
    assert.equal(view.document.tilesets.get("atlas")?.tileSize, 32);
    assert.equal(view.atlases.atlas("atlas").def.tileSize, 32);
  });

  it("redraws the blocks of a removed tileset with the missing texture", () => {
    const view = makeView({ layers: ["Ground"] });
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    view.flush();
    assert.equal(chunkMeshes(view).length, 1);

    assert.equal(view.document.removeTileset("atlas"), true);
    view.flush();

    assert.equal(view.atlases.get("atlas"), undefined);
    const meshes = chunkMeshes(view);
    assert.equal(meshes.length, 1);
    assert.ok(meshes[0].name.includes(MISSING_TILESET_ID));
    assert.equal(faceCountOf(meshes[0]), 6);
  });

  it("keeps culling against a block drawn with the missing texture", () => {
    const view = makeView({ layers: ["Ground"] });
    view.loadTileset({ id: "b", src: "b", tileSize: 16 }, mockTexture());
    view.document.defineBlock(makeBlockDef(7, "cube", {
      defaultTexture: { col: 0, row: 0, tilesetId: "b" }
    }));
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(view, "Ground", { x: 1, y: 0, z: 0 }, 7);

    view.document.removeTileset("b");
    view.flush();

    assert.deepEqual(
      chunkMeshes(view)
        .map(faceCountOf)
        .sort(),
      [5, 5]
    );
  });

  it("stops culling against a block whose tileset has no texture yet", () => {
    const view = makeView({ layers: ["Ground"] });
    view.document.addTileset({ id: "later", src: "later", tileSize: 16 });
    view.document.defineBlock(makeBlockDef(7, "cube", {
      defaultTexture: { col: 0, row: 0, tilesetId: "later" }
    }));
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(view, "Ground", { x: 1, y: 0, z: 0 }, 7);

    view.flush();

    const meshes = chunkMeshes(view);
    assert.equal(meshes.length, 1);
    assert.equal(faceCountOf(meshes[0]), 6);
  });
});
