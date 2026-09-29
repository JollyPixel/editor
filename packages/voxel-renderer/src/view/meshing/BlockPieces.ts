// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { ResolvedBlockDefinition } from "../../document/blocks/BlockDefinition.ts";
import { BlockSurface } from "../../document/blocks/BlockSurface.ts";
import { BlockTextures } from "../../document/blocks/BlockTextures.ts";
import type { BlockShapeRegistry } from "../../document/blocks/shape/BlockShapeRegistry.ts";
import { buildShapeGeometry } from "../../document/blocks/shape/shapeGeometry.ts";
import { shapeSlots } from "../../document/blocks/shape/shapeSlots.ts";
import { VoxelTransform } from "../../document/geometry/VoxelTransform.ts";
import { rotateTileUv } from "../../document/tilesets/tileRef.ts";
import type { ResolvedTileRef } from "../../document/tilesets/types.ts";
import type { TilesetAtlases } from "../atlases/TilesetAtlases.ts";
import { tileUvOf } from "./variants/tileUv.ts";

// CONSTANTS
export const BLOCK_PIECE_TEXTURED_GROUP = 0;
export const BLOCK_PIECE_EMPTY_GROUP = 1;

export type EmptyTileProbe = (
  ref: ResolvedTileRef | undefined,
  alphaCutoff: number
) => boolean;

export interface BlockPiecesOptions {
  shapes: BlockShapeRegistry;
  atlases: TilesetAtlases;
  emptyTile?: EmptyTileProbe;
}

export interface BlockPiece {
  readonly geometry: THREE.BufferGeometry;
  readonly texture: THREE.Texture | null;
  readonly surface: BlockSurface;
}

export class BlockPieces {
  readonly #shapes: BlockShapeRegistry;
  readonly #atlases: TilesetAtlases;
  readonly #emptyTile: EmptyTileProbe;
  readonly #pieces = new Map<
    ResolvedBlockDefinition,
    Map<number, BlockPiece | null>
  >();
  #atlasVersion: number;

  constructor(
    options: BlockPiecesOptions
  ) {
    this.#shapes = options.shapes;
    this.#atlases = options.atlases;
    this.#emptyTile = options.emptyTile ?? ((ref) => ref === undefined);
    this.#atlasVersion = options.atlases.version;
  }

  pieceOf(
    block: ResolvedBlockDefinition,
    transform: VoxelTransform = VoxelTransform.Identity
  ): BlockPiece | null {
    if (this.#atlasVersion !== this.#atlases.version) {
      this.#atlasVersion = this.#atlases.version;
      this.clear();
    }

    let byTransform = this.#pieces.get(block);
    if (byTransform === undefined) {
      byTransform = new Map();
      this.#pieces.set(block, byTransform);
    }

    const cached = byTransform.get(transform.packed);
    if (cached !== undefined) {
      return cached;
    }

    const geometry = this.geometryOf(block, transform);
    const piece = geometry === null ?
      null :
      {
        geometry,
        texture: this.textureOf(block),
        surface: new BlockSurface(block)
      };
    byTransform.set(transform.packed, piece);

    return piece;
  }

  geometryOf(
    block: ResolvedBlockDefinition,
    transform: VoxelTransform = VoxelTransform.Identity
  ): THREE.BufferGeometry | null {
    const shape = this.#shapes.get(block.shapeId);
    if (!shape) {
      return null;
    }

    const {
      positions,
      normals,
      uvs,
      indices,
      ranges
    } = buildShapeGeometry(shape, transform);
    const atlasUvs = Float32Array.from(uvs);
    const geometry = new THREE.BufferGeometry();
    const empty = new Set(this.emptySlotsOf(block));
    const textures = BlockTextures.of(block);
    const textured = this.textureOf(block) !== null;

    let indexStart = 0;
    for (const range of ranges) {
      const indexCount = range.definitions.reduce(
        (count, definition) => count + ((definition.vertices.length - 2) * 3),
        0
      );
      const isEmpty = empty.has(range.slot);
      geometry.addGroup(
        indexStart,
        indexCount,
        isEmpty ? BLOCK_PIECE_EMPTY_GROUP : BLOCK_PIECE_TEXTURED_GROUP
      );
      indexStart += indexCount;

      const tileRef = textures.forSlot(range.slot);
      const atlas = tileRef && this.#atlases.resolve(tileRef.tilesetId);
      if (isEmpty || !tileRef || !atlas || !textured) {
        continue;
      }

      const { region, rotation } = tileUvOf(
        atlas,
        tileRef,
        textures.spanFor(range.slot, range.span)
      );
      const end = range.start + range.count;
      for (let index = range.start; index < end; index++) {
        const [u, v] = rotateTileUv(
          uvs[index * 2],
          uvs[(index * 2) + 1],
          rotation
        );
        atlasUvs[index * 2] = region.offsetU + (u * region.scaleU);
        atlasUvs[(index * 2) + 1] = region.offsetV + (v * region.scaleV);
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(atlasUvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    return geometry;
  }

  textureOf(
    block: ResolvedBlockDefinition
  ): THREE.Texture | null {
    return this.#atlases.resolve(block.defaultTexture?.tilesetId)?.texture ??
      null;
  }

  emptySlotsOf(
    block: ResolvedBlockDefinition
  ): string[] {
    const shape = this.#shapes.get(block.shapeId);
    if (!shape) {
      return [];
    }

    const textures = BlockTextures.of(block);
    const { alphaCutoff } = new BlockSurface(block);

    return shapeSlots(shape)
      .map((slot) => slot.id)
      .filter((slot) => this.#emptyTile(textures.forSlot(slot), alphaCutoff));
  }

  clear(): void {
    for (const byTransform of this.#pieces.values()) {
      for (const piece of byTransform.values()) {
        piece?.geometry.dispose();
      }
    }
    this.#pieces.clear();
  }
}
