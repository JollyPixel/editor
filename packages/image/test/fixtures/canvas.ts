// Canvas 2D fixture. happy-dom provides real <canvas> elements but no 2D
// rendering context, so installCanvasMock patches getContext("2d") to return
// a pixel-backed context. The raster ladder only ever creates, writes, reads
// and blits whole buffers, so this mock covers exactly those four calls; the
// fill/stroke/path emulation the pixel-draw-renderer fixture carries has no
// caller here.

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
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

export class MockCanvas2DContext {
  imageSmoothingEnabled = false;
  readonly canvas: HTMLCanvasElement;

  #pixels: Uint8ClampedArray;
  #width: number;
  #height: number;

  constructor(
    canvas: HTMLCanvasElement
  ) {
    this.canvas = canvas;
    this.#width = canvas.width;
    this.#height = canvas.height;
    this.#pixels = new Uint8ClampedArray(this.#width * this.#height * 4);
  }

  // The RGBA8 buffer backing this context, resynced to the canvas size.
  get pixels(): Uint8ClampedArray {
    this.#syncSize();

    return this.#pixels;
  }

  // Setting canvas.width/height clears the canvas in a browser; mirror that
  // by reallocating a zeroed buffer whenever the live dimensions change.
  #syncSize(): void {
    if (
      this.canvas.width === this.#width &&
      this.canvas.height === this.#height
    ) {
      return;
    }
    this.#width = this.canvas.width;
    this.#height = this.canvas.height;
    this.#pixels = new Uint8ClampedArray(this.#width * this.#height * 4);
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

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const from = (((y + py) * this.#width) + (x + px)) * 4;
        const to = ((py * width) + px) * 4;

        for (let channel = 0; channel < 4; channel++) {
          result.data[to + channel] = this.#pixels[from + channel] ?? 0;
        }
      }
    }

    return result;
  }

  putImageData(
    imageData: MockImageData,
    x: number,
    y: number
  ): void {
    this.#syncSize();

    for (let py = 0; py < imageData.height; py++) {
      for (let px = 0; px < imageData.width; px++) {
        const toX = x + px;
        const toY = y + py;
        if (
          toX < 0 || toX >= this.#width ||
          toY < 0 || toY >= this.#height
        ) {
          continue;
        }

        const from = ((py * imageData.width) + px) * 4;
        const to = ((toY * this.#width) + toX) * 4;
        for (let channel = 0; channel < 4; channel++) {
          this.#pixels[to + channel] = imageData.data[from + channel];
        }
      }
    }
  }

  /**
   * Straight copy of a canvas source at (dx, dy). The ladder only ever blits
   * a freshly decoded bitmap onto an empty canvas of the same size, so there
   * is nothing to composite against and no scaling to do.
   */
  drawImage(
    image: unknown,
    dx = 0,
    dy = 0
  ): void {
    if (!isCanvasSource(image)) {
      return;
    }

    this.#syncSize();
    const source = mockContextOf(image).pixels;

    for (let py = 0; py < image.height; py++) {
      for (let px = 0; px < image.width; px++) {
        const toX = dx + px;
        const toY = dy + py;
        if (
          toX < 0 || toX >= this.#width ||
          toY < 0 || toY >= this.#height
        ) {
          continue;
        }

        const from = ((py * image.width) + px) * 4;
        const to = ((toY * this.#width) + toX) * 4;
        for (let channel = 0; channel < 4; channel++) {
          this.#pixels[to + channel] = source[from + channel];
        }
      }
    }
  }
}

function isCanvasSource(
  source: unknown
): source is HTMLCanvasElement {
  return typeof (
    source as { getContext?: unknown; }
  ).getContext === "function";
}

/**
 * Patches doc.createElement so a "canvas" gets a working mock 2D context
 * (happy-dom's own getContext returns null). The element stays happy-dom's.
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
      const element = createElement(tagName, options);
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

export function mockContextOf(
  canvas: HTMLCanvasElement
): MockCanvas2DContext {
  const context = canvas.getContext(
    "2d"
  ) as unknown as MockCanvas2DContext | null;
  if (context === null) {
    throw new Error("canvas was not created through installCanvasMock");
  }

  return context;
}

/** The RGBA8 pixel buffer backing a mocked canvas. */
export function canvasPixels(
  canvas: HTMLCanvasElement
): Uint8ClampedArray {
  return mockContextOf(canvas).pixels;
}
