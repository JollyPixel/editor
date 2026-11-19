// Import Node.js Dependencies
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import type {
  AssetArchive,
  AssetArchiveAsset
} from "@jolly-pixel/asset-server";
import {
  BLOCKSET_FILE,
  BLOCKSET_KIND,
  VOXEL_MAP_KIND,
  VoxelMapState,
  type BlocksetFile
} from "@jolly-pixel/asset.voxel-map";
import {
  composeBlockId,
  decodeVoxelWorld,
  voxelBlockId,
  voxelTransform,
  VoxelTransform,
  VOXEL_ABSENT,
  type PackedVoxel
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { Cell } from "./viewport.ts";

export type TileCoverage = "empty" | "partial" | "full";

export interface MapLayer {
  name: string;
  voxels: number;
}

export interface MapBlock {
  name: string;
  shape: string;
  tile: TileCoverage;
  material: string | null;
}

export interface MapMaterial {
  id: string;
  swatch: string | null;
}

export interface MapVoxelPart {
  block: string;
  rotation: number;
  flipY: boolean;
}

export interface MapVoxel extends MapVoxelPart {
  partner: MapVoxelPart | null;
}

export type MapVoxels = Record<string, MapVoxel>;

export class MapArchive {
  readonly #state: VoxelMapState;
  readonly #blockNames = new Map<number, string>();
  readonly #blocks: MapBlock[] = [];
  readonly #materials: MapMaterial[] = [];

  constructor(
    archive: AssetArchive
  ) {
    const map = archive.assets.find((asset) => asset.kind === VOXEL_MAP_KIND);
    if (map === undefined) {
      throw new Error("The archive holds no voxel map.");
    }

    const world = decodeVoxelWorld(map.data);
    this.#state = new VoxelMapState(world.chunkSize);
    this.#state.load(world);

    for (const blockset of this.#state.blocksets) {
      const asset = archive.assets.find(
        (entry) => entry.kind === BLOCKSET_KIND && entry.id === blockset.asset?.id
      );
      if (asset === undefined) {
        throw new Error(`The archive holds no asset for blockset "${blockset.id}".`);
      }
      this.#nameBlocks(blockset.slot ?? 0, asset);
    }
  }

  layers(): MapLayer[] {
    return this.#state.world.layers().map((layer) => {
      return {
        name: layer.name,
        voxels: layer.voxelCount
      };
    });
  }

  templates(): string[] {
    return this.#state.world.templates.toArray().map(
      (template) => template.name
    );
  }

  blocks(): MapBlock[] {
    return [...this.#blocks];
  }

  materials(): MapMaterial[] {
    return [...this.#materials];
  }

  voxels(): MapVoxels {
    const voxels: MapVoxels = {};
    for (const layer of this.#state.world.layers()) {
      for (const [x, y, z, packed, partner] of layer.localVoxels()) {
        voxels[cellKey(layer.localToWorld({ x, y, z }))] = {
          ...this.#part(packed),
          partner: partner === VOXEL_ABSENT ? null : this.#part(partner)
        };
      }
    }

    return voxels;
  }

  #part(
    packed: PackedVoxel
  ): MapVoxelPart {
    const { rotation, flipY } = VoxelTransform.fromPacked(
      voxelTransform(packed)
    );

    return {
      block: this.#blockName(voxelBlockId(packed)),
      rotation,
      flipY
    };
  }

  #nameBlocks(
    slot: number,
    asset: AssetArchiveAsset
  ): void {
    const file = BLOCKSET_FILE.decode(asset.data);
    const atlas = new BlocksetAtlas(file);
    for (const block of file.blocks) {
      const tile = block.defaultTexture;
      this.#blockNames.set(composeBlockId(slot, block.id), block.name);
      this.#blocks.push({
        name: block.name,
        shape: block.shapeId,
        tile: tile === undefined ? "empty" : atlas.coverage(tile.col, tile.row),
        material: block.materialGroup ?? null
      });
    }
    for (const group of file.materialGroups) {
      this.#materials.push({
        id: group.id,
        swatch: group.swatch ?? null
      });
    }
  }

  #blockName(
    blockId: number
  ): string {
    return this.#blockNames.get(blockId) ?? `#${blockId}`;
  }
}

class BlocksetAtlas {
  readonly #tileSize: number;
  readonly #width: number;
  readonly #rgba: Buffer;

  constructor(
    file: BlocksetFile
  ) {
    this.#tileSize = file.tileSize;
    this.#width = file.pixels.size.x;
    this.#rgba = Buffer.from(file.pixels.pixels, "base64");
  }

  coverage(
    col: number,
    row: number
  ): TileCoverage {
    const size = this.#tileSize;
    let opaque = 0;
    for (let y = row * size; y < (row + 1) * size; y++) {
      for (let x = col * size; x < (col + 1) * size; x++) {
        if (this.#rgba[(((y * this.#width) + x) * 4) + 3] > 0) {
          opaque++;
        }
      }
    }

    if (opaque === 0) {
      return "empty";
    }

    return opaque === size * size ? "full" : "partial";
  }
}

function cellKey(
  cell: Cell
): string {
  return `${cell.x},${cell.y},${cell.z}`;
}
