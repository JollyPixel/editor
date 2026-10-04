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
import type { ColorGroup } from "./colorGroups.ts";

export type CanvasBufferOptions = PixelBufferOptions;

export interface CanvasBufferPixelsOptions {
  copy?: boolean;
}

export type CanvasBufferEvent = {
  changed: (
    event: { bounds: SelectionRect; }
  ) => void;
  resized: (
    event: { size: Vec2; }
  ) => void;
  replaced: (
    event: { size: Vec2; }
  ) => void;
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
    this.emit(
      "resized",
      { size: this.#buffer.size() }
    );
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
    this.#buffer.assertSize(sourceSize);

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

    this.emit(
      "replaced",
      { size }
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
    this.emit(
      "replaced",
      { size: this.#buffer.size() }
    );
  }

  pixels(
    options: CanvasBufferPixelsOptions = {}
  ): Uint8ClampedArray {
    const pixels = this.#buffer.pixels();

    return options.copy === false ? pixels : pixels.slice();
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
    this.#refreshPositions(positions);
  }

  drawColorGroups(
    groups: Iterable<ColorGroup>
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
    this.#refreshPositions(positions);
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
    this.#refresh(rect);
  }

  #refreshPositions(
    positions: Vec2[]
  ): void {
    const dirtyArea = RectArea.bounding(
      positions,
      this.#buffer.size()
    );
    if (dirtyArea !== null) {
      this.#refresh(dirtyArea.bounds);
    }
  }

  #refresh(
    bounds: SelectionRect
  ): void {
    this.#resyncCanvasRegion(bounds);
    this.emit(
      "changed",
      { bounds }
    );
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

  samplePixels(
    positions: Vec2[]
  ): RGBA8[] {
    return this.#buffer.samplePixels(positions);
  }

  positionsOf(
    color: RGBA8,
    mask?: Uint8Array
  ): Vec2[] {
    return this.#buffer.positionsOf(color, mask);
  }

  hasTransparency(
    rect: SelectionRect
  ): boolean {
    return this.#buffer.hasTransparency(rect);
  }
}
