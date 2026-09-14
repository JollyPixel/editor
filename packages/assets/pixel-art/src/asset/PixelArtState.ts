// Import Third-party Dependencies
import {
  deserializePixelBuffer,
  PixelBuffer,
  serializePixelBuffer,
  type PixelArtDocumentData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export class PixelArtState {
  readonly buffer: PixelBuffer;

  #defaultSize: Vec2;

  constructor(
    size: Vec2
  ) {
    this.#defaultSize = size;
    this.buffer = new PixelBuffer({
      size
    });
  }

  toJSON(): PixelArtDocumentData {
    return serializePixelBuffer(this.buffer);
  }

  load(
    document: PixelArtDocumentData
  ): void {
    deserializePixelBuffer(
      document,
      this.buffer
    );
  }

  clear(): void {
    const { x, y } = this.#defaultSize;

    this.buffer.replacePixels(
      new Uint8ClampedArray(x * y * 4),
      this.#defaultSize
    );
    this.buffer.uvRegions.clear();
  }
}
