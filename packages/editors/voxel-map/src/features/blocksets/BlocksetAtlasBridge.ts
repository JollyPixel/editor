// Import Third-party Dependencies
import * as THREE from "three";
import type {
  BlocksetAtlas,
  BlocksetDefinition,
  BlocksetDocument,
  BlocksetDocumentListener,
  AtlasImage,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import {
  RectArea,
  type PixelDocument,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import { BlocksetIslands } from "@jolly-pixel/asset.voxel-map/client";
import { NormalMapTexture } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

// Import Internal Dependencies
import type { MapDocument } from "../../document/MapDocument.ts";
import type { BlockWriter } from "./BlocksetBinding.ts";
import { BlocksetEntry } from "./BlocksetEntry.ts";

export interface BlocksetAtlasBridgeOptions {
  view: VoxelView;
  pixels: PixelDocument;
  blockset: BlocksetDocument;
  definition: BlocksetDefinition;
  mapDocument: MapDocument;
  blocks: BlockWriter;
  scheduler?: (callback: () => void) => void;
}

export class BlocksetAtlasBridge {
  readonly #view: VoxelView;
  readonly #pixels: PixelDocument;
  readonly #blockset: BlocksetDocument;
  readonly #mapDocument: MapDocument;
  readonly #blocks: BlockWriter;
  readonly #scheduler: (callback: () => void) => void;
  readonly #unsubscribe: () => void;
  readonly #releaseIslands: () => void;
  #normalTexture: NormalMapTexture | null = null;
  #definition: BlocksetDefinition;
  #atlas: BlocksetAtlas | null = null;
  #dirty: RectArea | null = null;
  #pendingTransparency: RectArea | null = null;
  #needsFullSync = false;
  #running = true;
  #scheduled = false;

  readonly #onChanged = (event: { bounds: SelectionRect; }): void => {
    this.#dirty = this.#dirty?.union(event.bounds) ??
      RectArea.from(event.bounds);
    this.#schedule();
  };

  readonly #onSurfaceChanged = (): void => {
    this.#needsFullSync = true;
    this.#schedule();
  };

  readonly #onBlocksetCommand: BlocksetDocumentListener = (command) => {
    if (command.action === "tile-size-updated") {
      this.#needsFullSync = true;
      this.#schedule();
    }
  };

  readonly #onReset = (): void => {
    this.syncAlphaModes();
  };

  readonly #onNormalMapChanged = (): void => {
    const enabled = this.#pixels.normalMap !== null;
    if (enabled !== (this.#normalTexture !== null)) {
      this.#needsFullSync = true;
      this.#schedule();
    }
  };

  readonly #onNormalsChanged = (): void => {
    this.#view.requestFrame();
  };

  readonly #tick = (): void => {
    this.#scheduled = false;
    if (!this.#running) {
      return;
    }

    this.#flush();
    if (this.#pendingTransparency !== null) {
      this.#schedule();
    }
  };

  constructor(
    options: BlocksetAtlasBridgeOptions
  ) {
    this.#view = options.view;
    this.#pixels = options.pixels;
    this.#blockset = options.blockset;
    this.#definition = options.definition;
    this.#mapDocument = options.mapDocument;
    this.#blocks = options.blocks;
    this.#scheduler = options.scheduler ??
      ((callback) => requestAnimationFrame(callback));
    this.#releaseIslands = new BlocksetIslands({
      blockset: this.#blockset,
      shapes: this.#view.shapes
    }).attachTo(this.#pixels);

    this.#pixels.on("changed", this.#onChanged);
    this.#pixels.on("normal-map-changed", this.#onNormalMapChanged);
    this.#pixels.on("resized", this.#onSurfaceChanged);
    this.#pixels.on("replaced", this.#onSurfaceChanged);
    this.#blockset.on("loaded", this.#onSurfaceChanged);
    this.#blockset.on("command", this.#onBlocksetCommand);
    this.#pixels.normals.on("changed", this.#onNormalsChanged);
    this.#pixels.normals.on("resized", this.#onNormalsChanged);
    this.#unsubscribe = this.#mapDocument.subscribe(
      "reset",
      this.#onReset
    );

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

  syncToThree(): void {
    this.#syncNormalTexture();
    this.#registerAtlas();
    if (this.#atlas === null) {
      return;
    }

    this.#atlas.updateImage(this.#pixels.buffer.canvas());
    this.#view.requestFrame();
    this.syncAlphaModes();
  }

  syncAlphaModes(
    bounds?: SelectionRect
  ): void {
    if (this.#running && this.#mapDocument.ready) {
      this.#blocks.syncAlphaModes(this.#definition.id, bounds);
    }
  }

  destroy(): void {
    this.#running = false;
    this.#pixels.off("changed", this.#onChanged);
    this.#pixels.off("normal-map-changed", this.#onNormalMapChanged);
    this.#pixels.off("resized", this.#onSurfaceChanged);
    this.#pixels.off("replaced", this.#onSurfaceChanged);
    this.#blockset.off("loaded", this.#onSurfaceChanged);
    this.#blockset.off("command", this.#onBlocksetCommand);
    this.#pixels.normals.off("changed", this.#onNormalsChanged);
    this.#pixels.normals.off("resized", this.#onNormalsChanged);
    this.#unsubscribe();
    this.#releaseIslands();
    this.#disposeNormalTexture();
    this.#atlas = null;
  }

  #bind(): void {
    this.#atlas = this.#view.atlases.get(this.#definition.id) ?? null;
    this.#needsFullSync = true;
    this.#flush();
  }

  #schedule(): void {
    if (this.#scheduled || !this.#running) {
      return;
    }

    this.#scheduled = true;
    this.#scheduler(this.#tick);
  }

  #flush(): void {
    const dirty = this.#dirty;
    this.#dirty = null;
    if (this.#needsFullSync) {
      this.#needsFullSync = false;
      this.#pendingTransparency = null;
      this.syncToThree();

      return;
    }
    if (dirty === null) {
      this.#flushTransparency();

      return;
    }
    if (this.#atlas === null) {
      return;
    }

    this.#atlas.updateImage(this.#pixels.buffer.canvas());
    this.#view.requestFrame();
    const pending = this.#pendingTransparency;
    this.#pendingTransparency = pending?.union(dirty.bounds) ?? dirty;
  }

  #flushTransparency(): void {
    const pending = this.#pendingTransparency;
    if (pending !== null) {
      this.#pendingTransparency = null;
      this.syncAlphaModes(pending.bounds);
    }
  }

  #registerAtlas(): void {
    const definition = this.#definition;
    const { tileSize } = this.#blockset;
    const size = this.#pixels.size();
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

    const texture = new THREE.Texture<AtlasImage>(
      this.#pixels.buffer.canvas()
    );
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
    if (this.#pixels.normalMap !== null) {
      this.#normalTexture ??= new NormalMapTexture(this.#pixels.normals);

      return;
    }

    this.#disposeNormalTexture();
  }

  #disposeNormalTexture(): void {
    this.#normalTexture?.dispose();
    this.#normalTexture = null;
  }
}
