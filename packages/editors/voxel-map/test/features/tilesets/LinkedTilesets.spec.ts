// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockRegistry,
  BlockShapeRegistry,
  composeBlockId,
  MaterialGroup,
  MaterialGroupList,
  TilesetDocument,
  TilesetList,
  TilesetManager,
  type ResolvedBlockDefinition,
  type TilesetDefinition,
  type TilesetTexture,
  type VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { TilesetRoom } from "@jolly-pixel/asset.voxel-map/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocument } from "../../../src/document/index.ts";
import {
  TilesetStore,
  type TilesetEntry
} from "../../../src/state/index.ts";
import { LinkedTilesets } from "../../../src/features/tilesets/LinkedTilesets.ts";
import type {
  OpenedTileset,
  TilesetSources
} from "../../../src/features/tilesets/TilesetSources.ts";

// CONSTANTS
const kTerrain: TilesetDefinition = {
  id: "terrain",
  slot: 1,
  asset: { id: "asset-terrain", kind: "tileset" }
};
const kRock: TilesetDefinition = {
  id: "rock",
  slot: 2,
  asset: { id: "asset-rock", kind: "tileset" }
};

if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = () => 0;
}

function entry(
  definition: TilesetDefinition
): TilesetEntry {
  return {
    definition,
    assetId: definition.asset?.id ?? null,
    label: definition.id
  };
}

function makePixels(): PixelDocument {
  const canvas = { width: 64, height: 64 };
  const fake = Object.assign(
    new Emitter<Record<string, (...args: unknown[]) => void>>(),
    {
      buffer: { canvas: () => canvas },
      size: () => {
        return { x: 64, y: 64 };
      },
      hasTransparency: () => false
    }
  );

  return fake as unknown as PixelDocument;
}

function makeEngine(): VoxelEngine {
  const tilesets = new TilesetList();
  const tilesetManager = new TilesetManager({ tilesets });
  const blockRegistry = new BlockRegistry();
  const materialGroups = new MaterialGroupList();
  const fake = {
    tilesets,
    tilesetManager,
    blockRegistry,
    materialGroups,
    shapeRegistry: BlockShapeRegistry.createDefault(),
    defineBlock: (def: ResolvedBlockDefinition) => {
      blockRegistry.register(def);
    },
    defineBlocks: (defs: Iterable<ResolvedBlockDefinition>) => {
      blockRegistry.registerMany(defs);
    },
    removeBlock: (id: number) => blockRegistry.unregister(id),
    moveBlock: (id: number, toIndex: number) => blockRegistry.moveTo(id, toIndex),
    defineMaterialGroup: (group: MaterialGroup) => materialGroups.define(group),
    removeMaterialGroup: (id: string) => materialGroups.remove(id),
    loadTileset: (def: TilesetDefinition, texture: TilesetTexture) => {
      tilesets.declare(def);
      tilesetManager.registerTexture(def.id, texture);
    },
    markAllChunksDirty: () => void 0
  };

  return fake as unknown as VoxelEngine;
}

class FakeSources implements TilesetSources {
  readonly opened = new Map<string, OpenedTileset>();
  readonly released: string[] = [];

  open(
    entry: TilesetEntry
  ): OpenedTileset | null {
    if (entry.assetId === null) {
      return null;
    }

    const tileset = new TilesetDocument({
      tileSize: 16,
      blocks: [
        {
          id: 1,
          name: "first",
          shapeId: "cube",
          defaultTexture: { col: 0, row: 0 }
        }
      ]
    });
    const opened: OpenedTileset = {
      pixels: makePixels(),
      tileset,
      room: {} as TilesetRoom,
      ready: Promise.resolve(),
      release: () => {
        this.released.push(entry.assetId ?? "");
      }
    };
    this.opened.set(entry.definition.id, opened);

    return opened;
  }
}

function setup(
  definitions: TilesetDefinition[] = [kTerrain]
) {
  const engine = makeEngine();
  const store = new TilesetStore();
  const sources = new FakeSources();
  const mapDocument = Object.assign(
    new Emitter<Record<string, () => void>>(),
    { ready: true }
  ) as unknown as MapDocument;
  const linked = new LinkedTilesets({
    engine,
    store,
    sources,
    mapDocument
  });
  store.replace(definitions.map(entry));

  return { engine, store, sources, linked };
}

describe("LinkedTilesets", () => {
  it("binds each linked tileset and projects its blocks into the engine", () => {
    const { engine, linked } = setup();

    assert.equal(linked.has("terrain"), true);
    assert.equal(linked.tileSizeOf("terrain"), 16);
    assert.deepEqual(engine.blockRegistry.get(composeBlockId(1, 1))?.defaultTexture, {
      col: 0,
      row: 0,
      tilesetId: "terrain"
    });
    assert.equal(engine.tilesets.get("terrain")?.tileSize, 16);
  });

  it("finds the owner of a world block id by its slot", () => {
    const { linked } = setup([kTerrain, kRock]);

    assert.equal(linked.ownerOf(composeBlockId(2, 7))?.definition.id, "rock");
    assert.equal(linked.ownerOf(composeBlockId(5, 1)), undefined);
    assert.equal(linked.nextBlockId("terrain"), composeBlockId(1, 2));
    assert.equal(linked.nextBlockId("missing"), undefined);
  });

  it("routes world-space block writes to the owning tileset in its own space", () => {
    const { engine, sources, linked } = setup([kTerrain, kRock]);
    const id = composeBlockId(2, 3);

    assert.equal(linked.defineBlock({
      id,
      name: "moss",
      shapeId: "cube",
      materialGroup: "rock/wet",
      defaultTexture: { col: 1, row: 1, tilesetId: "rock" }
    }), true);

    const local = sources.opened.get("rock")?.tileset.blocks.get(3);
    assert.deepEqual(local?.defaultTexture, { col: 1, row: 1 });
    assert.equal(local?.materialGroup, "wet");
    assert.equal(engine.blockRegistry.get(id)?.materialGroup, "rock/wet");
    assert.equal(sources.opened.get("terrain")?.tileset.blocks.has(3), false);

    assert.equal(linked.removeBlock(id), true);
    assert.equal(engine.blockRegistry.has(id), false);
    assert.equal(linked.defineBlock({ id: composeBlockId(9, 1), name: "x", shapeId: "cube" }), false);
  });

  it("routes material groups by their projected id", () => {
    const { engine, sources, linked } = setup([kTerrain, kRock]);

    assert.equal(linked.defineMaterialGroup(
      new MaterialGroup({ id: "rock/wet", roughness: 0.2 })
    ), true);
    assert.equal(sources.opened.get("rock")?.tileset.materialGroups.get("wet")?.roughness, 0.2);
    assert.equal(engine.materialGroups.get("rock/wet")?.roughness, 0.2);

    assert.equal(linked.removeMaterialGroup("rock/wet"), true);
    assert.equal(engine.materialGroups.has("rock/wet"), false);
    assert.equal(linked.defineMaterialGroup(new MaterialGroup({ id: "loose" })), false);
  });

  it("maps an engine position onto the tileset order when moving a block", () => {
    const { engine, sources, linked } = setup([kTerrain, kRock]);
    linked.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    linked.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    const engineIds = [...engine.blockRegistry].map((block) => block.id);
    assert.equal(linked.moveBlock(composeBlockId(2, 3), engineIds.indexOf(composeBlockId(2, 1))), true);

    assert.deepEqual(
      [...sources.opened.get("rock")!.tileset.blocks].map((block) => block.id),
      [3, 1, 2]
    );
  });

  it("moves a block down to the engine position it was dropped at", () => {
    const { engine, sources, linked } = setup([kRock]);
    linked.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    linked.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    assert.equal(linked.moveBlock(composeBlockId(2, 1), 2), true);
    assert.deepEqual(
      [...sources.opened.get("rock")!.tileset.blocks].map((block) => block.id),
      [2, 3, 1]
    );
    assert.equal(linked.moveBlock(composeBlockId(2, 2), 1), true);
    assert.deepEqual(
      [...engine.blockRegistry].map((block) => block.id),
      [composeBlockId(2, 3), composeBlockId(2, 2), composeBlockId(2, 1)]
    );
  });

  it("keeps the blocks of a tileset taking over the slot of an unlinked one", () => {
    const { engine, store, linked } = setup([kTerrain]);
    const replacement: TilesetDefinition = {
      id: "moss",
      slot: kTerrain.slot,
      asset: { id: "asset-moss", kind: "tileset" }
    };

    engine.tilesets.remove("terrain");
    store.replace([entry(replacement)]);

    assert.equal(linked.has("terrain"), false);
    assert.equal(linked.has("moss"), true);
    assert.equal(
      engine.blockRegistry.get(composeBlockId(1, 1))?.defaultTexture?.tilesetId,
      "moss"
    );
  });

  it("resizes the tiles of a linked tileset", () => {
    const { engine, linked } = setup();

    assert.equal(linked.resizeTiles("terrain", 32), true);
    assert.equal(linked.tileSizeOf("terrain"), 32);
    assert.equal(engine.blockRegistry.get(composeBlockId(1, 1))?.defaultTexture?.size, 16);
    assert.equal(linked.resizeTiles("missing", 32), false);
  });

  it("releases an unlinked tileset and takes its blocks out of the engine", () => {
    const { engine, store, sources, linked } = setup([kTerrain, kRock]);
    let changes = 0;
    linked.subscribe("change", () => {
      changes++;
    });

    store.replace([entry(kTerrain)]);

    assert.deepEqual(sources.released, ["asset-rock"]);
    assert.equal(engine.blockRegistry.has(composeBlockId(2, 1)), false);
    assert.equal(engine.blockRegistry.has(composeBlockId(1, 1)), true);
    assert.equal(linked.has("rock"), false);
    assert.equal(changes, 1);
  });
});
