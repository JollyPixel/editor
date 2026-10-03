// Import Third-party Dependencies
import type {
  NormalMap,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import { encodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import { PngFile } from "../shared/PngFile.ts";

export type NormalMapConvention = "opengl" | "directx";

export class NormalMapPng {
  static readonly FILE_NAME = "texture.normal.png";

  static capture(
    normals: NormalMap,
    convention: NormalMapConvention
  ): NormalMapPng {
    const release = normals.retain();
    try {
      normals.flush();

      return new NormalMapPng(
        normals.size,
        normals.pixels,
        convention
      );
    }
    finally {
      release();
    }
  }

  readonly size: Readonly<Vec2>;
  readonly pixels: Uint8ClampedArray;
  readonly convention: NormalMapConvention;

  constructor(
    size: Vec2,
    pixels: Uint8Array | Uint8ClampedArray,
    convention: NormalMapConvention
  ) {
    this.size = Object.freeze({
      x: size.x,
      y: size.y
    });
    this.pixels = new Uint8ClampedArray(pixels);
    this.convention = convention;
    if (convention === "directx") {
      for (let index = 1; index < this.pixels.length; index += 4) {
        this.pixels[index] = 255 - this.pixels[index];
      }
    }
  }

  encode(): Promise<Uint8Array<ArrayBuffer>> {
    return encodePng({
      width: this.size.x,
      height: this.size.y,
      data: this.pixels
    });
  }

  async download(): Promise<void> {
    new PngFile(
      NormalMapPng.FILE_NAME,
      await this.encode()
    ).download();
  }
}
