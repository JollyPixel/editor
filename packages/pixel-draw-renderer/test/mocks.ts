/* eslint-disable max-params */
// Helpers
function parseCSSColor(color: string): [number, number, number, number] {
  if (color.startsWith("#")) {
    const hex = color.slice(1).padEnd(6, "0");

    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255
    ];
  }

  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (match) {
    return [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4] === undefined ? 255 : Math.round(parseFloat(match[4]) * 255)
    ];
  }

  return [0, 0, 0, 255];
}

// Mock ImageData
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

// Mock 2D Context
class MockCanvas2DContext {
  fillStyle: string = "#000000";
  imageSmoothingEnabled: boolean = false;
  readonly canvas: MockCanvasElement;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  setTransform(..._args: unknown[]): void {
    // No-op for testing
  }
  beginPath(): void {
    // No-op for testing
  }
  save(): void {
    // No-op for testing
  }
  restore(): void {
    // No-op for testing
  }
  clip(): void {
    // No-op for testing
  }
  rect(..._args: unknown[]): void {
    // No-op for testing
  }
  drawImage(..._args: unknown[]): void {
    // No-op for testing
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const [r, g, b, a] = parseCSSColor(this.fillStyle);
    const pixels = this.canvas._pixels;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    for (let py = Math.max(0, y); py < Math.min(y + h, ch); py++) {
      for (let px = Math.max(0, x); px < Math.min(x + w, cw); px++) {
        const idx = (py * cw + px) * 4;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = a;
      }
    }
  }

  createImageData(w: number, h: number): MockImageData {
    return new MockImageData(w, h);
  }

  getImageData(
    x: number,
    y: number,
    w: number,
    h: number
  ): MockImageData {
    const result = new MockImageData(w, h);
    const pixels = this.canvas._pixels;
    const cw = this.canvas.width;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const srcIdx = ((y + py) * cw + (x + px)) * 4;
        const dstIdx = (py * w + px) * 4;
        result.data[dstIdx] = pixels[srcIdx] ?? 0;
        result.data[dstIdx + 1] = pixels[srcIdx + 1] ?? 0;
        result.data[dstIdx + 2] = pixels[srcIdx + 2] ?? 0;
        result.data[dstIdx + 3] = pixels[srcIdx + 3] ?? 0;
      }
    }

    return result;
  }

  putImageData(imageData: MockImageData, x: number, y: number): void {
    const pixels = this.canvas._pixels;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    for (let py = 0; py < imageData.height; py++) {
      for (let px = 0; px < imageData.width; px++) {
        const dstX = x + px;
        const dstY = y + py;

        if (dstX < 0 || dstX >= cw || dstY < 0 || dstY >= ch) {
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

// Mock Canvas Element (minimal HTMLCanvasElement for testing)
export class MockCanvasElement {
  // Default browser canvas size
  private _width: number = 300;
  private _height: number = 150;
  _pixels: Uint8ClampedArray = new Uint8ClampedArray(300 * 150 * 4);

  readonly _ctx: MockCanvas2DContext;
  style: Record<string, string> = {};
  parentElement: unknown = null;

  constructor() {
    this._ctx = new MockCanvas2DContext(this);
  }

  get width(): number {
    return this._width;
  }

  set width(v: number) {
    this._width = v;
    this._pixels = new Uint8ClampedArray(this._width * this._height * 4);
  }

  get height(): number {
    return this._height;
  }

  set height(v: number) {
    this._height = v;
    this._pixels = new Uint8ClampedArray(this._width * this._height * 4);
  }

  getContext(type: string, _options?: unknown): unknown {
    if (type === "2d") {
      return this._ctx;
    }

    return null;
  }

  getBoundingClientRect(): DOMRect {
    return {
      left: 0,
      top: 0,
      right: this._width,
      bottom: this._height,
      width: this._width,
      height: this._height
    } as DOMRect;
  }

  addEventListener(_type: string, _handler: unknown, _options?: unknown): void {
    // No-op for testing
  }
  removeEventListener(_type: string, _handler: unknown): void {
    // No-op for testing
  }
  dispatchEvent(_event: unknown): boolean {
    return true;
  }
  remove(): void {
    this.parentElement = null;
  }
  appendChild(_child: unknown): void {
    // No-op for testing
  }
}

/**
 * Patches document.createElement so that creating a "canvas" returns
 * a MockCanvasElement with a working 2D context instead of a DOM element
 * that returns null from getContext.
 */
export function installCanvasMock(doc: Document): void {
  const orig = doc.createElement.bind(doc);
  (doc as unknown as Record<string, unknown>).createElement = (tag: string, options?: unknown) => {
    if (tag.toLowerCase() === "canvas") {
      return new MockCanvasElement() as unknown as HTMLCanvasElement;
    }

    return (orig as (tag: string, opts?: unknown) => Element)(tag, options);
  };
}
