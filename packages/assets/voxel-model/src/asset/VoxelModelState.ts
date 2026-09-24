// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  VOXEL_MODEL_DOCUMENT_VERSION,
  type VoxelModelDocument
} from "./document.ts";
import { InvalidVoxelModelDocumentError } from "./InvalidVoxelModelDocumentError.ts";
import { ModelTree } from "../model/ModelTree.ts";
import type {
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../network/types.ts";

export class VoxelModelState {
  #tree = new ModelTree();
  #texture: AssetReferenceData | null = null;

  get texture(): AssetReferenceData | null {
    return this.#texture === null ?
      null :
      { ...this.#texture };
  }

  load(
    document: VoxelModelDocument
  ): void {
    this.#tree.load(document.nodes);
    this.#texture = {
      id: document.texture.id,
      kind: document.texture.kind
    };
  }

  clear(): void {
    this.#tree.clear();
    this.#texture = null;
  }

  accepts(
    command: VoxelModelCommand
  ): boolean {
    return this.#tree.accepts(command);
  }

  applyCommand(
    command: VoxelModelCommand
  ): void {
    this.#tree.apply(command);
  }

  dependencies(): AssetReferenceData[] {
    return this.#texture === null ? [] : [{ ...this.#texture }];
  }

  snapshot(): VoxelModelSnapshot {
    return {
      nodes: this.#tree.toJSON()
    };
  }

  toJSON(): VoxelModelDocument {
    if (this.#texture === null) {
      throw new InvalidVoxelModelDocumentError("texture is missing");
    }

    return {
      version: VOXEL_MODEL_DOCUMENT_VERSION,
      ...this.snapshot(),
      texture: { ...this.#texture }
    };
  }
}
