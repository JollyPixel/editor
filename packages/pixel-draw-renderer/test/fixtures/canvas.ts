// Import Third-party Dependencies
import type { Window } from "happy-dom";
import {
  Canvas,
  Image
} from "skia-canvas";

// CONSTANTS
const kDefaultCanvasSize = {
  width: 300,
  height: 150
};

type DrawImage = (
  image: unknown,
  ...coords: number[]
) => void;

export function installSkiaCanvas(
  window: Window
): void {
  const surfaces = new WeakMap<object, Canvas>();

  function surfaceOf(
    element: object
  ): Canvas {
    let surface = surfaces.get(element);
    if (surface === undefined) {
      surface = new Canvas(
        kDefaultCanvasSize.width,
        kDefaultCanvasSize.height,
        { gpu: false }
      );
      drawElementsThroughSurfaces(surface.getContext("2d"));
      surfaces.set(element, surface);
    }

    return surface;
  }

  function drawElementsThroughSurfaces(
    context: object
  ): void {
    const drawImage = (context as { drawImage: DrawImage; }).drawImage.bind(
      context
    );

    Object.assign(context, {
      drawImage(
        image: unknown,
        ...coords: number[]
      ): void {
        if (image instanceof window.HTMLImageElement) {
          return;
        }

        drawImage(
          image instanceof window.HTMLCanvasElement ? surfaceOf(image) : image,
          ...coords
        );
      }
    });
  }

  Object.defineProperties(window.HTMLCanvasElement.prototype, {
    width: {
      configurable: true,
      get(this: object) {
        return surfaceOf(this).width;
      },
      set(this: object, value: number) {
        surfaceOf(this).width = value;
      }
    },
    height: {
      configurable: true,
      get(this: object) {
        return surfaceOf(this).height;
      },
      set(this: object, value: number) {
        surfaceOf(this).height = value;
      }
    },
    getContext: {
      configurable: true,
      value(this: object, type: string) {
        return type === "2d" ? surfaceOf(this).getContext("2d") : null;
      }
    }
  });
}

export function contextOf(
  canvas: HTMLCanvasElement
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("canvas has no 2D context");
  }

  return context;
}

export function canvasPixels(
  canvas: HTMLCanvasElement
): Uint8ClampedArray {
  return contextOf(canvas).getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  ).data;
}

export function decodedImage(
  canvas: HTMLCanvasElement
): HTMLImageElement {
  const surface = contextOf(canvas).canvas as unknown as Canvas;

  return new Image(
    surface.toBufferSync("png")
  ) as unknown as HTMLImageElement;
}

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
