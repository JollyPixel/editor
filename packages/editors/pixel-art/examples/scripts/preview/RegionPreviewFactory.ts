// Import Third-party Dependencies
import * as THREE from "three";
import {
  Systems,
  type Actor
} from "@jolly-pixel/engine";
import type {
  UVRegion,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  RegionPreviewBehavior,
  type RegionPreview
} from "./RegionPreviewBehavior.ts";

export interface RegionPreviewFactoryOptions {
  world: Systems.World;
  canvasTexture: THREE.CanvasTexture;
}

export interface RegionPreviewFactoryContract {
  create(region: UVRegion, textureSize: Vec2): RegionPreview;
  destroy(preview: RegionPreview): void;
}

export class RegionPreviewFactory implements RegionPreviewFactoryContract {
  readonly #actors = new WeakMap<RegionPreview, Actor>();
  #world: Systems.World;
  #canvasTexture: THREE.CanvasTexture;

  constructor(
    options: RegionPreviewFactoryOptions
  ) {
    this.#world = options.world;
    this.#canvasTexture = options.canvasTexture;
  }

  create(
    region: UVRegion,
    textureSize: Vec2
  ): RegionPreviewBehavior {
    const actor = this.#world.createActor(`uv-preview-${region.id}`);
    const preview = actor.addComponentAndGet(RegionPreviewBehavior, {
      canvasTexture: this.#canvasTexture,
      region,
      textureSize
    });
    this.#actors.set(preview, actor);

    return preview;
  }

  destroy(
    preview: RegionPreview
  ): void {
    this.#actors.get(preview)?.destroy();
    this.#actors.delete(preview);
  }
}
