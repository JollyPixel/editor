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
