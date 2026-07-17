// Import Internal Dependencies
import {
  PixelBuffer,
  type PixelBufferOptions
} from "../buffer/PixelBuffer.ts";

/**
 * Headless, multi-buffer registry. Used by PixelSyncServer as the
 * authoritative store for every buffer (texture) shared in a session.
 *
 * Has no DOM/Canvas2D dependency and runs in Node.js / Deno / Bun.
 */
export class PixelWorld {
  #buffers = new Map<string, PixelBuffer>();

  addBuffer(
    bufferId: string,
    options: PixelBufferOptions
  ): PixelBuffer {
    if (this.#buffers.has(bufferId)) {
      throw new Error(`Buffer "${bufferId}" already exists`);
    }

    const buffer = new PixelBuffer(options);
    this.#buffers.set(bufferId, buffer);

    return buffer;
  }

  removeBuffer(
    bufferId: string
  ): void {
    this.#buffers.delete(bufferId);
  }

  getBuffer(
    bufferId: string
  ): PixelBuffer | undefined {
    return this.#buffers.get(bufferId);
  }

  hasBuffer(
    bufferId: string
  ): boolean {
    return this.#buffers.has(bufferId);
  }

  getBufferIds(): IterableIterator<string> {
    return this.#buffers.keys();
  }
}
