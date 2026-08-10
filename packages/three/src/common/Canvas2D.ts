export interface Canvas2D {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
}

export function createCanvas2D(
  width: number,
  height: number
): Canvas2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error(
      "Unable to acquire a 2D canvas context"
    );
  }

  return {
    canvas,
    context
  };
}
