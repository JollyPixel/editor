// Canvas 2D fixture. happy-dom provides real <canvas> elements (events,
// sizing, DOM tree, style) but no 2D rendering context, so installCanvasMock
// patches getContext("2d") to return a pixel-backed MockCanvas2DContext. Only
// the context is emulated; the element itself is happy-dom's own.

// Helpers
function parseCSSColor(
  color: string
): [number, number, number, number] {
  if (color.startsWith("#")) {
    const hex = color.slice(1).padEnd(6, "0");

    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255
    ];
  }

  const match = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (match) {
    return [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4] === undefined ?
        255 :
        Math.round(parseFloat(match[4]) * 255)
    ];
  }

  return [0, 0, 0, 255];
}

function isCanvasSource(
  source: unknown
): source is HTMLCanvasElement {
  return typeof (
    source as { getContext?: unknown; }
  ).getContext === "function";
}

// Mock ImageData
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(
    width: number,
    height: number
  ) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(
      width * height * 4
    );
  }
}

// Mock 2D Context, backed by an RGBA buffer sized to the live canvas.
export class MockCanvas2DContext {
  fillStyle = "#000000";
  globalCompositeOperation: GlobalCompositeOperation = "source-over";
  imageSmoothingEnabled = false;
  putImageDataCallCount = 0;
  drawImageCallCount = 0;
  readonly canvas: HTMLCanvasElement;

  #pixels: Uint8ClampedArray;
  #width: number;
  #height: number;
  #compositeStack: GlobalCompositeOperation[] = [];

  constructor(
    canvas: HTMLCanvasElement
  ) {
    this.canvas = canvas;
    this.#width = canvas.width;
    this.#height = canvas.height;
    this.#pixels = new Uint8ClampedArray(
      this.#width * this.#height * 4
    );
  }

  // The RGBA buffer backing this context, resynced to the canvas size.
  get pixels(): Uint8ClampedArray {
    this.#syncSize();

    return this.#pixels;
  }

  // Passes this fixture where the source code expects a real 2D context.
  asRenderingContext(): CanvasRenderingContext2D {
    return this as unknown as CanvasRenderingContext2D;
  }

  // Setting canvas.width/height clears the canvas in a browser; mirror that by
  // reallocating a zeroed buffer whenever the live dimensions change.
  #syncSize(): void {
    if (
      this.canvas.width === this.#width &&
      this.canvas.height === this.#height
    ) {
      return;
    }
    this.#width = this.canvas.width;
    this.#height = this.canvas.height;
    this.#pixels = new Uint8ClampedArray(
      this.#width * this.#height * 4
    );
  }

  setTransform(..._args: unknown[]): void {
    // No-op for testing
  }
  beginPath(): void {
    // No-op for testing
  }
  save(): void {
    this.#compositeStack.push(this.globalCompositeOperation);
  }
  restore(): void {
    const compositeOperation = this.#compositeStack.pop();
    if (compositeOperation !== undefined) {
      this.globalCompositeOperation = compositeOperation;
    }
  }
  clip(): void {
    // No-op for testing
  }
  rect(..._args: unknown[]): void {
    // No-op for testing
  }

  /**
   * Nearest-neighbor blit supporting the 3/5/9-argument drawImage overloads
   * and the compositing modes used by the renderer. Non-canvas sources are
   * silently ignored, matching CanvasBuffer.loadTexture()'s image-source path.
   */
  drawImage(
    image: unknown,
    ...args: number[]
  ): void {
    this.drawImageCallCount++;
    if (!isCanvasSource(image)) {
      return;
    }

    const srcPixels = mockContextOf(image).pixels;
    const srcWidth = image.width;

    let sx = 0;
    let sy = 0;
    let sw = image.width;
    let sh = image.height;
    let dx: number;
    let dy: number;
    let dw: number;
    let dh: number;

    if (args.length === 2) {
      [dx, dy] = args;
      dw = sw;
      dh = sh;
    }
    else if (args.length === 4) {
      [dx, dy, dw, dh] = args;
    }
    else if (args.length === 8) {
      [sx, sy, sw, sh, dx, dy, dw, dh] = args;
    }
    else {
      return;
    }

    this.#syncSize();
    const destPixels = this.#pixels;
    const destWidth = this.#width;
    const destHeight = this.#height;

    for (let py = 0; py < dh; py++) {
      const destY = Math.floor(dy) + py;
      if (destY < 0 || destY >= destHeight) {
        continue;
      }
      const srcY = sy + Math.floor((py / dh) * sh);

      for (let px = 0; px < dw; px++) {
        const destX = Math.floor(dx) + px;
        if (destX < 0 || destX >= destWidth) {
          continue;
        }
        const srcX = sx + Math.floor((px / dw) * sw);

        const srcIdx = (srcY * srcWidth + srcX) * 4;
        const destIdx = (destY * destWidth + destX) * 4;
        this.#compositePixel(destPixels, destIdx, srcPixels, srcIdx);
      }
    }
  }

  #compositePixel(
    destPixels: Uint8ClampedArray,
    destIdx: number,
    srcPixels: Uint8ClampedArray,
    srcIdx: number
  ): void {
    const srcAlpha = srcPixels[srcIdx + 3] / 255;
    const destAlpha = destPixels[destIdx + 3] / 255;

    if (this.globalCompositeOperation === "destination-out") {
      const outAlpha = destAlpha * (1 - srcAlpha);
      destPixels[destIdx + 3] = Math.round(outAlpha * 255);
      if (outAlpha === 0) {
        destPixels[destIdx] = 0;
        destPixels[destIdx + 1] = 0;
        destPixels[destIdx + 2] = 0;
      }

      return;
    }

    const outAlpha = srcAlpha + destAlpha * (1 - srcAlpha);
    if (outAlpha === 0) {
      destPixels[destIdx] = 0;
      destPixels[destIdx + 1] = 0;
      destPixels[destIdx + 2] = 0;
      destPixels[destIdx + 3] = 0;

      return;
    }

    for (let channel = 0; channel < 3; channel++) {
      const src = srcPixels[srcIdx + channel];
      const dest = destPixels[destIdx + channel];
      destPixels[destIdx + channel] = Math.round(
        (
          src * srcAlpha +
          dest * destAlpha * (1 - srcAlpha)
        ) / outAlpha
      );
    }
    destPixels[destIdx + 3] = Math.round(outAlpha * 255);
  }

  clearRect(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.#syncSize();
    const minX = Math.max(0, x);
    const minY = Math.max(0, y);
    const maxX = Math.min(x + width, this.#width);
    const maxY = Math.min(y + height, this.#height);

    for (let py = minY; py < maxY; py++) {
      for (let px = minX; px < maxX; px++) {
        const index = (py * this.#width + px) * 4;
        this.#pixels.fill(0, index, index + 4);
      }
    }
  }

  fillRect(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.#syncSize();
    const [r, g, b, a] = parseCSSColor(this.fillStyle);
    const pixels = this.#pixels;
    const cw = this.#width;
    const ch = this.#height;

    for (let py = Math.max(0, y); py < Math.min(y + height, ch); py++) {
      for (let px = Math.max(0, x); px < Math.min(x + width, cw); px++) {
        const idx = (py * cw + px) * 4;

        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = a;
      }
    }
  }

  createImageData(
    width: number,
    height: number
  ): MockImageData {
    return new MockImageData(width, height);
  }

  getImageData(
    x: number,
    y: number,
    width: number,
    height: number
  ): MockImageData {
    this.#syncSize();
    const result = new MockImageData(width, height);
    const pixels = this.#pixels;
    const cw = this.#width;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const srcIdx = ((y + py) * cw + (x + px)) * 4;
        const dstIdx = (py * width + px) * 4;

        result.data[dstIdx] = pixels[srcIdx] ?? 0;
        result.data[dstIdx + 1] = pixels[srcIdx + 1] ?? 0;
        result.data[dstIdx + 2] = pixels[srcIdx + 2] ?? 0;
        result.data[dstIdx + 3] = pixels[srcIdx + 3] ?? 0;
      }
    }

    return result;
  }

  putImageData(
    imageData: MockImageData,
    x: number,
    y: number
  ): void {
    this.putImageDataCallCount++;
    this.#syncSize();
    const pixels = this.#pixels;
    const cw = this.#width;
    const ch = this.#height;

    for (let py = 0; py < imageData.height; py++) {
      for (let px = 0; px < imageData.width; px++) {
        const dstX = x + px;
        const dstY = y + py;

        if (
          dstX < 0 || dstX >= cw ||
          dstY < 0 || dstY >= ch
        ) {
          continue;
        }

        const srcIdx = (py * imageData.width + px) * 4;
        const dstIdx = (dstY * cw + dstX) * 4;
        pixels[dstIdx] = imageData.data[srcIdx];
        pixels[dstIdx + 1] = imageData.data[srcIdx + 1];
        pixels[dstIdx + 2] = imageData.data[srcIdx + 2];
        pixels[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
  }
}

/**
 * Patches doc.createElement so a "canvas" gets a working mock 2D context
 * (happy-dom's own getContext returns null). The element stays happy-dom's,
 * keeping real events, sizing, and DOM-tree behavior.
 */
export function installCanvasMock(
  doc: Document
): void {
  const createElement = doc.createElement.bind(doc);
  Object.assign(doc, {
    createElement(
      tagName: string,
      options?: ElementCreationOptions
    ) {
      const element = createElement(
        tagName,
        options
      );
      if (tagName.toLowerCase() === "canvas") {
        const context = new MockCanvas2DContext(
          element as HTMLCanvasElement
        );
        Object.assign(element, {
          getContext: (type: string) => (
            type === "2d" ? context : null
          )
        });
      }

      return element;
    }
  });
}

/**
 * Returns the mock 2D context patched onto a canvas by installCanvasMock,
 * exposing `.pixels` and `.putImageDataCallCount` for assertions.
 */
export function mockContextOf(
  canvas: HTMLCanvasElement
): MockCanvas2DContext {
  const context = canvas.getContext(
    "2d"
  ) as unknown as MockCanvas2DContext | null;
  if (context === null) {
    throw new Error(
      "canvas was not created through installCanvasMock"
    );
  }

  return context;
}

/** The RGBA pixel buffer backing a mocked canvas. */
export function canvasPixels(
  canvas: HTMLCanvasElement
): Uint8ClampedArray {
  return mockContextOf(canvas).pixels;
}

/** Reads the RGBA tuple at (pos.x, pos.y) from a row-major pixel buffer. */
export function readPixel(
  pixels: Uint8ClampedArray,
  pos: { x: number; y: number; },
  width: number
): [number, number, number, number] {
  const i = (pos.y * width + pos.x) * 4;

  return [
    pixels[i],
    pixels[i + 1],
    pixels[i + 2],
    pixels[i + 3]
  ];
}
