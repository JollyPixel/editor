// Import Internal Dependencies
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import { VoxelTemplate } from "../../world/templates/VoxelTemplate.ts";
import { inChunkRange } from "../../world/storage/chunkKey.ts";
import { VOXEL_ABSENT } from "../../world/storage/packedVoxel.ts";
import type { TilesetList } from "../../tilesets/TilesetList.ts";
import { InvalidVoxelWorldError } from "../errors/InvalidVoxelWorldError.ts";
import type {
  VoxelChunkData,
  VoxelTemplateData,
  VoxelWorldData
} from "./types.ts";

interface FlatVoxels {
  positions: Int32Array;
  voxels: Uint32Array;
  partners?: Int32Array;
}

export function restoreVoxelWorld(
  data: VoxelWorldData,
  world: VoxelWorld,
  tilesets?: TilesetList
): void {
  assertChunksFit(data, world.chunkSize);

  tilesets?.replace(data.tilesets);
  world.clear();

  for (const layerData of data.layers) {
    const layer = world.restoreLayer({
      id: layerData.id,
      name: layerData.name,
      rank: layerData.rank,
      visible: layerData.visible,
      compositing: layerData.compositing,
      position: layerData.position,
      properties: layerData.properties
    });

    if (data.chunkSize === world.chunkSize) {
      for (const chunk of layerData.chunks) {
        layer.loadPackedChunk(
          [chunk.cx, chunk.cy, chunk.cz],
          chunk.cells,
          chunk.voxels,
          alignedPartners(chunk)
        );
      }
    }
    else {
      const { positions, voxels, partners } = flattenChunks(
        layerData.chunks,
        data.chunkSize
      );
      layer.loadPackedVoxels(positions, voxels, partners);
    }
  }

  world.objectLayers.restore(data.objectLayers);
  world.templates.restore(data.templates.map(restoreVoxelTemplate));
}

export function restoreVoxelTemplate(
  data: VoxelTemplateData
): VoxelTemplate {
  const { positions, voxels, partners } = flattenChunks(
    data.chunks,
    data.chunkSize
  );

  return new VoxelTemplate({
    id: data.id,
    name: data.name,
    pivot: data.pivot,
    properties: data.properties,
    positions,
    voxels,
    partners
  });
}

function flattenChunks(
  chunks: VoxelChunkData[],
  chunkSize: number
): FlatVoxels {
  const shift = Math.log2(chunkSize);
  const mask = chunkSize - 1;

  let total = 0;
  for (const chunk of chunks) {
    total += chunk.cells.length;
  }

  const flat: FlatVoxels = {
    positions: new Int32Array(total * 3),
    voxels: new Uint32Array(total)
  };
  const { positions, voxels } = flat;
  let offset = 0;
  for (const chunk of chunks) {
    const { cx, cy, cz, cells, voxels: packed } = chunk;
    const partners = alignedPartners(chunk);
    if (partners !== undefined) {
      flat.partners ??= new Int32Array(total).fill(VOXEL_ABSENT);
      flat.partners.set(partners, offset);
    }

    const originX = cx * chunkSize;
    const originY = cy * chunkSize;
    const originZ = cz * chunkSize;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      positions[offset * 3] = originX + (cell & mask);
      positions[(offset * 3) + 1] = originY + ((cell >> shift) & mask);
      positions[(offset * 3) + 2] = originZ + (cell >> (shift * 2));
      voxels[offset] = packed[i];
      offset++;
    }
  }

  return flat;
}

function alignedPartners(
  chunk: VoxelChunkData
): Int32Array | undefined {
  const { partners } = chunk;
  if (partners === undefined || partners.cells.length === 0) {
    return undefined;
  }

  const byCell = new Map<number, number>();
  for (let i = 0; i < partners.cells.length; i++) {
    byCell.set(partners.cells[i], partners.voxels[i]);
  }

  const aligned = new Int32Array(chunk.cells.length);
  let matched = 0;
  for (let i = 0; i < chunk.cells.length; i++) {
    const partner = byCell.get(chunk.cells[i]);
    aligned[i] = partner ?? VOXEL_ABSENT;
    matched += partner === undefined ? 0 : 1;
  }
  if (matched !== byCell.size) {
    throw new InvalidVoxelWorldError(
      `chunk [${chunk.cx},${chunk.cy},${chunk.cz}] has a partner without a voxel`
    );
  }

  return aligned;
}

function assertChunksFit(
  data: VoxelWorldData,
  targetChunkSize: number
): void {
  const shift = Math.log2(targetChunkSize);
  const size = data.chunkSize;

  for (const layer of data.layers) {
    for (const chunk of layer.chunks) {
      if (
        !fits(chunk, size, shift, 0) ||
        !fits(chunk, size, shift, size - 1)
      ) {
        throw new InvalidVoxelWorldError(
          `layer "${layer.id}", chunk [${chunk.cx},${chunk.cy},${chunk.cz}] ` +
          `does not fit a world with chunkSize ${targetChunkSize}`
        );
      }
    }
  }
}

function fits(
  chunk: VoxelChunkData,
  size: number,
  shift: number,
  corner: number
): boolean {
  return inChunkRange(
    ((chunk.cx * size) + corner) >> shift,
    ((chunk.cy * size) + corner) >> shift,
    ((chunk.cz * size) + corner) >> shift
  );
}
