// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  PixelBuffer,
  type PixelBufferOptions
} from "./PixelBuffer.ts";
import { RectArea } from "../utils/RectArea.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  DefaultPixelBuffer
} from "./types.ts";

interface CanvasColorGroup {
  color: RGBA8;
  positions: Vec2[];
}

export type CanvasBufferOptions = PixelBufferOptions;

/**
 * Fired after a pixel mutation that changes the visible working canvas
 */
export type CanvasBufferEvent = {
  changed: () => void;
};

export class CanvasBuffer extends Emitter<
  CanvasBufferEvent
> implements DefaultPixelBuffer {
  #buffer: PixelBuffer;
  #workingCanvas: HTMLCanvasElement;
  #workingCtx: CanvasRenderingContext2D;

  constructor(
    options: CanvasBufferOptions
  ) {
    super();

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
    const size = this.#buffer.size();
    const imageData = this.#workingCtx.createImageData(
      size.x,
      size.y
    );

    imageData.data.set(
      this.#buffer.pixels()
    );
    this.#workingCtx.putImageData(imageData, 0, 0);
  }

  canvas(): HTMLCanvasElement {
    return this.#workingCanvas;
  }

  size(): Vec2 {
    return this.#buffer.size();
  }

  get maxSize(): number {
    return this.#buffer.maxSize;
  }

  resize(
    size: Vec2
  ): void {
    this.#buffer.resize(size);
    this.#workingCanvas.width = size.x;
    this.#workingCanvas.height = size.y;

    this.#syncCanvasFromBuffer();
  }

  loadTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    const sourceSize: Vec2 = "getContext" in source ?
      { x: source.width, y: source.height } :
      {
        x: source.naturalWidth || source.width,
        y: source.naturalHeight || source.height
      };
    if (
      !Number.isInteger(sourceSize.x) ||
      !Number.isInteger(sourceSize.y) ||
      sourceSize.x <= 0 ||
      sourceSize.y <= 0 ||
      sourceSize.x > this.maxSize ||
      sourceSize.y > this.maxSize
    ) {
      throw new RangeError(
        `PixelBuffer dimensions must be positive integers no greater than ${this.maxSize}`
      );
    }

    let canvas: HTMLCanvasElement;
    if ("getContext" in source) {
      canvas = source;
    }
    else {
      canvas = document.createElement("canvas");
      canvas.width = sourceSize.x;
      canvas.height = sourceSize.y;
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
    this.#buffer.replacePixels(
      imageData.data,
      size
    );
  }

  replacePixels(
    pixels: Uint8ClampedArray,
    size: Vec2
  ): void {
    this.#buffer.replacePixels(
      pixels,
      size
    );
    this.#workingCanvas.width = size.x;
    this.#workingCanvas.height = size.y;

    this.#syncCanvasFromBuffer();
  }

  pixels(): Uint8ClampedArray {
    return this.#buffer.pixels().slice();
  }

  drawPixels(
    pixels: Iterable<Vec2>,
    color: RGBA8
  ): void {
    const positions = Array.isArray(pixels) ? pixels : [...pixels];
    this.#buffer.drawPixels(
      positions,
      color
    );

    const size = this.#buffer.size();
    const dirtyArea = RectArea.bounding(
      positions,
      size
    );
    if (dirtyArea === null) {
      return;
    }

    this.#resyncCanvasRegion(dirtyArea.bounds);
    this.emit("changed");
  }

  drawColorGroups(
    groups: Iterable<CanvasColorGroup>
  ): void {
    const positions: Vec2[] = [];

    for (const group of groups) {
      this.#buffer.drawPixels(
        group.positions,
        group.color
      );
      for (const position of group.positions) {
        positions.push(position);
      }
    }

    const size = this.#buffer.size();
    const dirtyArea = RectArea.bounding(
      positions,
      size
    );
    if (dirtyArea === null) {
      return;
    }

    this.#resyncCanvasRegion(dirtyArea.bounds);
    this.emit("changed");
  }

  drawRegion(
    rect: SelectionRect,
    pixels: RGBA8[]
  ): void {
    this.#buffer.drawRegion(
      rect,
      pixels
    );
    this.#resyncCanvasRegion(rect);
    this.emit("changed");
  }

  drawMaskedRegion(
    rect: SelectionRect,
    pixels: RGBA8[],
    mask: boolean[]
  ): void {
    this.#buffer.drawMaskedRegion(
      rect,
      pixels,
      mask
    );
    this.#resyncCanvasRegion(rect);
    this.emit("changed");
  }

  #resyncCanvasRegion(
    rect: SelectionRect
  ): void {
    const size = this.#buffer.size();
    const area = RectArea.from(rect);
    const clipped = area.intersection(size);
    if (clipped === null) {
      return;
    }

    const imageData = this.#workingCtx.createImageData(
      clipped.width,
      clipped.height
    );
    const pixels = this.#buffer.pixels();
    let destinationIndex = 0;

    for (const row of area.rowsWithin(size)) {
      const sourceIndex = row.indexInBounds * 4;
      const byteLength = row.length * 4;
      imageData.data.set(
        pixels.subarray(
          sourceIndex,
          sourceIndex + byteLength
        ),
        destinationIndex
      );
      destinationIndex += byteLength;
    }

    this.#workingCtx.putImageData(
      imageData,
      clipped.x,
      clipped.y
    );
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

  /**
   * Returns transparent pixels for out-of-bounds positions.
   */
  samplePixels(
    positions: Vec2[]
  ): RGBA8[] {
    return this.#buffer.samplePixels(positions);
  }

  hasTransparency(
    rect: SelectionRect
  ): boolean {
    return this.#buffer.hasTransparency(rect);
  }
}
