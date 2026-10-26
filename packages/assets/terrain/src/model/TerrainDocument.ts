// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/history";
import {
  ChunkCoord,
  type ChunkKey,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { touchedChunks } from "../network/chunkParts.ts";
import { encodeHeights } from "../network/heights.ts";
import { patchBatches } from "../network/patchBatches.ts";
import {
  currentTilePatches,
  encodeTilePatch
} from "../network/tilePatches.ts";
import type {
  ChunkEntry,
  TerrainCommand,
  TerrainLayerChanges,
  TerrainLayerData,
  TerrainLayerProperties,
  TerrainSnapshot,
  TerrainTextureSize
} from "../network/types.ts";
import {
  invertLayerCommand,
  isLayerCommand
} from "./layerCommands.ts";
import {
  DEFAULT_LAYER_PROPERTIES,
  type TerrainLayersReader
} from "./TerrainLayers.ts";
import {
  TerrainModel,
  type TerrainModelReader
} from "./TerrainModel.ts";
import {
  acceptsTerrainCommand,
  applyTerrainCommand,
  loadTerrainSnapshot,
  terrainSnapshot
} from "./terrainState.ts";
import { TerrainStream } from "./TerrainStream.ts";

export interface ChunkImage {
  readonly x: number;
  readonly z: number;
  /**
   * The chunk's encoded heights, or `null` when it is unloaded or absent.
   */
  readonly heights: string | null;
  /**
   * The encoded overview samples of an unloaded chunk.
   */
  readonly overview?: string;
}

export interface LayerImage {
  readonly id: string;
  /**
   * The layer before the change, or `null` when it did not exist.
   */
  readonly layer: TerrainLayerData | null;
}

export interface TerrainImage {
  readonly chunks: readonly ChunkImage[];
  readonly layers: readonly LayerImage[];
  /**
   * The texture size before the change, or `null` when it did not change.
   */
  readonly textureSize: TerrainTextureSize | null;
}

export type TerrainChange = CommandChange<TerrainCommand, TerrainImage>;

export class TerrainDocument extends CommandDocument<
  TerrainCommand,
  TerrainSnapshot,
  TerrainImage
> implements TerrainModelReader {
  readonly terrain: TerrainReader;
  readonly layers: TerrainLayersReader;
  readonly stream: TerrainStream;

  constructor() {
    const model = new TerrainModel();
    const stream = new TerrainStream(model.terrain);
    super(terrainState(model, stream));
    this.terrain = model.terrain;
    this.layers = model.layers;
    this.stream = stream;
    this.on("change", ({ command }) => {
      if (command.action === "chunk-added" || command.action === "chunk-removed") {
        stream.refresh();
      }
    });
    this.on("reset", () => stream.refresh());
  }

  addLayer(
    properties: Partial<TerrainLayerProperties> = {}
  ): string | null {
    const slot = this.layers.freeSlot();
    if (slot === null) {
      return null;
    }

    const id = crypto.randomUUID();
    const committed = this.commit({
      action: "layer-added",
      layer: {
        ...DEFAULT_LAYER_PROPERTIES,
        ...properties,
        id,
        slot
      }
    });

    return committed ? id : null;
  }

  updateLayer(
    id: string,
    changes: TerrainLayerChanges
  ): boolean {
    return this.commit({ action: "layer-updated", id, changes });
  }

  removeLayer(
    id: string
  ): boolean {
    return this.commit({ action: "layer-removed", id });
  }

  changeTextureSize(
    size: TerrainTextureSize
  ): boolean {
    return this.commit({ action: "texture-size-changed", size });
  }

  addChunk(
    x: number,
    z: number
  ): boolean {
    const coord = new ChunkCoord(x, z);
    if (this.terrain.knows(coord)) {
      return false;
    }

    return this.commit({
      action: "chunk-added",
      x,
      z,
      heights: encodeHeights(this.terrain.seedHeights(coord))
    });
  }

  removeChunk(
    x: number,
    z: number
  ): boolean {
    return this.commit({ action: "chunk-removed", x, z });
  }

  patchTiles(
    patches: Iterable<TilePatch>
  ): boolean {
    const tiles = [...patches]
      .filter(({ tile }) => this.terrain.has(tile.chunk))
      .map(encodeTilePatch);
    let committed = false;
    for (const batch of patchBatches(tiles)) {
      committed = this.commit({
        action: "heights-patched",
        tiles: batch
      }) || committed;
    }

    return committed;
  }
}

function terrainState(
  model: TerrainModel,
  stream: TerrainStream
): CommandState<TerrainCommand, TerrainSnapshot, TerrainImage> {
  return {
    accepts: (command) => acceptsTerrainCommand(model, command),
    placeable: (command) => command,
    apply: (command) => applyTerrainCommand(model, command, (coord) => stream.wants(coord)),
    load: (snapshot) => loadTerrainSnapshot(model, snapshot),
    captureImage: (command) => captureImage(model, command),
    invert: (command) => invertCommand(model, command),
    restored: (images) => restoreImages(terrainSnapshot(model), images)
  };
}

function captureImage(
  { terrain, layers }: TerrainModelReader,
  command: TerrainCommand
): TerrainImage {
  if (!isLayerCommand(command)) {
    return {
      chunks: touchedChunks(command).map(({ x, z }) => chunkImage(terrain, x, z)),
      layers: [],
      textureSize: null
    };
  }
  if (command.action === "texture-size-changed") {
    return { chunks: [], layers: [], textureSize: layers.textureSize };
  }

  const id = command.action === "layer-added" ? command.layer.id : command.id;

  return {
    chunks: [],
    layers: [{ id, layer: layers.layer(id) ?? null }],
    textureSize: null
  };
}

function invertCommand(
  { terrain, layers }: TerrainModelReader,
  command: TerrainCommand
): TerrainCommand[] {
  if (isLayerCommand(command)) {
    return invertLayerCommand(layers, command);
  }

  switch (command.action) {
    case "chunk-added":
      return [{ action: "chunk-removed", x: command.x, z: command.z }];
    case "chunk-removed": {
      const heights = encodedHeightsAt(terrain, command.x, command.z);

      return heights === null ?
        [] :
        [{ action: "chunk-added", x: command.x, z: command.z, heights }];
    }
    default:
      return [{
        action: "heights-patched",
        tiles: currentTilePatches(terrain, command.tiles)
      }];
  }
}

function chunkImage(
  terrain: TerrainReader,
  x: number,
  z: number
): ChunkImage {
  const coord = new ChunkCoord(x, z);
  const overview = terrain.has(coord) ? undefined : terrain.overview.samples(coord);

  return overview === undefined ?
    { x, z, heights: encodedHeightsAt(terrain, x, z) } :
    { x, z, heights: null, overview: encodeHeights(overview) };
}

function encodedHeightsAt(
  terrain: TerrainReader,
  x: number,
  z: number
): string | null {
  const chunk = terrain.chunk(new ChunkCoord(x, z));

  return chunk === undefined ? null : encodeHeights(chunk.copyHeights());
}

function restoreImages(
  snapshot: TerrainSnapshot,
  images: readonly TerrainImage[]
): TerrainSnapshot {
  const chunks = new Map<ChunkKey, ChunkEntry>(
    snapshot.chunks.map((chunk) => [new ChunkCoord(chunk.x, chunk.z).key, chunk])
  );
  const layers = new Map(
    (snapshot.layers ?? []).map((layer) => [layer.id, layer])
  );
  let { textureSize } = snapshot;
  for (const image of [...images].reverse()) {
    for (const chunk of image.chunks) {
      const key = new ChunkCoord(chunk.x, chunk.z).key;
      const restored = restoredEntry(chunks.get(key), chunk);
      if (restored === null) {
        chunks.delete(key);
      }
      else {
        chunks.set(key, restored);
      }
    }
    for (const { id, layer } of image.layers) {
      if (layer === null) {
        layers.delete(id);
      }
      else {
        layers.set(id, layer);
      }
    }
    textureSize = image.textureSize ?? textureSize;
  }

  return {
    chunks: [...chunks.values()],
    layers: [...layers.values()].sort((left, right) => left.slot - right.slot),
    textureSize
  };
}

function restoredEntry(
  current: ChunkEntry | undefined,
  { x, z, heights, overview }: ChunkImage
): ChunkEntry | null {
  if (heights !== null) {
    return { x, z, heights };
  }
  if (overview === undefined) {
    return null;
  }

  return current?.heights === undefined ? { x, z, overview } : current;
}
