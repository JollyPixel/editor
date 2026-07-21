// DOM element factories shared across the input and canvas specs. happy-dom
// has no layout engine, so getBoundingClientRect must be stubbed wherever the
// code under test measures an element.

/**
 * Stubs getBoundingClientRect on an element (happy-dom returns zeros). Anchored
 * at the origin, so left/top stay 0 and only the size varies.
 */
export function stubRect(
  element: Element,
  size: {
    width: number;
    height: number;
  }
): void {
  Object.assign(element, {
    getBoundingClientRect: () => {
      return {
        left: 0,
        top: 0,
        right: size.width,
        bottom: size.height,
        width: size.width,
        height: size.height,
        x: 0,
        y: 0,
        toJSON: () => {
          return {};
        }
      };
    }
  });
}

/** A square, input-listening canvas with a stubbed bounding rect. */
export function makeCanvas(
  size = 200
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  stubRect(canvas, {
    width: size,
    height: size
  });

  return canvas;
}

/**
 * A container div with a stubbed bounding rect. `children` collects every
 * element PixelArtCanvas appends, in order: the interactive canvas first, then
 * the SVG overlay. Typed as canvases (matching how specs consume children[0]);
 * the SVG at children[1] is asserted with an explicit cast where needed.
 */
export function makeContainer(
  width = 200,
  height = width
): { container: HTMLDivElement; children: HTMLCanvasElement[]; } {
  const container = document.createElement("div");
  const children: HTMLCanvasElement[] = [];
  stubRect(container, { width, height });
  Object.assign(container, {
    style: {},
    appendChild: (child: HTMLCanvasElement) => {
      children.push(child);

      return child;
    }
  });

  return {
    container,
    children
  };
}
