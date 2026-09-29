// Import Internal Dependencies
import {
  cullsCoveredFaces,
  type ResolvedBlockDefinition
} from "../../document/blocks/BlockDefinition.ts";

export class BlockReach {
  #keys = new Map<number, string>();

  reset(
    blocks: Iterable<ResolvedBlockDefinition>
  ): void {
    this.#keys.clear();
    for (const block of blocks) {
      this.#keys.set(block.id, neighbourKeyOf(block));
    }
  }

  redefine(
    block: ResolvedBlockDefinition
  ): boolean {
    const key = neighbourKeyOf(block);
    const previous = this.#keys.get(block.id);
    this.#keys.set(block.id, key);

    return previous !== key || block.blendGroup !== undefined;
  }

  forget(
    blockId: number
  ): void {
    this.#keys.delete(blockId);
  }
}

function neighbourKeyOf(
  block: ResolvedBlockDefinition
): string {
  return JSON.stringify([
    block.shapeId,
    block.alphaMode ?? "opaque",
    cullsCoveredFaces(block),
    block.blendGroup ?? null
  ]);
}
