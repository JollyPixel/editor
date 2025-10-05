export function hexToRgb(hex: string): { r: number; g: number; b: number; } {
  const bigint = parseInt(hex.slice(1), 16);

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

export function getColorAsRGBA(color: string): [number, number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);

  // Need to force rgba format to simplify everything with colors
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

  return [r, g, b, a];
}
