export function valueNoise(
  x: number,
  y: number
): number {
  const n = Math.sin((x * 127.1) + (y * 311.7)) * 43758.5453;

  return n - Math.floor(n);
}
