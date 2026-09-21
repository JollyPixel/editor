// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ModelDocument,
  type AddBlockOptions
} from "#src/model/index.ts";
import {
  ModelBlocks,
  type ModelBlock
} from "#src/scene/blocks/index.ts";

export interface ModelFixture {
  document: ModelDocument;
  scene: THREE.Scene;
  blocks: ModelBlocks;
  addBlock(options?: Partial<AddBlockOptions>): ModelBlock;
}

export function createModelFixture(): ModelFixture {
  const document = new ModelDocument();
  const scene = new THREE.Scene();
  const blocks = new ModelBlocks({
    document,
    scene
  });

  return {
    document,
    scene,
    blocks,
    addBlock(options = {}) {
      const id = document.addBlock({
        name: "Block",
        ...options
      });
      const block = id === null ? undefined : blocks.get(id);
      if (block === undefined) {
        throw new Error("The document refused the block.");
      }

      return block;
    }
  };
}
