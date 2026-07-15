// Import Internal Dependencies
import {
  PixelBuffer,
  type PixelBufferOptions
} from "./PixelBuffer.ts";
import type { DefaultPixelBuffer, RGBA, Vec2 } from "../types.ts";

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
    const imageData = this.#workingCtx.createImageData(size.x, size.y);
    imageData.data.set(this.#buffer.getPixels());
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
   * Wholesale-replaces the pixel data without touching #workingCanvas's
   * identity — used to apply a network snapshot or a remote texture-replaced
   * command, where there is no source canvas/image, only raw bytes.
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

  getPixels(): Uint8ClampedArray {
    return Uint8ClampedArray.from(this.#buffer.getPixels());
  }

  drawPixels(
    pixels: Vec2[],
    color: RGBA
  ): void {
    this.#buffer.drawPixels(pixels, color);

    const size = this.#buffer.getSize();
    for (const pixel of pixels) {
      if (pixel.x < 0 || pixel.x >= size.x || pixel.y < 0 || pixel.y >= size.y) {
        continue;
      }

      const imageData = this.#workingCtx.createImageData(1, 1);
      imageData.data[0] = color.r;
      imageData.data[1] = color.g;
      imageData.data[2] = color.b;
      imageData.data[3] = color.a;
      this.#workingCtx.putImageData(imageData, pixel.x, pixel.y);
    }
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
