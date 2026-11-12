// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import {
  VOXEL_BRUSH_PRESENCE_KEY,
  type SyncedVoxelMap,
  type VoxelBrushPresence
} from "@jolly-pixel/asset.voxel-map/client";
import type { VoxelMapEditableKind } from "@jolly-pixel/asset.voxel-map/server";
import type { PeerMetadata } from "@jolly-pixel/network/client";
import {
  packVoxel,
  rankBetween,
  VOXEL_ABSENT,
  VoxelPatchBuilder,
  voxelPatchWrites,
  type PackedVoxel,
  type VoxelCoord,
  type VoxelLayer,
  type VoxelWorldCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  GolemAsset,
  type AssetOpening
} from "../GolemAsset.ts";
import { UnknownEntryError } from "../errors/UnknownEntryError.ts";
import {
  MapBlocksets,
  type MapBlock,
  type MapBlockset
} from "./MapBlocksets.ts";
import {
  VoxelBox,
  type VoxelBoxJSON
} from "./VoxelBox.ts";

// CONSTANTS
export const MAX_PATCH_CELLS = 32_768;
export const MAX_QUERY_CELLS = 4_096;

export interface LayerOption {
  /**
   * A layer name or id.
   */
  layer: string;
}

export interface AddLayerOptions {
  /**
   * A layer name or id: the new layer goes right above it.
   * @default the new layer goes on top
   */
  above?: string;
}

export interface AddedLayer {
  id: string;
  /**
   * The name asked for, with a number appended when another layer has it.
   */
  name: string;
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  voxelCount: number;
  /**
   * The occupied cells, corners included; `null` for an empty layer.
   */
  bounds: VoxelBoxJSON | null;
}

export interface MapSummary {
  chunkSize: number;
  voxelCount: number;
  layers: MapLayer[];
  blocksets: MapBlockset[];
  blocks: MapBlock[];
}

export interface MapCell extends VoxelCoord {
  block: number;
  layer: string;
}

export interface MapQuery {
  cells: MapCell[];
  /**
   * More than `MAX_QUERY_CELLS` cells were occupied; `cells` holds the first.
   */
  truncated: boolean;
}

export interface MapHeightmap {
  min: {
    x: number;
    z: number;
  };
  /**
   * One row per z from `min.z`, one height per x from `min.x`: the highest
   * occupied y within the box, or `null`.
   */
  heights: (number | null)[][];
}

export interface VoxelWrite {
  position: VoxelCoord;
  /**
   * A block name, `"<blockset>/<name>"`, a block id, or `null` to empty the cell.
   */
  block: string | number | null;
}

type CellWrite = readonly [VoxelCoord, PackedVoxel];

export class VoxelMapAsset extends GolemAsset<VoxelWorldCommand, SyncedVoxelMap> {
  #blocksets: MapBlocksets;

  constructor(
    opening: AssetOpening,
    kind: VoxelMapEditableKind
  ) {
    super(opening, kind);
    this.#blocksets = new MapBlocksets(this.synced.voxels, opening.open);
  }

  async summary(): Promise<MapSummary> {
    await this.#blocksets.link();

    return this.read();
  }

  read(): MapSummary {
    const { world } = this.synced.voxels;

    return {
      chunkSize: world.chunkSize,
      voxelCount: world.voxelCount,
      layers: world.layers().map((layer) => {
        const bounds = layer.worldBounds();

        return {
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          voxelCount: layer.voxelCount,
          bounds: bounds === null ?
            null :
            {
              min: {
                x: bounds.min.x,
                y: bounds.min.y,
                z: bounds.min.z
              },
              max: {
                x: bounds.max.x - 1,
                y: bounds.max.y - 1,
                z: bounds.max.z - 1
              }
            }
        };
      }),
      blocksets: this.#blocksets.list(),
      blocks: this.#blocksets.blocks()
    };
  }

  query(
    box: VoxelBoxJSON,
    options: Partial<LayerOption> = {}
  ): MapQuery {
    const layer = this.#layerFilter(options.layer);
    const { world } = this.synced.voxels;
    const voxelAt = layer === null ?
      (position: VoxelCoord) => world.voxelWithLayerAt(position) :
      (position: VoxelCoord) => layerVoxel(layer, position);
    const cells: MapCell[] = [];
    for (const position of new VoxelBox(box).cells()) {
      const found = voxelAt(position);
      if (found === undefined) {
        continue;
      }
      if (cells.length === MAX_QUERY_CELLS) {
        return {
          cells,
          truncated: true
        };
      }
      cells.push({
        ...position,
        block: found.entry.blockId,
        layer: found.layer.name
      });
    }

    return {
      cells,
      truncated: false
    };
  }

  heightmap(
    box: VoxelBoxJSON,
    options: Partial<LayerOption> = {}
  ): MapHeightmap {
    const { min, max } = new VoxelBox(box);
    const source = this.#layerFilter(options.layer) ?? this.synced.voxels.world;
    const heights: (number | null)[][] = [];
    for (let z = min.z; z <= max.z; z++) {
      const row: (number | null)[] = [];
      for (let x = min.x; x <= max.x; x++) {
        let top: number | null = null;
        for (let y = max.y; y >= min.y && top === null; y--) {
          if (source.packedAt({ x, y, z }) !== VOXEL_ABSENT) {
            top = y;
          }
        }
        row.push(top);
      }
      heights.push(row);
    }

    return {
      min: {
        x: min.x,
        z: min.z
      },
      heights
    };
  }

  async addLayer(
    name: string,
    options: AddLayerOptions = {}
  ): Promise<AddedLayer> {
    const layerId = randomUUID();
    await this.apply([
      {
        action: "added",
        layerId,
        metadata: {
          name,
          rank: this.#rankAbove(options.above),
          options: {}
        }
      }
    ]);

    return {
      id: layerId,
      name: this.#layer(layerId).name
    };
  }

  async fillBox(
    box: VoxelBoxJSON,
    block: string | number,
    options: LayerOption
  ): Promise<number> {
    const layer = this.#layer(options.layer);
    const resolve = await this.#blocksets.resolver();
    const packed = packVoxel(resolve(block), 0);
    const writes = Array.from(
      new VoxelBox(box).cells(),
      (position): CellWrite => [position, packed]
    );

    return this.#write(layer, writes);
  }

  async clearBox(
    box: VoxelBoxJSON,
    options: LayerOption
  ): Promise<number> {
    const layer = this.#layer(options.layer);
    const writes: CellWrite[] = [];
    for (const position of new VoxelBox(box).cells()) {
      if (layer.packedAt(position) !== VOXEL_ABSENT) {
        writes.push([position, VOXEL_ABSENT]);
      }
    }

    return this.#write(layer, writes);
  }

  async writeVoxels(
    voxels: Iterable<VoxelWrite>,
    options: LayerOption
  ): Promise<number> {
    const layer = this.#layer(options.layer);
    const resolve = await this.#blocksets.resolver();
    const writes = Array.from(voxels, ({ position, block }): CellWrite => [
      position,
      block === null ? VOXEL_ABSENT : packVoxel(resolve(block), 0)
    ]);

    return this.#write(layer, writes);
  }

  override close(): void {
    this.#blocksets.dispose();
    super.close();
  }

  protected override loaded(): Promise<void> {
    return this.#blocksets.link();
  }

  protected focus(
    commands: readonly VoxelWorldCommand[]
  ): PeerMetadata | null {
    for (const command of commands.toReversed()) {
      const position = editedCell(command);
      if (position !== null) {
        const brush: VoxelBrushPresence = {
          position,
          size: 1,
          pattern: "square"
        };

        return { [VOXEL_BRUSH_PRESENCE_KEY]: brush };
      }
    }

    return null;
  }

  async #write(
    layer: VoxelLayer,
    writes: readonly CellWrite[]
  ): Promise<number> {
    const commands: VoxelWorldCommand[] = [];
    for (let start = 0; start < writes.length; start += MAX_PATCH_CELLS) {
      const builder = new VoxelPatchBuilder();
      for (const [position, packed] of writes.slice(start, start + MAX_PATCH_CELLS)) {
        builder.push(position, packed);
      }
      commands.push({
        action: "voxels-patched",
        layerId: layer.id,
        metadata: builder.toPatch()
      });
    }
    await this.applyInBatches(commands);

    return writes.length;
  }

  #rankAbove(
    nameOrId: string | undefined
  ): string {
    const layers = this.synced.voxels.world.layers();
    if (nameOrId === undefined) {
      return rankBetween(layers[0]?.rank ?? null, null);
    }

    const below = this.#layer(nameOrId);
    const above = layers[layers.indexOf(below) - 1];

    return rankBetween(below.rank, above?.rank ?? null);
  }

  #layerFilter(
    nameOrId: string | undefined
  ): VoxelLayer | null {
    return nameOrId === undefined ? null : this.#layer(nameOrId);
  }

  #layer(
    nameOrId: string
  ): VoxelLayer {
    const { world } = this.synced.voxels;
    const layer = world.findLayerById(nameOrId) ?? world.findLayer(nameOrId);
    if (layer === undefined) {
      throw new UnknownEntryError("layer", nameOrId, []);
    }

    return layer;
  }
}

function layerVoxel(
  layer: VoxelLayer,
  position: VoxelCoord
): { entry: { blockId: number; }; layer: VoxelLayer; } | undefined {
  const entry = layer.voxelAt(position);

  return entry === undefined ? undefined : { entry, layer };
}

function editedCell(
  command: VoxelWorldCommand
): VoxelCoord | null {
  switch (command.action) {
    case "voxel-set":
    case "voxel-removed":
      return { ...command.metadata.position };
    case "voxels-set":
    case "voxels-removed": {
      const last = command.metadata.entries.at(-1);

      return last === undefined ? null : { ...last.position };
    }
    case "voxels-patched": {
      let last: VoxelCoord | null = null;
      for (const { position } of voxelPatchWrites(command.metadata)) {
        last = position;
      }

      return last === null ? null : { ...last };
    }
    default:
      return null;
  }
}
