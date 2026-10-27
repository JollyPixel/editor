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
  TerrainMaterialChanges,
  TerrainMaterialData,
  TerrainMaterialProperties,
  TerrainSnapshot,
  TerrainTextureSize
} from "../network/types.ts";
import {
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
  { terrain, materials }: TerrainModelReader,
  command: TerrainCommand
): TerrainImage {
  if (!isMaterialCommand(command)) {
    return {
      chunks: touchedChunks(command).map(({ x, z }) => chunkImage(terrain, x, z)),
      materials: [],
      textureSize: null
    };
  }
  if (command.action === "texture-size-changed") {
    return { chunks: [], materials: [], textureSize: materials.textureSize };
  }

  const id = command.action === "material-added" ? command.material.id : command.id;

  return {
    chunks: [],
    materials: [{ id, material: materials.material(id) ?? null }],
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
