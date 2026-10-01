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
