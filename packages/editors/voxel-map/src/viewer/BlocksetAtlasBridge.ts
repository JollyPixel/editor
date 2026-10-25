// Import Third-party Dependencies
import * as THREE from "three";
import type {
  BlocksetAtlas,
  BlocksetDefinition,
  AtlasImage,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import { NormalMapTexture } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

// Import Internal Dependencies
import { BlocksetEntry } from "./BlocksetEntry.ts";
import type { BlocksetSurface } from "./BlocksetSurface.ts";

export interface BlocksetAtlasBridgeOptions {
  view: VoxelView;
  surface: BlocksetSurface;
  definition: BlocksetDefinition;
}

export class BlocksetAtlasBridge {
  readonly #view: VoxelView;
  readonly #surface: BlocksetSurface;
  #normalTexture: NormalMapTexture | null = null;
  #definition: BlocksetDefinition;
  #atlas: BlocksetAtlas | null = null;

  readonly #onChanged = (): void => {
    this.#uploadImage();
  };

  readonly #onReset = (): void => {
    this.#sync();
  };

  readonly #onNormalsChanged = (): void => {
    this.#view.requestFrame();
  };

  constructor(
    options: BlocksetAtlasBridgeOptions
  ) {
    this.#view = options.view;
    this.#surface = options.surface;
    this.#definition = options.definition;

    const { normals } = this.#surface.pixels;
    this.#surface.on("changed", this.#onChanged);
    this.#surface.on("reset", this.#onReset);
    normals.on("changed", this.#onNormalsChanged);
    normals.on("resized", this.#onNormalsChanged);

    this.#bind();
  }

  update(
    definition: BlocksetDefinition
  ): void {
    if (BlocksetEntry.sameDefinition(definition, this.#definition)) {
      return;
    }

    this.#definition = definition;
    this.#bind();
  }

  destroy(): void {
    const { normals } = this.#surface.pixels;
    this.#surface.off("changed", this.#onChanged);
    this.#surface.off("reset", this.#onReset);
    normals.off("changed", this.#onNormalsChanged);
    normals.off("resized", this.#onNormalsChanged);
    this.#disposeNormalTexture();
    this.#atlas = null;
  }

  #bind(): void {
    this.#atlas = this.#view.atlases.get(this.#definition.id) ?? null;
    this.#sync();
  }

  #sync(): void {
    this.#syncNormalTexture();
    this.#registerAtlas();
    this.#uploadImage();
  }

  #uploadImage(): void {
    if (this.#atlas === null) {
      return;
    }

    this.#atlas.updateImage(this.#surface.pixels.buffer.canvas());
    this.#view.requestFrame();
  }

  #registerAtlas(): void {
    const definition = this.#definition;
    const { pixels, blockset } = this.#surface;
    const { tileSize } = blockset;
    const size = pixels.size();
    const cols = Math.floor(size.x / tileSize);
    const rows = Math.floor(size.y / tileSize);
    const current = this.#atlas?.def;
    const normal = this.#normalTexture?.texture ?? null;
    const unchanged = current !== undefined &&
      current.tileSize === tileSize &&
      current.cols === cols &&
      current.rows === rows &&
      this.#atlas?.normal === normal;
    if (unchanged || cols === 0 || rows === 0) {
      return;
    }

    const texture = new THREE.Texture<AtlasImage>(pixels.buffer.canvas());
    texture.needsUpdate = true;
    const {
      cols: _cols,
      rows: _rows,
      ...source
    } = definition;
    this.#view.loadBlockset(
      {
        ...source,
        tileSize
      },
      texture,
      normal === null ? {} : { normal }
    );
    this.#atlas = this.#view.atlases.requireLoadedAtlas(definition.id);
  }

  #syncNormalTexture(): void {
    const { pixels } = this.#surface;
    if (pixels.normalMap !== null) {
      this.#normalTexture ??= new NormalMapTexture(pixels.normals);

      return;
    }

    this.#disposeNormalTexture();
  }

  #disposeNormalTexture(): void {
    this.#normalTexture?.dispose();
    this.#normalTexture = null;
  }
}
