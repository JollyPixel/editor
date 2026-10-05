// Import Internal Dependencies
import {
  cullsCoveredFaces,
  type ResolvedBlockDefinition
} from "../../document/blocks/BlockDefinition.ts";
import type { ResolvedTileRef } from "../../document/tilesets/types.ts";

export type BlockRedefinition = "tiles" | "cells" | "neighbours";

interface BlockKeys {
  neighbours: string;
  mesh: string;
}

export class BlockReach {
  #keys = new Map<number, BlockKeys>();

  reset(
    blocks: Iterable<ResolvedBlockDefinition>
  ): void {
    this.#keys.clear();
    for (const block of blocks) {
      this.#keys.set(block.id, keysOf(block));
    }
  }

  redefine(
    block: ResolvedBlockDefinition
  ): BlockRedefinition {
    const keys = keysOf(block);
    const previous = this.#keys.get(block.id);
    this.#keys.set(block.id, keys);

    if (
      previous?.neighbours !== keys.neighbours ||
      block.blendGroup !== undefined
    ) {
      return "neighbours";
    }

    return previous.mesh === keys.mesh ? "tiles" : "cells";
  }

  forget(
    blockId: number
  ): void {
    this.#keys.delete(blockId);
  }
}

function keysOf(
  block: ResolvedBlockDefinition
): BlockKeys {
  return {
    neighbours: JSON.stringify([
      block.shapeId,
      block.alphaMode ?? "opaque",
      cullsCoveredFaces(block),
      block.blendGroup ?? null
    ]),
    mesh: meshKeyOf(block)
  };
}

function meshKeyOf(
  block: ResolvedBlockDefinition
): string {
  const {
    name: _name,
    properties: _properties,
    defaultTexture,
    faceTextures,
    ...meshed
  } = block;

  return JSON.stringify([
    sortedEntries(meshed),
    defaultTexture && tileFrameOf(defaultTexture),
    sortedEntries(faceTextures).map(([slot, tile]) => [slot, tileFrameOf(tile)])
  ]);
}

function sortedEntries<T>(
  record: Record<string, T>
): Array<[string, T]> {
  return Object.entries(record).sort(
    ([left], [right]) => (left < right ? -1 : 1)
  );
}

function tileFrameOf(
  tile: ResolvedTileRef
): [string | null, number] {
  return [tile.tilesetId ?? null, tile.rotation ?? 0];
}
