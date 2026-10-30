// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/history";
import {
  ChunkCoord,
  type ChunkKey,
  type ChunkTier,
  type TerrainReader,
  type TileCoord,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { touchedChunks } from "../network/chunkParts.ts";
import { encodeHeights } from "../network/heights.ts";
import {
  encodeHoleTilePatch,
  type HoleTilePatch
} from "../network/holes.ts";
import { patchBatches } from "../network/patchBatches.ts";
import {
  encodeMaterials,
  encodeSplatTilePatch,
  type SplatTilePatch
} from "../network/splat.ts";
import {
  currentTier,
  resampledTier
} from "../network/tierCommands.ts";
import { currentTiles } from "../network/tilePatchCommands.ts";
import { encodeTilePatch } from "../network/tilePatches.ts";
import type {
  ChunkEntry,
  TerrainCommand,
  TerrainMaterialChanges,
  TerrainMaterialData,
  TerrainMaterialProperties,
  TerrainSnapshot,
  TerrainTextureSize
} from "../network/types.ts";
import {
  captureMaterialImage,
  invertMaterialCommand,
  isMaterialCommand
} from "./materialCommands.ts";
import {
  DEFAULT_MATERIAL_PROPERTIES,
  type TerrainMaterialsReader
} from "./TerrainMaterials.ts";
import {
  TerrainModel,
  type TerrainModelReader
} from "./TerrainModel.ts";
import {
  acceptsChunkAdd,
  acceptsChunkRemoval,
  acceptsTerrainCommand,
  applyTerrainCommand,
  loadedChunkEntry,
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
   * The encoded splat map of a loaded chunk.
   */
  readonly splat?: string;
  /**
   * The encoded hole mask of a loaded chunk that has holes.
   */
  readonly holes?: string;
  /**
   * The encoded overview samples of an unloaded chunk.
   */
  readonly overview?: string;
  /**
   * The encoded overview materials of an unloaded chunk.
   */
  readonly materials?: string;
}

export interface MaterialImage {
  readonly id: string;
  /**
   * The material before the change, or `null` when it did not exist.
   */
  readonly material: TerrainMaterialData | null;
}

export interface TerrainImage {
  readonly chunks: readonly ChunkImage[];
  readonly materials: readonly MaterialImage[];
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
  readonly materials: TerrainMaterialsReader;
  readonly stream: TerrainStream;

  constructor() {
    const model = new TerrainModel();
    const stream = new TerrainStream(model.terrain);
    super(terrainState(model, stream));
    this.terrain = model.terrain;
    this.materials = model.materials;
    this.stream = stream;
    this.on("change", ({ command }) => {
      if (command.action === "chunk-added" || command.action === "chunk-removed") {
        stream.refresh();
      }
    });
    this.on("reset", () => stream.refresh());
  }

  addMaterial(
    properties: Partial<TerrainMaterialProperties> = {}
  ): string | null {
    const slot = this.materials.freeSlot();
    if (slot === null) {
      return null;
    }

    const id = crypto.randomUUID();
    const committed = this.commit({
      action: "material-added",
      material: {
        ...DEFAULT_MATERIAL_PROPERTIES,
        ...properties,
        id,
        slot
      }
    });

    return committed ? id : null;
  }

  updateMaterial(
    id: string,
    changes: TerrainMaterialChanges
  ): boolean {
    return this.commit({ action: "material-updated", id, changes });
  }

  removeMaterial(
    id: string
  ): boolean {
    return this.commit({ action: "material-removed", id });
  }

  changeTextureSize(
    size: TerrainTextureSize
  ): boolean {
    return this.commit({ action: "texture-size-changed", size });
  }

  canAddChunk(
    x: number,
    z: number
  ): boolean {
    return acceptsChunkAdd(this.terrain, new ChunkCoord(x, z));
  }

  canRemoveChunk(
    x: number,
    z: number
  ): boolean {
    return acceptsChunkRemoval(this.terrain, new ChunkCoord(x, z));
  }

  addChunk(
    x: number,
    z: number
  ): boolean {
    const coord = new ChunkCoord(x, z);
    if (!acceptsChunkAdd(this.terrain, coord)) {
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

  changeTier(
    x: number,
    z: number,
    tier: ChunkTier
  ): boolean {
    const coord = new ChunkCoord(x, z);
    if (this.terrain.chunk(coord)?.tier !== tier) {
      const command = resampledTier(this.terrain, coord, tier);

      return command !== null && this.commit(command);
    }

    return false;
  }

  patchTiles(
    patches: Iterable<TilePatch>
  ): boolean {
    return this.#commitBatches(
      this.#loaded(patches).map(encodeTilePatch),
      (tiles) => {
        return { action: "heights-patched", tiles };
      }
    );
  }

  patchSplat(
    patches: Iterable<SplatTilePatch>
  ): boolean {
    return this.#commitBatches(
      this.#loaded(patches).map(encodeSplatTilePatch),
      (tiles) => {
        return { action: "splat-patched", tiles };
      }
    );
  }

  patchHoles(
    patches: Iterable<HoleTilePatch>
  ): boolean {
    return this.#commitBatches(
      this.#loaded(patches).map(encodeHoleTilePatch),
      (tiles) => {
        return { action: "holes-patched", tiles };
      }
    );
  }

  #loaded<TPatch extends { readonly tile: TileCoord; }>(
    patches: Iterable<TPatch>
  ): TPatch[] {
    return [...patches].filter(({ tile }) => this.terrain.has(tile.chunk));
  }

  #commitBatches<TTile>(
    tiles: readonly TTile[],
    command: (batch: TTile[]) => TerrainCommand
  ): boolean {
    let committed = false;
    for (const batch of patchBatches(tiles)) {
      committed = this.commit(command(batch)) || committed;
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
  { terrain, materials }: TerrainModelReader,
  command: TerrainCommand
): TerrainImage {
  if (isMaterialCommand(command)) {
    return captureMaterialImage(materials, command);
  }

  return {
    chunks: touchedChunks(command).map(({ x, z }) => chunkImage(terrain, x, z)),
    materials: [],
    textureSize: null
  };
}

function invertCommand(
  { terrain, materials }: TerrainModelReader,
  command: TerrainCommand
): TerrainCommand[] {
  if (isMaterialCommand(command)) {
    return invertMaterialCommand(materials, command);
  }

  switch (command.action) {
    case "chunk-added":
      return [{ action: "chunk-removed", x: command.x, z: command.z }];
    case "chunk-removed": {
      const chunk = terrain.chunk(new ChunkCoord(command.x, command.z));

      return chunk === undefined ?
        [] :
        [{ action: "chunk-added", ...loadedChunkEntry(chunk) }];
    }
    case "tier-changed": {
      const chunk = terrain.chunk(new ChunkCoord(command.x, command.z));

      return chunk === undefined ? [] : [currentTier(chunk)];
    }
    case "heights-patched":
    case "splat-patched":
    case "holes-patched":
      return [currentTiles(terrain, command)];
  }
}

function chunkImage(
  terrain: TerrainReader,
  x: number,
  z: number
): ChunkImage {
  const coord = new ChunkCoord(x, z);
  const chunk = terrain.chunk(coord);
  if (chunk !== undefined) {
    return loadedChunkEntry(chunk);
  }

  const overview = terrain.overview.samples(coord);
  const materials = terrain.overview.materials(coord);

  return overview === undefined || materials === undefined ?
    { x, z, heights: null } :
    { x, z, heights: null, overview: encodeHeights(overview), materials: encodeMaterials(materials) };
}

function restoreImages(
  snapshot: TerrainSnapshot,
  images: readonly TerrainImage[]
): TerrainSnapshot {
  const chunks = new Map<ChunkKey, ChunkEntry>(
    snapshot.chunks.map((chunk) => [new ChunkCoord(chunk.x, chunk.z).key, chunk])
  );
  const materials = new Map(
    (snapshot.materials ?? []).map((material) => [material.id, material])
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
    for (const { id, material } of image.materials) {
      if (material === null) {
        materials.delete(id);
      }
      else {
        materials.set(id, material);
      }
    }
    textureSize = image.textureSize ?? textureSize;
  }

  return {
    chunks: [...chunks.values()],
    materials: [...materials.values()].sort((left, right) => left.slot - right.slot),
    textureSize
  };
}

function restoredEntry(
  current: ChunkEntry | undefined,
  { x, z, heights, splat, holes, overview, materials }: ChunkImage
): ChunkEntry | null {
  if (heights !== null) {
    return {
      x,
      z,
      heights,
      ...(splat === undefined ? {} : { splat }),
      ...(holes === undefined ? {} : { holes })
    };
  }
  if (overview === undefined) {
    return null;
  }

  return current?.heights === undefined ?
    { x, z, overview, ...(materials === undefined ? {} : { materials }) } :
    current;
}
