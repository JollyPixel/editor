// Import Internal Dependencies
import type { Vec2 } from "./types.ts";

export interface TextureBufferOptions {
  textureSize: Vec2;
  defaultColor?: string;
  maxSize?: number;
}

/**
 * TextureBuffer manages the pixel data for the canvas, providing methods to get and set pixel colors,
 * resize the texture, and copy data between a master canvas and a working canvas.
 */
export class TextureBuffer {
  #masterCanvas: HTMLCanvasElement;
  #masterCtx: CanvasRenderingContext2D;
  #workingCanvas: HTMLCanvasElement;
  #workingCtx: CanvasRenderingContext2D;
  #textureSize: Vec2;
  #maxSize: number;
  #defaultColor: string;

  constructor(
    options: TextureBufferOptions
  ) {
    const {
      defaultColor = "#ffffff",
      maxSize = 2048,
      textureSize
    } = options;

    this.#maxSize = maxSize;
    this.#defaultColor = defaultColor;
    this.#textureSize = structuredClone(textureSize);

    this.#masterCanvas = document.createElement("canvas");
    this.#masterCtx = this.#masterCanvas.getContext("2d", {
      willReadFrequently: true
    })!;

    this.#workingCanvas = document.createElement("canvas");
    this.#workingCtx = this.#workingCanvas.getContext("2d", {
      willReadFrequently: true
    })!;

    this.#initTexture();
  }

  #initTexture(): void {
    this.#masterCanvas.width = this.#maxSize;
    this.#masterCanvas.height = this.#maxSize;
    this.#workingCanvas.width = this.#textureSize.x;
    this.#workingCanvas.height = this.#textureSize.y;

    this.#masterCtx.imageSmoothingEnabled = false;
    this.#workingCtx.imageSmoothingEnabled = false;

    const masterImageData = this.#masterCtx.createImageData(this.#maxSize, this.#maxSize);
    const workingImageData = this.#workingCtx.createImageData(this.#textureSize.x, this.#textureSize.y);

    const tempCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    tempCtx.fillStyle = this.#defaultColor;
    tempCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = tempCtx.getImageData(0, 0, 1, 1).data;

    for (let i = 0; i < masterImageData.data.length; i += 4) {
      const alpha = i === 0 ? 0 : a;
      masterImageData.data[i] = r;
      masterImageData.data[i + 1] = g;
      masterImageData.data[i + 2] = b;
      masterImageData.data[i + 3] = alpha;

      if (i >= workingImageData.data.length) {
        continue;
      }

      workingImageData.data[i] = r;
      workingImageData.data[i + 1] = g;
      workingImageData.data[i + 2] = b;
      workingImageData.data[i + 3] = alpha;
    }

    this.#masterCtx.putImageData(masterImageData, 0, 0);
    this.#workingCtx.putImageData(workingImageData, 0, 0);
  }

  getCanvas(): HTMLCanvasElement {
    return this.#workingCanvas;
  }

  getSize(): Vec2 {
    return { ...this.#textureSize };
  }

  setSize(size: Vec2): void {
    const masterImageData = this.#masterCtx.getImageData(0, 0, this.#maxSize, this.#maxSize);

    this.#textureSize = { ...size };
    this.#workingCanvas.width = size.x;
    this.#workingCanvas.height = size.y;

    const newImageData = this.#workingCtx.createImageData(size.x, size.y);

    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        const masterIndex = (y * this.#maxSize + x) * 4;
        const newIndex = (y * size.x + x) * 4;

        newImageData.data[newIndex] = masterImageData.data[masterIndex];
        newImageData.data[newIndex + 1] = masterImageData.data[masterIndex + 1];
        newImageData.data[newIndex + 2] = masterImageData.data[masterIndex + 2];
        newImageData.data[newIndex + 3] = masterImageData.data[masterIndex + 3];
      }
    }

    this.#workingCtx.putImageData(newImageData, 0, 0);
  }

  setTexture(
    canvas: HTMLCanvasElement
  ): void {
    this.#workingCanvas = canvas;
    this.#workingCtx = canvas.getContext("2d", { willReadFrequently: true })!;
    this.#textureSize = { x: canvas.width, y: canvas.height };
  }

  getPixels(): Uint8ClampedArray {
    return this.#workingCtx.getImageData(0, 0, this.#textureSize.x, this.#textureSize.y).data;
  }

  drawPixels(
    pixels: Vec2[],
    color: { r: number; g: number; b: number; a: number; }
  ): void {
    const { r, g, b, a } = color;

    for (const pixel of pixels) {
      const imageData = this.#workingCtx.getImageData(pixel.x, pixel.y, 1, 1);
      imageData.data[0] = r;
      imageData.data[1] = g;
      imageData.data[2] = b;
      imageData.data[3] = a;
      this.#workingCtx.putImageData(imageData, pixel.x, pixel.y);
    }
  }

  copyToMaster(): void {
    const imageData = this.#workingCtx.getImageData(0, 0, this.#textureSize.x, this.#textureSize.y);
    this.#masterCtx.putImageData(imageData, 0, 0);
  }

  samplePixel(
    x: number,
    y: number
  ): [number, number, number, number] {
    const data = this.#workingCtx.getImageData(x, y, 1, 1).data;

    return [data[0], data[1], data[2], data[3]];
  }
}
