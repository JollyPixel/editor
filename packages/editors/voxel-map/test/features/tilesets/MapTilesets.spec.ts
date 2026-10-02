// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlendGroupList,
  BlockRegistry,
  BlockShapeRegistry,
  composeBlockId,
  MaterialGroup,
  MaterialGroupList,
  TilesetDocument,
  TilesetList,
  TilesetAtlases,
  type BlendGroupJSON,
  type ResolvedBlockDefinition,
  type TilesetDefinition,
  type TilesetTexture,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { TilesetRoom } from "@jolly-pixel/asset.voxel-map/client";
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { MapDocument } from "../../../src/document/index.ts";
import {
  MapTilesets,
  type TilesetCatalog
} from "../../../src/features/tilesets/MapTilesets.ts";
import type { OpenedTileset } from "../../../src/features/tilesets/TilesetBinding.ts";

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
const kMoss: TilesetDefinition = {
  id: "moss",
  slot: 1,
  asset: { id: "asset-moss", kind: "tileset" }
};

if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = () => 0;
}

function makePixels(
  transparent: () => boolean
): PixelDocument {
  const canvas = { width: 64, height: 64 };
  const fake = Object.assign(
    new Emitter<Record<string, (...args: unknown[]) => void>>(),
    {
      buffer: { canvas: () => canvas },
      size: () => {
        return { x: 64, y: 64 };
      },
      hasTransparency: transparent
    }
  );

  return fake as unknown as PixelDocument;
}

function makeView(): VoxelView {
  const tilesets = new TilesetList();
  const atlases = new TilesetAtlases({ tilesets });
  const blockRegistry = new BlockRegistry();
  const materialGroups = new MaterialGroupList();
  const blendGroups = new BlendGroupList();
  const fake = {
    document: {
      tilesets,
      blocks: blockRegistry,
      materialGroups,
      blendGroups,
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
      defineBlendGroup: (group: BlendGroupJSON) => blendGroups.define(group),
      removeBlendGroup: (id: string) => blendGroups.remove(id),
      addTileset: (def: TilesetDefinition) => {
        tilesets.declare(def);

        return true;
      }
    },
    atlases,
    shapes: BlockShapeRegistry.createDefault(),
    loadTileset: (def: TilesetDefinition, texture: TilesetTexture) => {
      tilesets.declare(def);
      atlases.registerTexture(def.id, texture);
    },
    markAllChunksDirty: () => void 0,
    requestFrame: () => void 0
  };

  return fake as unknown as VoxelView;
}

class FakeSources {
  readonly opened = new Map<string, OpenedTileset>();
  readonly released: string[] = [];
  transparent = false;

  open(
    assetId: string
  ): OpenedTileset {
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
      pixels: makePixels(() => this.transparent),
      tileset,
      room: {} as TilesetRoom,
      ready: Promise.resolve(),
      release: () => {
        this.released.push(assetId);
      }
    };
    this.opened.set(assetId.replace("asset-", ""), opened);

    return opened;
  }
}

class FakeCatalog extends Emitter<{ change: () => void; }> implements TilesetCatalog {
  list: AssetRecordData[] = [];

  records(): Iterable<AssetRecordData> {
    return this.list;
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.list.find((record) => record.id === assetId);
  }

  create(): Promise<string> {
    return Promise.resolve("asset-created");
  }

  rename(): Promise<void> {
    return Promise.resolve();
  }
}

function tilesetRecord(
  assetId: string
): AssetRecordData {
  return {
    id: assetId,
    kind: "tileset",
    source: `tilesets/${assetId.replace("asset-", "")}.tileset.json`
  } as AssetRecordData;
}

function setup(
  definitions: TilesetDefinition[] = [kTerrain]
) {
  const view = makeView();
  const sources = new FakeSources();
  const catalog = new FakeCatalog();
  catalog.list = [kTerrain, kRock, kMoss].map(
    (definition) => tilesetRecord(definition.asset!.id)
  );
  const mapDocument = Object.assign(
    new Emitter<Record<string, () => void>>(),
    { ready: true }
  ) as unknown as MapDocument;
  view.document.tilesets.replace(definitions);
  let nextId = 0;
  const tilesets = new MapTilesets({
    view,
    catalog,
    mapDocument,
    open: (assetId) => sources.open(assetId),
    generateId: () => `generated-${nextId++}`
  });

  function relink(
    next: TilesetDefinition[]
  ): void {
    view.document.tilesets.replace(next);
    mapDocument.emit("tilesetsChanged");
  }

  return { view, catalog, sources, tilesets, relink };
}

describe("MapTilesets", () => {
  it("binds each linked tileset and projects its blocks into the document", () => {
    const { view, tilesets } = setup();

    assert.equal(tilesets.open("terrain") !== undefined, true);
    assert.equal(tilesets.tileSizeOf("terrain"), 16);
    assert.deepEqual(view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture, {
      col: 0,
      row: 0,
      tilesetId: "terrain"
    });
    assert.equal(view.document.tilesets.get("terrain")?.tileSize, 16);
  });

  it("finds the owner of a world block id by its slot", () => {
    const { tilesets } = setup([kTerrain, kRock]);

    assert.equal(tilesets.ownerOf(composeBlockId(2, 7))?.definition.id, "rock");
    assert.equal(tilesets.ownerOf(composeBlockId(5, 1)), undefined);
    assert.equal(tilesets.nextBlockId("terrain"), composeBlockId(1, 2));
    assert.equal(tilesets.nextBlockId("missing"), undefined);
  });

  it("routes world-space block writes to the owning tileset in its own space", () => {
    const { view, sources, tilesets } = setup([kTerrain, kRock]);
    const id = composeBlockId(2, 3);

    assert.equal(tilesets.defineBlock({
      id,
      name: "moss",
      shapeId: "cube",
      materialGroup: "rock/wet",
      defaultTexture: { col: 1, row: 1, tilesetId: "rock" }
    }), true);

    const local = sources.opened.get("rock")?.tileset.blocks.get(3);
    assert.deepEqual(local?.defaultTexture, { col: 1, row: 1 });
    assert.equal(local?.materialGroup, "wet");
    assert.equal(view.document.blocks.get(id)?.materialGroup, "rock/wet");
    assert.equal(sources.opened.get("terrain")?.tileset.blocks.has(3), false);

    assert.equal(tilesets.removeBlock(id), true);
    assert.equal(view.document.blocks.has(id), false);
    assert.equal(tilesets.defineBlock({ id: composeBlockId(9, 1), name: "x", shapeId: "cube" }), false);
  });

  it("writes a block with the alpha mode its pixels need in a single command", async() => {
    const { view, sources, tilesets } = setup();
    const opened = sources.opened.get("terrain")!;
    const id = composeBlockId(1, 1);
    await opened.ready;

    const actions: string[] = [];
    opened.tileset.on("command", (command) => actions.push(command.action));
    sources.transparent = true;
    tilesets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.deepEqual(actions, ["block-defined"]);
    assert.equal(opened.tileset.blocks.get(1)?.alphaMode, "mask");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");
  });

  it("keeps the alpha mode of a block written before its tileset loaded", () => {
    const { view, sources, tilesets } = setup();
    const id = composeBlockId(1, 1);
    sources.transparent = true;

    tilesets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.equal(view.document.blocks.get(id)?.alphaMode, undefined);
  });

  it("syncs the alpha mode of the blocks a tileset repaint changed", async() => {
    const { view, sources, tilesets } = setup();
    const id = composeBlockId(1, 1);
    await sources.opened.get("terrain")!.ready;

    sources.transparent = true;
    tilesets.syncAlphaModes("terrain");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    sources.transparent = false;
    tilesets.syncAlphaModes("terrain", { x: 32, y: 32, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    tilesets.syncAlphaModes("terrain", { x: 0, y: 0, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "opaque");
  });

  it("routes material groups by their projected id", () => {
    const { view, sources, tilesets } = setup([kTerrain, kRock]);

    assert.equal(tilesets.defineMaterialGroup(
      new MaterialGroup({ id: "rock/wet", roughness: 0.2 })
    ), true);
    assert.equal(sources.opened.get("rock")?.tileset.materialGroups.get("wet")?.roughness, 0.2);
    assert.equal(view.document.materialGroups.get("rock/wet")?.roughness, 0.2);

    assert.equal(tilesets.removeMaterialGroup("rock/wet"), true);
    assert.equal(view.document.materialGroups.has("rock/wet"), false);
    assert.equal(tilesets.defineMaterialGroup(new MaterialGroup({ id: "loose" })), false);
  });

  it("maps a document position onto the tileset order when moving a block", () => {
    const { view, sources, tilesets } = setup([kTerrain, kRock]);
    tilesets.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    tilesets.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    const engineIds = [...view.document.blocks].map((block) => block.id);
    assert.equal(tilesets.moveBlock(composeBlockId(2, 3), engineIds.indexOf(composeBlockId(2, 1))), true);

    assert.deepEqual(
      [...sources.opened.get("rock")!.tileset.blocks].map((block) => block.id),
      [3, 1, 2]
    );
  });

  it("moves a block down to the document position it was dropped at", () => {
    const { view, sources, tilesets } = setup([kRock]);
    tilesets.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    tilesets.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    assert.equal(tilesets.moveBlock(composeBlockId(2, 1), 2), true);
    assert.deepEqual(
      [...sources.opened.get("rock")!.tileset.blocks].map((block) => block.id),
      [2, 3, 1]
    );
    assert.equal(tilesets.moveBlock(composeBlockId(2, 2), 1), true);
    assert.deepEqual(
      [...view.document.blocks].map((block) => block.id),
      [composeBlockId(2, 3), composeBlockId(2, 2), composeBlockId(2, 1)]
    );
  });

  it("keeps the blocks of a tileset taking over the slot of an unlinked one", () => {
    const { view, tilesets, relink } = setup([kTerrain]);

    relink([kMoss]);

    assert.equal(tilesets.open("terrain") !== undefined, false);
    assert.equal(tilesets.open("moss") !== undefined, true);
    assert.equal(
      view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture?.tilesetId,
      "moss"
    );
  });

  it("resizes the tiles of a linked tileset", () => {
    const { view, tilesets } = setup();

    assert.equal(tilesets.resizeTiles("terrain", 32), true);
    assert.equal(tilesets.tileSizeOf("terrain"), 32);
    assert.equal(view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture?.size, 16);
    assert.equal(tilesets.resizeTiles("missing", 32), false);
  });

  it("releases an unlinked tileset and takes its blocks out of the document", () => {
    const { view, sources, tilesets, relink } = setup([kTerrain, kRock]);
    let changes = 0;
    tilesets.subscribe("change", () => {
      changes++;
    });

    relink([kTerrain]);

    assert.deepEqual(sources.released, ["asset-rock"]);
    assert.equal(view.document.blocks.has(composeBlockId(2, 1)), false);
    assert.equal(view.document.blocks.has(composeBlockId(1, 1)), true);
    assert.equal(tilesets.open("rock") !== undefined, false);
    assert.equal(changes, 1);
  });

  it("labels its entries from the catalog and relabels on a catalog change", () => {
    const { catalog, tilesets } = setup([kTerrain]);

    assert.deepEqual(
      tilesets.entries.map(({ assetId, label }) => [assetId, label]),
      [["asset-terrain", "terrain"]]
    );

    catalog.list = [
      {
        id: "asset-terrain",
        kind: "tileset",
        source: "tilesets/granite.tileset.json"
      } as AssetRecordData
    ];
    catalog.emit("change");

    assert.equal(tilesets.entries[0].label, "granite");
  });

  it("activates the first tileset and ignores an unknown one", () => {
    const { tilesets, relink } = setup([kTerrain, kRock]);
    const changes: Array<string | null> = [];
    tilesets.subscribe("activeChange", (tilesetId) => changes.push(tilesetId));

    assert.equal(tilesets.activeTilesetId, "terrain");

    tilesets.activeTilesetId = "missing";
    tilesets.activeTilesetId = "rock";
    relink([kTerrain]);

    assert.deepEqual(changes, ["rock", "terrain"]);
  });

  it("links a catalog asset under a fresh tileset id", () => {
    const { view, tilesets } = setup([kTerrain]);

    assert.deepEqual(
      tilesets.linkableAssets().map((record) => record.id),
      ["asset-moss", "asset-rock"]
    );
    assert.equal(tilesets.link("asset-rock"), "generated-0");
    assert.equal(view.document.tilesets.get("generated-0")?.asset?.id, "asset-rock");
  });
});
