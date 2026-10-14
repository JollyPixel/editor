// Import Third-party Dependencies
import type * as THREE from "three";
import { disposeObject3D } from "@jolly-pixel/engine";
import type {
  BlockPieces,
  BlockRegistry,
  VoxelTemplate
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../../blocks/rendering/BlockRenderSources.ts";
import type { BlockRenderChanges } from "../../blocks/rendering/BlockRenderChanges.ts";
import type { TurntableSubject } from "../../preview/SquareTurntable.ts";
import { buildTemplatePreviewMesh } from "./templatePreviewMesh.ts";

export interface TemplatePreviewSubjectOptions {
  sources: BlockRenderSources;
  blockRegistry: BlockRegistry;
}

export class TemplatePreviewSubject implements TurntableSubject {
  readonly #sources: BlockRenderSources;
  readonly #blockRegistry: BlockRegistry;
  readonly #pieces: BlockPieces;
  readonly #changes: BlockRenderChanges;
  #template: VoxelTemplate | null = null;
  #mesh: THREE.Mesh | null = null;

  constructor(
    options: TemplatePreviewSubjectOptions
  ) {
    this.#sources = options.sources;
    this.#blockRegistry = options.blockRegistry;
    this.#pieces = options.sources.createPieces();
    this.#changes = options.sources.watchChanges();
  }

  get mesh(): THREE.Mesh | null {
    return this.#mesh;
  }

  set template(
    template: VoxelTemplate | null
  ) {
    if (template !== this.#template) {
      this.#template = template;
      this.#rebuild();
    }
  }

  invalidate(): void {
    this.#pieces.clear();
    this.#rebuild();
  }

  refresh(): void {
    const change = this.#changes.poll();
    if (change === "atlases") {
      this.invalidate();
    }
    else if (change === "materialGroups") {
      this.#rebuild();
    }
  }

  dispose(): void {
    this.#disposeMesh();
    this.#pieces.clear();
  }

  #rebuild(): void {
    this.#disposeMesh();
    this.#mesh = this.#template === null ?
      null :
      buildTemplatePreviewMesh(this.#template, {
        pieces: this.#pieces,
        blockRegistry: this.#blockRegistry,
        materialGroups: this.#sources.materialGroups
      });
  }

  #disposeMesh(): void {
    if (this.#mesh !== null) {
      disposeObject3D(this.#mesh);
      this.#mesh = null;
    }
  }
}
