// Import Third-party Dependencies
import { pixelArtDocumentKind } from "@jolly-pixel/asset.pixel-art/client";
import {
  voxelModelDocumentKind,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";
import type {
  AssetLease,
  AssetLeases
} from "@jolly-pixel/editor.host";
import type { PixelCanvasTexture } from "@jolly-pixel/editor.pixel-art/mesh-texturing";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  ModelView,
  ModelViewTexture
} from "./ModelView.ts";
import type { VoxelModelSource } from "./VoxelModelSource.ts";
import {
  linkedTextureId,
  type ModelDependencies
} from "./linkedTexture.ts";
import { pixelModelTexture } from "./pixelModelTexture.ts";

// CONSTANTS
export const VOXEL_MODEL_DOCUMENT_KIND = voxelModelDocumentKind();
export const MODEL_TEXTURE_DOCUMENT_KIND = pixelArtDocumentKind();

export interface VoxelModelViewerOptions {
  assets: AssetLeases;
  dependencies: ModelDependencies;
  modelId: string;
}

export class VoxelModelViewer implements VoxelModelSource {
  static readonly kinds = [
    VOXEL_MODEL_DOCUMENT_KIND,
    MODEL_TEXTURE_DOCUMENT_KIND
  ] as const;

  readonly document: ModelDocument;
  readonly texture: ModelViewTexture;
  readonly ready: Promise<void>;
  readonly #model: AssetLease<ModelDocument>;
  readonly #pixels: AssetLease<PixelDocument>;
  readonly #canvas: PixelCanvasTexture;
  readonly #views = new Set<ModelView>();

  readonly #onPixelsChanged = (): void => {
    for (const view of this.#views) {
      view.requestFrame();
    }
  };

  readonly #onTextureResized = (): void => {
    for (const view of this.#views) {
      view.remapTexture();
    }
  };

  constructor(
    options: VoxelModelViewerOptions
  ) {
    const { assets, modelId } = options;
    const textureId = linkedTextureId(options.dependencies, modelId);

    this.#model = assets.open(VOXEL_MODEL_DOCUMENT_KIND, modelId);
    this.#pixels = assets.open(MODEL_TEXTURE_DOCUMENT_KIND, textureId);
    this.document = this.#model.document;
    this.ready = Promise.all([this.#model.ready, this.#pixels.ready])
      .then(() => undefined);
    this.ready.catch(() => undefined);

    const pixels = this.#pixels.document;
    const { canvas, texture } = pixelModelTexture(pixels);
    this.#canvas = canvas;
    this.texture = texture;
    this.#canvas.on("resized", this.#onTextureResized);
    pixels.on("changed", this.#onPixelsChanged);
  }

  attach(
    view: ModelView
  ): () => void {
    this.#views.add(view);

    return () => {
      this.#views.delete(view);
    };
  }

  release(): void {
    this.#views.clear();
    this.#pixels.document.off("changed", this.#onPixelsChanged);
    this.#canvas.dispose();
    this.#pixels.release();
    this.#model.release();
  }
}
