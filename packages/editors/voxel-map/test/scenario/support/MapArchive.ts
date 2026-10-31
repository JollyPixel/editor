// Import Node.js Dependencies
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import {
  readAssetArchive,
  type AssetArchive,
  type AssetArchiveAsset
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
  decodeVoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { Cell } from "./viewport.ts";

export interface MapCell extends Cell {
  block: string | null;
}

export type TileCoverage = "empty" | "partial" | "full";

export interface MapLayer {
  name: string;
  voxels: number;
}

export interface MapBlock {
  name: string;
  tile: TileCoverage;
  material: string | null;
}

export interface MapMaterial {
  id: string;
  swatch: string | null;
}

export interface MapExpectation {
  layers: MapLayer[];
  templates: string[];
  blocks: MapBlock[];
  materials: MapMaterial[];
  paintedTiles: number;
  voxelCount: number;
  cells: MapCell[];
}

export class MapArchive {
  static read(
    bytes: Uint8Array
  ): MapArchive {
    const archive = readAssetArchive(bytes);
    if (!archive.ok) {
      throw archive.val;
    }

    return new MapArchive(archive.val);
  }

  readonly rootId: string;
  readonly #state: VoxelMapState;
  readonly #blockNames = new Map<number, string>();
  readonly #blocks: MapBlock[] = [];
  readonly #materials: MapMaterial[] = [];
  #paintedTiles = 0;

  constructor(
    archive: AssetArchive
  ) {
    const map = archive.assets.find((asset) => asset.kind === VOXEL_MAP_KIND);
    if (map === undefined) {
      throw new Error("The archive holds no voxel map.");
    }
    this.rootId = archive.root?.id ?? map.id;

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

  describe(
    cells: Iterable<Cell>
  ): MapExpectation {
    const { world } = this.#state;

    return {
      layers: world.getLayers().map((layer) => {
        return {
          name: layer.name,
          voxels: layer.voxelCount
        };
      }),
      templates: world.templates.toArray().map((template) => template.name),
      blocks: this.#blocks,
      materials: this.#materials,
      paintedTiles: this.#paintedTiles,
      voxelCount: world.voxelCount,
      cells: [...cells].map((cell) => {
        const blockId = world.getVoxelAt(cell)?.blockId;

        return {
          x: cell.x,
          y: cell.y,
          z: cell.z,
          block: blockId === undefined ? null : this.#blockName(blockId)
        };
      })
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
    this.#paintedTiles += atlas.paintedTiles();
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
  readonly #height: number;
  readonly #rgba: Buffer;

  constructor(
    file: BlocksetFile
  ) {
    this.#tileSize = file.tileSize;
    this.#width = file.pixels.size.x;
    this.#height = file.pixels.size.y;
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

  paintedTiles(): number {
    let painted = 0;
    for (let row = 0; row < this.#height / this.#tileSize; row++) {
      for (let col = 0; col < this.#width / this.#tileSize; col++) {
        if (this.coverage(col, row) !== "empty") {
          painted++;
        }
      }
    }

    return painted;
  }
}
