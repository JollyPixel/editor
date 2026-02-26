export function hexToRgb(
  hex: string
): { r: number; g: number; b: number; } {
  const bigint = parseInt(hex.slice(1), 16);

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

export function getColorAsRGBA(
  color: string
): [number, number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);

  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

  return [r, g, b, a];
}

export function rgbToHex(
  r: number,
  g: number,
  b: number
): string {
  if ([r, g, b].some((val) => val < 0 || val > 255)) {
    throw new Error("RGB values must be between 0 and 255.");
  }

  const hexa = [r, g, b].map((val) => val.toString(16).padStart(2, "0"));

  return `#${hexa[0]}${hexa[1]}${hexa[2]}`;
}
