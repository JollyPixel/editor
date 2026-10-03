// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  IslandMap,
  NormalMap,
  NormalMapConfig,
  type PixelDocumentEvent,
  type SelectionRect,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelTextureSource } from "#src/mesh-texturing/types.ts";

function makeCanvas(
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

export class FakeTextureSource extends Emitter<PixelDocumentEvent> implements PixelTextureSource {
  textureSize: Vec2 = { x: 64, y: 32 };
  normalMap: NormalMapConfig | null = null;
  pixels = new Uint8ClampedArray(64 * 32 * 4);
  readonly normals: NormalMap;
  #canvas = makeCanvas(64, 32);

  constructor() {
    super();
    this.normals = new NormalMap({
      size: () => this.textureSize,
      pixels: () => this.pixels,
      islands: () => IslandMap.fromFaces(this.textureSize, []),
      config: () => this.normalMap,
      connect: () => () => undefined
    });
  }

  get document(): this {
    return this;
  }

  textureCanvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  swapCanvas(
    size: Vec2
  ): void {
    this.#canvas = makeCanvas(size.x, size.y);
    this.textureSize = size;
    this.emit("replaced", { size });
  }

  paint(
    bounds: SelectionRect
  ): void {
    this.emit("changed", { bounds });
  }

  toggleNormalMap(
    config: NormalMapConfig | null
  ): void {
    this.normalMap = config;
    this.emit("normal-map-changed", {
      config,
      regionIds: null
    });
  }
}

export function enableNormalMap(
  source: FakeTextureSource
): void {
  source.toggleNormalMap(NormalMapConfig.create());
}
