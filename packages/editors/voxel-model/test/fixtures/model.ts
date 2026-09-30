// Import Third-party Dependencies
import * as THREE from "three";
import {
  ModelDocument,
  type AddBlockOptions
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  ModelBlocks,
  type ModelBlock
} from "#src/scene/blocks/index.ts";
import {
  BlockSelectionStore,
  MaterialPreviews
} from "#src/state/index.ts";

export interface ModelFixture {
  document: ModelDocument;
  scene: THREE.Scene;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  previews: MaterialPreviews;
  addBlock(options?: Partial<AddBlockOptions>): ModelBlock;
}

export function createModelFixture(): ModelFixture {
  const document = new ModelDocument();
  const scene = new THREE.Scene();
  const selection = new BlockSelectionStore();
  const previews = new MaterialPreviews();
  const blocks = new ModelBlocks({
    document,
    scene,
    selection,
    previews
  });

  return {
    document,
    scene,
    blocks,
    selection,
    previews,
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
