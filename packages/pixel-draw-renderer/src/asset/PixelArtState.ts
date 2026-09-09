// Import Internal Dependencies
import { PixelBuffer } from "../buffer/PixelBuffer.ts";
import {
  deserializePixelBuffer,
  serializePixelBuffer
} from "../serialization/buffer.ts";
import type { PixelArtDocumentData } from "../serialization/types.ts";
import type { Vec2 } from "../types.ts";

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
