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

export function makeContainer(
  width = 200,
  height = width
): HTMLDivElement {
  const container = document.createElement("div");
  stubRect(
    container,
    { width, height }
  );

  return container;
}

export function overlayOf(
  container: Element
): SVGSVGElement {
  const overlay = container.querySelector<SVGSVGElement>(
    ":scope > svg"
  );
  if (overlay === null) {
    throw new Error("container has no SVG overlay");
  }

  return overlay;
}
