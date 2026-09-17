// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import {
  isVoxelLayerCommand,
  type VoxelCommand,
  type VoxelCommandOrigin,
  type VoxelLayerCommand
} from "../src/commands.ts";
import {
  makeEngine as makeBaseEngine,
  CUBE_ID as kCubeId
} from "./helpers/engine.ts";

function makeEngine(
  onLocalLayerCommand?: (command: VoxelLayerCommand) => void
): VoxelEngine {
  return makeBaseEngine({
    onCommand: (command, { origin }) => {
      if (origin === "local" && isVoxelLayerCommand(command)) {
        onLocalLayerCommand?.(command);
      }
    }
  });
}

describe("VoxelEngine — construction", () => {
  it("creates layers passed via options", () => {
    const engine = new VoxelEngine({ layers: ["Ground"] });

    assert.ok(engine.world.getLayer("Ground"));
  });

  it("has an empty root Object3D group with no meshes until tick/init", () => {
    const engine = makeEngine();

    assert.equal(engine.root.children.length, 0);
  });
});

describe("VoxelEngine — command emission", () => {
  it("emits an 'added' event when a layer is added", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));

    engine.world.addLayer("Ground");

    assert.equal(events.length, 1);
    assert.equal(events[0].action, "added");
    assert.equal(events[0].layerName, "Ground");
  });

  it("emits a 'voxel-set' event when a voxel is placed", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");

    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    const last = events.at(-1)!;
    assert.equal(last.action, "voxel-set");
    assert.equal(last.layerName, "Ground");
  });

  it("emits a 'voxel-removed' event when a voxel is removed", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });

    const last = events.at(-1)!;
    assert.equal(last.action, "voxel-removed");
  });

  it("emits a 'reordered' event when a layer is moved", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("A");
    engine.world.addLayer("B");

    engine.world.moveLayer("B", "down");

    const last = events.at(-1)!;
    assert.equal(last.action, "reordered");
    assert.equal(last.layerName, "B");
  });

  it("emits nothing when a layer is already at the end of the order", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("A");
    engine.world.addLayer("B");

    engine.world.moveLayer("A", "down");

    assert.equal(events.at(-1)!.action, "added");
  });

  it("emits an 'object-added' event when an object is added to an object layer", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addObjectLayer("Objects");

    engine.world.addObjectToLayer("Objects", { id: "o1", name: "Thing", x: 0, y: 0, z: 0, visible: true });

    const last = events.at(-1)!;
    assert.equal(last.action, "object-added");
    assert.equal(last.layerName, "Objects");
  });
});

describe("VoxelEngine — layer/voxel mutation delegation", () => {
  it("setVoxel/getVoxel round-trip through world", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");

    engine.world.setVoxel("Ground", { position: { x: 1, y: 2, z: 3 }, blockId: kCubeId });

    const entry = engine.world.getLayer("Ground")!.getVoxelAt({ x: 1, y: 2, z: 3 });
    assert.equal(entry?.blockId, kCubeId);
  });

  it("setVoxelBulk places every entry and fires a single 'voxels-set' event", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");

    engine.world.setVoxelBulk("Ground", [
      { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId },
      { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId }
    ]);

    assert.equal(engine.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, kCubeId);
    assert.equal(engine.world.getLayer("Ground")!.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, kCubeId);
    const last = events.at(-1)!;
    assert.equal(last.action, "voxels-set");
  });

  it("removeLayer removes it from the world", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");

    const result = engine.world.removeLayer("Ground");

    assert.equal(result, true);
    assert.equal(engine.world.getLayer("Ground"), undefined);
  });
});

describe("VoxelEngine — remote apply", () => {
  it("emits a remote command once, tagged with its origin", () => {
    const received: { action: string; origin: VoxelCommandOrigin; }[] = [];
    const engine = makeBaseEngine({
      onCommand: (command, { origin }) => received.push({
        action: command.action,
        origin
      })
    });

    const applied = engine.apply({
      action: "added",
      layerName: "Remote",
      metadata: { options: {} }
    }, { origin: "remote" });

    assert.equal(applied, true);
    assert.deepEqual(received, [{ action: "added", origin: "remote" }]);
  });

  it("defaults to a local origin", () => {
    const origins: VoxelCommandOrigin[] = [];
    const engine = makeBaseEngine({
      onCommand: (_command, { origin }) => origins.push(origin)
    });

    engine.apply({ action: "tileset-added", tileset: { id: "b", src: "b", tileSize: 16 } });

    assert.deepEqual(origins, ["local"]);
  });

  it("applies a voxel-set command to the world without a local emission", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");
    events.length = 0;

    engine.apply({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 5, y: 0, z: 5 },
        blockId: kCubeId,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    }, { origin: "remote" });

    assert.equal(engine.world.getLayer("Ground")!.getVoxelAt({ x: 5, y: 0, z: 5 })?.blockId, kCubeId);
    assert.equal(events.length, 0);
  });

  it("applies an 'added' command without a local emission", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));

    engine.apply({
      action: "added",
      layerName: "Remote",
      metadata: { options: {} }
    }, { origin: "remote" });

    assert.ok(engine.world.getLayer("Remote"));
    assert.equal(events.length, 0);
  });

  it("applies a 'reordered' command without a local emission", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("A");
    engine.world.addLayer("B");
    events.length = 0;

    engine.apply({
      action: "reordered",
      layerName: "A",
      metadata: { direction: "up" }
    }, { origin: "remote" });

    assert.equal(events.length, 0);
  });

  it("still applies local mutations normally after a remote command", () => {
    const events: VoxelLayerCommand[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");
    events.length = 0;

    engine.apply({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: kCubeId,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    }, { origin: "remote" });
    assert.equal(events.length, 0);

    engine.world.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId });
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "voxel-set");
  });
});

describe("VoxelEngine — tilesets", () => {
  it("declares the tilesets of a loaded document", () => {
    const engine = makeEngine();
    const data = engine.save();
    data.tilesets = [
      { id: "atlas", src: "/atlas.png", tileSize: 16 },
      { id: "later", src: "later-asset", tileSize: 32 }
    ];
    data.defaultTileSize = 64;

    engine.load(data);

    assert.deepEqual(engine.tilesets.definitions().map((def) => def.id), ["atlas", "later"]);
    assert.equal(engine.defaultTileSize, 64);
    assert.equal(engine.tilesetManager.has("atlas"), true);
    assert.equal(engine.tilesetManager.has("later"), false);
  });

  it("saves declared tilesets and the default tile size", () => {
    const engine = makeEngine();
    engine.addTileset({ id: "later", src: "later-asset", tileSize: 32 });
    engine.defaultTileSize = 8;

    const data = engine.save();

    assert.deepEqual(data.tilesets.map((def) => def.id), ["atlas", "later"]);
    assert.equal(data.defaultTileSize, 8);
  });

  it("drops the atlas of a tileset missing from a loaded document", () => {
    const engine = makeEngine();
    const data = engine.save();
    data.tilesets = [];

    engine.load(data);

    assert.equal(engine.tilesetManager.has("atlas"), false);
  });

  it("fills the missing tileset of loaded and defined blocks", () => {
    const engine = makeEngine();
    const data = engine.save();
    data.blocks = [{
      id: 9,
      name: "old",
      shapeId: "cube",
      faceTextures: {},
      defaultTexture: { col: 1, row: 0 },
      collidable: true,
      properties: {}
    }];

    engine.load(data);
    engine.defineBlock({
      id: 10,
      name: "new",
      shapeId: "cube",
      defaultTexture: [0, 0]
    });

    assert.equal(engine.blockRegistry.get(9)?.defaultTexture?.tilesetId, "atlas");
    assert.equal(engine.blockRegistry.get(10)?.defaultTexture?.tilesetId, "atlas");
  });

  it("emits applied tileset commands only", () => {
    const events: VoxelCommand[] = [];
    const engine = makeBaseEngine({
      onCommand: (command) => events.push(command)
    });

    assert.equal(engine.addTileset({ id: "b", src: "b", tileSize: 16 }), true);
    assert.equal(engine.addTileset({ id: "b", src: "b", tileSize: 16 }), false);
    assert.equal(engine.resizeTileset("b", 16), false);
    assert.equal(engine.removeTileset("b"), true);
    assert.equal(engine.removeTileset("b"), false);

    assert.deepEqual(events.map((event) => event.action), [
      "tileset-added",
      "tileset-removed"
    ]);
  });

  it("rescales block tiles and rebuilds the atlas on resize", () => {
    const engine = makeEngine();
    engine.defineBlock({
      id: 5,
      name: "tile",
      shapeId: "cube",
      defaultTexture: { tilesetId: "atlas", col: 2, row: 1 }
    });

    assert.equal(engine.resizeTileset("atlas", 32), true);

    assert.deepEqual(engine.blockRegistry.get(5)?.defaultTexture, {
      tilesetId: "atlas",
      col: 1,
      row: 0.5,
      size: 16
    });
    assert.equal(engine.tilesetManager.atlas("atlas").def.tileSize, 32);
  });

  it("drops the chunk meshes textured by a removed tileset", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: kCubeId
    });
    engine.flush();
    assert.ok(engine.root.children.length > 0);

    assert.equal(engine.removeTileset("atlas"), true);
    engine.flush();

    assert.equal(engine.tilesetManager.has("atlas"), false);
    assert.equal(engine.root.children.length, 0);
  });
});
