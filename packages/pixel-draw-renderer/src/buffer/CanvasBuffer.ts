// Import Internal Dependencies
import {
  PixelBuffer,
  type PixelBufferOptions
} from "./PixelBuffer.ts";
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type { DefaultPixelBuffer } from "./types.ts";

export type CanvasBufferOptions = PixelBufferOptions;

/**
 * CanvasBuffer is a Canvas2D adapter over a headless PixelBuffer: PixelBuffer
 * is the canonical pixel data (usable server-side with no DOM), and this class
 * keeps a working HTMLCanvasElement in sync with it so CanvasRenderer can blit
 * it directly every frame instead of paying a putImageData cost per draw.
 */
export class CanvasBuffer implements DefaultPixelBuffer {
  #buffer: PixelBuffer;
  #workingCanvas: HTMLCanvasElement;
  #workingCtx: CanvasRenderingContext2D;

  constructor(
    options: CanvasBufferOptions
  ) {
    const { size } = options;

    this.#buffer = new PixelBuffer(options);

    this.#workingCanvas = document.createElement("canvas");
    this.#workingCanvas.width = size.x;
    this.#workingCanvas.height = size.y;
    this.#workingCtx = this.#workingCanvas.getContext("2d", {
      willReadFrequently: true
    })!;
    this.#workingCtx.imageSmoothingEnabled = false;

    this.#syncCanvasFromBuffer();
  }

  #syncCanvasFromBuffer(): void {
    const size = this.#buffer.getSize();
    const imageData = this.#workingCtx.createImageData(
      size.x,
      size.y
    );

    imageData.data.set(
      this.#buffer.getPixels()
    );
    this.#workingCtx.putImageData(imageData, 0, 0);
  }

  getCanvas(): HTMLCanvasElement {
    return this.#workingCanvas;
  }

  getSize(): Vec2 {
    return this.#buffer.getSize();
  }

  setSize(
    size: Vec2
  ): void {
    this.#buffer.setSize(size);
    this.#workingCanvas.width = size.x;
    this.#workingCanvas.height = size.y;

    this.#syncCanvasFromBuffer();
  }

  setTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    let canvas: HTMLCanvasElement;
    // HTMLCanvasElement has getContext(); HTMLImageElement does not.
    if ("getContext" in source) {
      canvas = source;
    }
    else {
      const img = source;
      canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d", {
        willReadFrequently: true
      })!;
      ctx.drawImage(source, 0, 0);
    }

    this.#workingCanvas = canvas;
    this.#workingCtx = canvas.getContext("2d", {
      willReadFrequently: true
    })!;

    const size: Vec2 = {
      x: canvas.width,
      y: canvas.height
    };
    const imageData = this.#workingCtx.getImageData(
      0,
      0,
      size.x,
      size.y
    );
    this.#buffer.setPixels(imageData.data, size);
  }

  /**
   * Replaces the pixel data in place, keeping #workingCanvas's identity —
   * used to apply raw bytes (e.g. a network snapshot) with no source canvas/image.
   */
  setPixels(
    pixels: Uint8ClampedArray,
    size: Vec2
  ): void {
    this.#buffer.setPixels(pixels, size);
    this.#workingCanvas.width = size.x;
    this.#workingCanvas.height = size.y;

    this.#syncCanvasFromBuffer();
  }

  /**
   * Returns a copy — unlike PixelBuffer.getPixels, mutating it won't affect the canvas.
   */
  getPixels(): Uint8ClampedArray {
    return Uint8ClampedArray.from(
      this.#buffer.getPixels()
    );
  }

  /**
   * Syncs the canvas with one putImageData over the affected bounding box,
   * instead of one per pixel (a real cost for large edits like a flood fill).
   */
  drawPixels(
    pixels: Iterable<Vec2>,
    color: RGBA
  ): void {
    const positions = Array.isArray(pixels) ? pixels : [...pixels];
    this.#buffer.drawPixels(positions, color);

    const size = this.#buffer.getSize();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pixel of positions) {
      if (
        pixel.x < 0 || pixel.x >= size.x ||
        pixel.y < 0 || pixel.y >= size.y
      ) {
        continue;
      }

      minX = Math.min(minX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxX = Math.max(maxX, pixel.x);
      maxY = Math.max(maxY, pixel.y);
    }

    if (maxX < minX) {
      return;
    }

    const rectWidth = maxX - minX + 1;
    const rectHeight = maxY - minY + 1;
    const imageData = this.#workingCtx.createImageData(
      rectWidth,
      rectHeight
    );

    for (let y = 0; y < rectHeight; y++) {
      for (let x = 0; x < rectWidth; x++) {
        const [r, g, b, a] = this.#buffer.samplePixel(minX + x, minY + y);
        const index = (y * rectWidth + x) * 4;

        imageData.data[index] = r;
        imageData.data[index + 1] = g;
        imageData.data[index + 2] = b;
        imageData.data[index + 3] = a;
      }
    }

    this.#workingCtx.putImageData(imageData, minX, minY);
  }

  /**
   * Syncs the canvas with one putImageData over the in-bounds intersection
   * of `rect` — the multi-color counterpart to drawPixels.
   */
  drawRegion(
    rect: SelectionRect,
    pixels: RGBA[]
  ): void {
    this.#buffer.drawRegion(rect, pixels);

    const size = this.#buffer.getSize();
    const minX = Math.max(0, rect.x);
    const minY = Math.max(0, rect.y);
    const maxX = Math.min(size.x, rect.x + rect.width);
    const maxY = Math.min(size.y, rect.y + rect.height);
    if (maxX <= minX || maxY <= minY) {
      return;
    }

    const clipWidth = maxX - minX;
    const clipHeight = maxY - minY;
    const imageData = this.#workingCtx.createImageData(
      clipWidth,
      clipHeight
    );

    for (let y = 0; y < clipHeight; y++) {
      for (let x = 0; x < clipWidth; x++) {
        const [r, g, b, a] = this.#buffer.samplePixel(minX + x, minY + y);
        const index = (y * clipWidth + x) * 4;

        imageData.data[index] = r;
        imageData.data[index + 1] = g;
        imageData.data[index + 2] = b;
        imageData.data[index + 3] = a;
      }
    }

    this.#workingCtx.putImageData(imageData, minX, minY);
  }

  copyToMaster(): void {
    this.#buffer.copyToMaster();
  }

  samplePixel(
    x: number,
    y: number
  ): [number, number, number, number] {
    return this.#buffer.samplePixel(x, y);
  }
}
