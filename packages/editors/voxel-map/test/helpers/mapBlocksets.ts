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
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { BlocksetRoom } from "@jolly-pixel/asset.voxel-map/client";
import type {
  Right,
  RoomEventMap
} from "@jolly-pixel/network/client";
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { MapDocument } from "../../src/document/MapDocument.ts";
import {
  MapBlocksets,
  type BlocksetCatalog
} from "../../src/features/blocksets/MapBlocksets.ts";
import type { OpenedBlockset } from "../../src/features/blocksets/BlocksetBinding.ts";

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
    this.rooms.set(assetId.replace("asset-", ""), room);
    const opened: OpenedBlockset = {
      pixels: makePixels(() => this.transparent),
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
    source: `blocksets/${assetId.replace("asset-", "")}.blockset.json`
  } as AssetRecordData;
}

export function setupMapBlocksets(
  definitions: BlocksetDefinition[] = [TERRAIN_BLOCKSET]
) {
  const view = makeView();
  const sources = new FakeSources();
  const catalog = new FakeCatalog();
  catalog.list = [TERRAIN_BLOCKSET, ROCK_BLOCKSET, MOSS_BLOCKSET].map(
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
