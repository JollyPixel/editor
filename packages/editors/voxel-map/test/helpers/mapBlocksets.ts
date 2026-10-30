// Import Third-party Dependencies
import {
  BlendGroupList,
  BlockRegistry,
  BlockShapeRegistry,
  MaterialGroupList,
  type MaterialGroup,
  BlocksetDocument,
  BlocksetList,
  BlocksetAtlases,
  type BlendGroupJSON,
  type ResolvedBlockDefinition,
  type BlocksetDefinition,
  type AtlasTexture,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type {
  IslandFace,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import type { BlocksetRoom } from "@jolly-pixel/asset.voxel-map/client";
import type {
  Right,
  RoomEventMap
} from "@jolly-pixel/network/client";
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { EditorMap } from "../../src/map/EditorMap.ts";
import {
  MapBlocksets,
  type BlocksetCatalog
} from "../../src/features/blocksets/MapBlocksets.ts";
import type { OpenedBlockset } from "../../src/viewer/openBlockset.ts";

// CONSTANTS
export const TERRAIN_BLOCKSET: BlocksetDefinition = {
  id: "terrain",
  slot: 1,
  asset: { id: "asset-terrain", kind: "blockset" }
};
export const ROCK_BLOCKSET: BlocksetDefinition = {
  id: "rock",
  slot: 2,
  asset: { id: "asset-rock", kind: "blockset" }
};
export const MOSS_BLOCKSET: BlocksetDefinition = {
  id: "moss",
  slot: 1,
  asset: { id: "asset-moss", kind: "blockset" }
};

if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = () => 0;
}

export interface FakePixels extends PixelDocument {
  islandFaces: (() => Iterable<IslandFace>) | null;
}

function makePixels(
  transparent: () => boolean
): FakePixels {
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
      islandFaces: null as (() => Iterable<IslandFace>) | null,
      useIslandFaces: (faces: () => Iterable<IslandFace>) => {
        fake.islandFaces = faces;

        return () => {
          fake.islandFaces = null;
        };
      },
      invalidateIslands: () => undefined,
      hasTransparency: transparent
    }
  );

  return fake as unknown as FakePixels;
}

export function makeView(
  document: VoxelView["document"] = makeDocument()
): VoxelView {
  const atlases = new BlocksetAtlases({ blocksets: document.blocksets });
  const fake = {
    document,
    atlases,
    shapes: BlockShapeRegistry.createDefault(),
    loadBlockset: (def: BlocksetDefinition, texture: AtlasTexture) => {
      document.blocksets.declare(def);
      atlases.registerTexture(def.id, texture);
    },
    markAllChunksDirty: () => void 0,
    requestFrame: () => void 0
  };

  return fake as unknown as VoxelView;
}

function makeDocument(): VoxelView["document"] {
  const blocksets = new BlocksetList();
  const blockRegistry = new BlockRegistry();
  const materialGroups = new MaterialGroupList();
  const blendGroups = new BlendGroupList();
  const fake = Object.assign(new Emitter(), {
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
    moveBlock: (id: number, toIndex: number) => blockRegistry.moveBlockToIndex(id, toIndex),
    defineMaterialGroup: (group: MaterialGroup) => materialGroups.define(group),
    removeMaterialGroup: (id: string) => materialGroups.remove(id),
    defineBlendGroup: (group: BlendGroupJSON) => blendGroups.define(group),
    removeBlendGroup: (id: string) => blendGroups.remove(id),
    addBlockset: (def: BlocksetDefinition) => {
      blocksets.declare(def);
      fake.emit("command", {
        action: "blockset-added",
        blockset: def
      });

      return true;
    }
  });

  return fake as unknown as VoxelView["document"];
}

export class FakeBlocksetRoom extends Emitter<RoomEventMap> {
  clientId: string | null = null;
  #rights: Record<string, Right> = {};

  can(
    event: string
  ): Right {
    return this.#rights[event] ?? "write";
  }

  sync(
    rights: Record<string, Right>
  ): void {
    this.clientId = "local";
    this.#rights = rights;
    this.emit("sync", {
      self: "local",
      clientIds: []
    });
  }
}

export class FakeSources {
  readonly opened = new Map<string, OpenedBlockset>();
  readonly pixels = new Map<string, FakePixels>();
  readonly rooms = new Map<string, FakeBlocksetRoom>();
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
    const room = new FakeBlocksetRoom();
    const pixels = makePixels(() => this.transparent);
    this.rooms.set(assetId.replace("asset-", ""), room);
    this.pixels.set(assetId.replace("asset-", ""), pixels);
    const opened: OpenedBlockset = {
      pixels,
      blockset,
      room: room as unknown as BlocksetRoom,
      ready: Promise.resolve(),
      release: () => {
        this.released.push(assetId);
      }
    };
    this.opened.set(assetId.replace("asset-", ""), opened);

    return opened;
  }
}

export class FakeCatalog extends Emitter<{ change: () => void; }> implements BlocksetCatalog {
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
    path: `blocksets/${assetId.replace("asset-", "")}.blockset.json`
  } as AssetRecordData;
}

export function makeCatalog(): FakeCatalog {
  const catalog = new FakeCatalog();
  catalog.list = [TERRAIN_BLOCKSET, ROCK_BLOCKSET, MOSS_BLOCKSET].map(
    (definition) => blocksetRecord(definition.asset!.id)
  );

  return catalog;
}

export function setupMapBlocksets(
  definitions: BlocksetDefinition[] = [TERRAIN_BLOCKSET]
) {
  const view = makeView();
  const sources = new FakeSources();
  const catalog = makeCatalog();
  const editorMap = Object.assign(
    new Emitter<Record<string, () => void>>(),
    { ready: true }
  );
  view.document.blocksets.replace(definitions);
  let nextId = 0;
  const blocksets = new MapBlocksets({
    view,
    catalog,
    editorMap: editorMap as unknown as EditorMap,
    open: (assetId) => sources.open(assetId),
    generateId: () => `generated-${nextId++}`
  });

  function relink(
    next: BlocksetDefinition[]
  ): void {
    view.document.blocksets.replace(next);
    view.document.emit("loaded");
  }

  return { view, catalog, sources, editorMap, blocksets, relink };
}
