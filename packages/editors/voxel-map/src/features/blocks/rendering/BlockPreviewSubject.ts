// Import Third-party Dependencies
import type * as THREE from "three";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "./BlockRenderSources.ts";
import type { TurntableSubject } from "../../preview/SquareTurntable.ts";
import { BlockPreviewMeshes } from "./BlockPreviewMeshes.ts";

export class BlockPreviewSubject implements TurntableSubject {
  readonly #meshes: BlockPreviewMeshes;

  constructor(
    sources: BlockRenderSources
  ) {
    this.#meshes = new BlockPreviewMeshes(sources);
  }

  get mesh(): THREE.Mesh | null {
    return this.#meshes.entries[0]?.mesh ?? null;
  }

  set block(
    block: ResolvedBlockDefinition | null
  ) {
    this.#meshes.sync(block === null ? [] : [block]);
  }

  refresh(
    time: number
  ): void {
    this.#meshes.refresh(time);
  }

  dispose(): void {
    this.#meshes.dispose();
  }
}
