// Import Third-party Dependencies
import { decodeRasterCanvas } from "@jolly-pixel/image/browser";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TextureName } from "../TextureName.ts";
import { TextureImportError } from "./errors/TextureImportError.ts";

// CONSTANTS
const kDecodeFailedMessage = "Could not decode the image";

export interface TextureSourceInit {
  canvas: HTMLCanvasElement;
  fileName: string;
  maxTextureSize: number;
}

export class TextureSource {
  static async decode(
    file: File,
    maxTextureSize: number
  ): Promise<TextureSource> {
    let canvas: HTMLCanvasElement;
    try {
      canvas = await decodeRasterCanvas(file);
    }
    catch (cause) {
      throw new TextureImportError(kDecodeFailedMessage, { cause });
    }

    return new TextureSource({
      canvas,
      fileName: file.name,
      maxTextureSize
    });
  }

  readonly canvas: HTMLCanvasElement;
  readonly name: TextureName;

  constructor(
    init: TextureSourceInit
  ) {
    const { canvas, maxTextureSize } = init;
    if (canvas.width <= 0 || canvas.height <= 0) {
      throw new TextureImportError(kDecodeFailedMessage);
    }
    if (canvas.width > maxTextureSize || canvas.height > maxTextureSize) {
      throw new TextureImportError(
        "Image exceeds the maximum texture size of " +
        `${maxTextureSize}×${maxTextureSize}`
      );
    }

    this.canvas = canvas;
    this.name = TextureName.fromPath(init.fileName);
    Object.freeze(this);
  }

  get size(): Vec2 {
    return {
      x: this.canvas.width,
      y: this.canvas.height
    };
  }
}
