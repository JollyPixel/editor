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
  BlocksetDocument,
  BlocksetList,
  BlocksetAtlases,
  type BlendGroupJSON,
  type ResolvedBlockDefinition,
  type BlocksetDefinition,
  type AtlasTexture,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { BlocksetRoom } from "@jolly-pixel/asset.voxel-map/client";
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { MapDocument } from "../../../src/document/MapDocument.ts";
import {
  MapBlocksets,
  type BlocksetCatalog
} from "../../../src/features/blocksets/MapBlocksets.ts";
import type { OpenedBlockset } from "../../../src/features/blocksets/BlocksetBinding.ts";

// CONSTANTS
const kTerrain: BlocksetDefinition = {
  id: "terrain",
  slot: 1,
  asset: { id: "asset-terrain", kind: "blockset" }
};
const kRock: BlocksetDefinition = {
  id: "rock",
  slot: 2,
  asset: { id: "asset-rock", kind: "blockset" }
};
const kMoss: BlocksetDefinition = {
  id: "moss",
  slot: 1,
  asset: { id: "asset-moss", kind: "blockset" }
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
      normalMap: null,
      normals: new Emitter(),
      useIslandFaces: () => () => undefined,
      invalidateIslands: () => undefined,
      hasTransparency: transparent
    }
  );

  return fake as unknown as PixelDocument;
}

function makeView(): VoxelView {
  const blocksets = new BlocksetList();
  const atlases = new BlocksetAtlases({ blocksets });
  const blockRegistry = new BlockRegistry();
  const materialGroups = new MaterialGroupList();
  const blendGroups = new BlendGroupList();
  const fake = {
    document: {
      blocksets,
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
      addBlockset: (def: BlocksetDefinition) => {
        blocksets.declare(def);

        return true;
      }
    },
    atlases,
    shapes: BlockShapeRegistry.createDefault(),
    loadBlockset: (def: BlocksetDefinition, texture: AtlasTexture) => {
      blocksets.declare(def);
      atlases.registerTexture(def.id, texture);
    },
    markAllChunksDirty: () => void 0,
    requestFrame: () => void 0
  };

  return fake as unknown as VoxelView;
}

class FakeSources {
  readonly opened = new Map<string, OpenedBlockset>();
  readonly released: string[] = [];
  transparent = false;

  open(
    assetId: string
  ): OpenedBlockset {
    const blockset = new BlocksetDocument({
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
    const opened: OpenedBlockset = {
      pixels: makePixels(() => this.transparent),
      blockset,
      room: {} as BlocksetRoom,
      ready: Promise.resolve(),
      release: () => {
        this.released.push(assetId);
      }
    };
    this.opened.set(assetId.replace("asset-", ""), opened);

    return opened;
  }
}

class FakeCatalog extends Emitter<{ change: () => void; }> implements BlocksetCatalog {
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

function blocksetRecord(
  assetId: string
): AssetRecordData {
  return {
    id: assetId,
    kind: "blockset",
    source: `blocksets/${assetId.replace("asset-", "")}.blockset.json`
  } as AssetRecordData;
}

function setup(
  definitions: BlocksetDefinition[] = [kTerrain]
) {
  const view = makeView();
  const sources = new FakeSources();
  const catalog = new FakeCatalog();
  catalog.list = [kTerrain, kRock, kMoss].map(
    (definition) => blocksetRecord(definition.asset!.id)
  );
  const mapDocument = Object.assign(
    new Emitter<Record<string, () => void>>(),
    { ready: true }
  ) as unknown as MapDocument;
  view.document.blocksets.replace(definitions);
  let nextId = 0;
  const blocksets = new MapBlocksets({
    view,
    catalog,
    mapDocument,
    open: (assetId) => sources.open(assetId),
    generateId: () => `generated-${nextId++}`
  });

  function relink(
    next: BlocksetDefinition[]
  ): void {
    view.document.blocksets.replace(next);
    mapDocument.emit("blocksetsChanged");
  }

  return { view, catalog, sources, blocksets, relink };
}

describe("MapBlocksets", () => {
  it("binds each linked blockset and projects its blocks into the document", () => {
    const { view, blocksets } = setup();

    assert.equal(blocksets.open("terrain") !== undefined, true);
    assert.equal(blocksets.tileSizeOf("terrain"), 16);
    assert.deepEqual(view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture, {
      col: 0,
      row: 0,
      blocksetId: "terrain"
    });
    assert.equal(view.document.blocksets.get("terrain")?.tileSize, 16);
  });

  it("finds the owner of a world block id by its slot", () => {
    const { blocksets } = setup([kTerrain, kRock]);

    assert.equal(blocksets.ownerOf(composeBlockId(2, 7))?.definition.id, "rock");
    assert.equal(blocksets.ownerOf(composeBlockId(5, 1)), undefined);
    assert.equal(blocksets.nextBlockId("terrain"), composeBlockId(1, 2));
    assert.equal(blocksets.nextBlockId("missing"), undefined);
  });

  it("routes world-space block writes to the owning blockset in its own space", () => {
    const { view, sources, blocksets } = setup([kTerrain, kRock]);
    const id = composeBlockId(2, 3);

    assert.equal(blocksets.defineBlock({
      id,
      name: "moss",
      shapeId: "cube",
      materialGroup: "rock/wet",
      defaultTexture: { col: 1, row: 1, blocksetId: "rock" }
    }), true);

    const local = sources.opened.get("rock")?.blockset.blocks.get(3);
    assert.deepEqual(local?.defaultTexture, { col: 1, row: 1 });
    assert.equal(local?.materialGroup, "wet");
    assert.equal(view.document.blocks.get(id)?.materialGroup, "rock/wet");
    assert.equal(sources.opened.get("terrain")?.blockset.blocks.has(3), false);

    assert.equal(blocksets.removeBlock(id), true);
    assert.equal(view.document.blocks.has(id), false);
    assert.equal(blocksets.defineBlock({ id: composeBlockId(9, 1), name: "x", shapeId: "cube" }), false);
  });

  it("writes a block with the alpha mode its pixels need in a single command", async() => {
    const { view, sources, blocksets } = setup();
    const opened = sources.opened.get("terrain")!;
    const id = composeBlockId(1, 1);
    await opened.ready;

    const actions: string[] = [];
    opened.blockset.on("command", (command) => actions.push(command.action));
    sources.transparent = true;
    blocksets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.deepEqual(actions, ["block-defined"]);
    assert.equal(opened.blockset.blocks.get(1)?.alphaMode, "mask");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");
  });

  it("keeps the alpha mode of a block written before its blockset loaded", () => {
    const { view, sources, blocksets } = setup();
    const id = composeBlockId(1, 1);
    sources.transparent = true;

    blocksets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.equal(view.document.blocks.get(id)?.alphaMode, undefined);
  });

  it("syncs the alpha mode of the blocks a blockset repaint changed", async() => {
    const { view, sources, blocksets } = setup();
    const id = composeBlockId(1, 1);
    await sources.opened.get("terrain")!.ready;

    sources.transparent = true;
    blocksets.syncAlphaModes("terrain");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    sources.transparent = false;
    blocksets.syncAlphaModes("terrain", { x: 32, y: 32, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    blocksets.syncAlphaModes("terrain", { x: 0, y: 0, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "opaque");
  });

  it("routes material groups by their projected id", () => {
    const { view, sources, blocksets } = setup([kTerrain, kRock]);

    assert.equal(blocksets.defineMaterialGroup(
      new MaterialGroup({ id: "rock/wet", roughness: 0.2 })
    ), true);
    assert.equal(sources.opened.get("rock")?.blockset.materialGroups.get("wet")?.roughness, 0.2);
    assert.equal(view.document.materialGroups.get("rock/wet")?.roughness, 0.2);

    assert.equal(blocksets.removeMaterialGroup("rock/wet"), true);
    assert.equal(view.document.materialGroups.has("rock/wet"), false);
    assert.equal(blocksets.defineMaterialGroup(new MaterialGroup({ id: "loose" })), false);
  });

  it("maps a document position onto the blockset order when moving a block", () => {
    const { view, sources, blocksets } = setup([kTerrain, kRock]);
    blocksets.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    blocksets.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    const engineIds = [...view.document.blocks].map((block) => block.id);
    assert.equal(blocksets.moveBlock(composeBlockId(2, 3), engineIds.indexOf(composeBlockId(2, 1))), true);

    assert.deepEqual(
      [...sources.opened.get("rock")!.blockset.blocks].map((block) => block.id),
      [3, 1, 2]
    );
  });

  it("moves a block down to the document position it was dropped at", () => {
    const { view, sources, blocksets } = setup([kRock]);
    blocksets.defineBlock({ id: composeBlockId(2, 2), name: "b", shapeId: "cube" });
    blocksets.defineBlock({ id: composeBlockId(2, 3), name: "c", shapeId: "cube" });

    assert.equal(blocksets.moveBlock(composeBlockId(2, 1), 2), true);
    assert.deepEqual(
      [...sources.opened.get("rock")!.blockset.blocks].map((block) => block.id),
      [2, 3, 1]
    );
    assert.equal(blocksets.moveBlock(composeBlockId(2, 2), 1), true);
    assert.deepEqual(
      [...view.document.blocks].map((block) => block.id),
      [composeBlockId(2, 3), composeBlockId(2, 2), composeBlockId(2, 1)]
    );
  });

  it("keeps the blocks of a blockset taking over the slot of an unlinked one", () => {
    const { view, blocksets, relink } = setup([kTerrain]);

    relink([kMoss]);

    assert.equal(blocksets.open("terrain") !== undefined, false);
    assert.equal(blocksets.open("moss") !== undefined, true);
    assert.equal(
      view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture?.blocksetId,
      "moss"
    );
  });

  it("resizes the tiles of a linked blockset", () => {
    const { view, blocksets } = setup();

    assert.equal(blocksets.resizeTiles("terrain", 32), true);
    assert.equal(blocksets.tileSizeOf("terrain"), 32);
    assert.equal(view.document.blocks.get(composeBlockId(1, 1))?.defaultTexture?.size, 16);
    assert.equal(blocksets.resizeTiles("missing", 32), false);
  });

  it("releases an unlinked blockset and takes its blocks out of the document", () => {
    const { view, sources, blocksets, relink } = setup([kTerrain, kRock]);
    let changes = 0;
    blocksets.subscribe("change", () => {
      changes++;
    });

    relink([kTerrain]);

    assert.deepEqual(sources.released, ["asset-rock"]);
    assert.equal(view.document.blocks.has(composeBlockId(2, 1)), false);
    assert.equal(view.document.blocks.has(composeBlockId(1, 1)), true);
    assert.equal(blocksets.open("rock") !== undefined, false);
    assert.equal(changes, 1);
  });

  it("labels its entries from the catalog and relabels on a catalog change", () => {
    const { catalog, blocksets } = setup([kTerrain]);

    assert.deepEqual(
      blocksets.entries.map(({ assetId, label }) => [assetId, label]),
      [["asset-terrain", "terrain"]]
    );

    catalog.list = [
      {
        id: "asset-terrain",
        kind: "blockset",
        source: "blocksets/granite.blockset.json"
      } as AssetRecordData
    ];
    catalog.emit("change");

    assert.equal(blocksets.entries[0].label, "granite");
  });

  it("activates the first blockset and ignores an unknown one", () => {
    const { blocksets, relink } = setup([kTerrain, kRock]);
    const changes: Array<string | null> = [];
    blocksets.subscribe("activeChange", (blocksetId) => changes.push(blocksetId));

    assert.equal(blocksets.activeBlocksetId, "terrain");

    blocksets.activeBlocksetId = "missing";
    blocksets.activeBlocksetId = "rock";
    relink([kTerrain]);

    assert.deepEqual(changes, ["rock", "terrain"]);
  });

  it("links a catalog asset under a fresh blockset id", () => {
    const { view, blocksets } = setup([kTerrain]);

    assert.deepEqual(
      blocksets.linkableAssets().map((record) => record.id),
      ["asset-moss", "asset-rock"]
    );
    assert.equal(blocksets.link("asset-rock"), "generated-0");
    assert.equal(view.document.blocksets.get("generated-0")?.asset?.id, "asset-rock");
  });
});
