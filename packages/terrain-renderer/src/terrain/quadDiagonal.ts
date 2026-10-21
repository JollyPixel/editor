export type QuadDiagonal = "main" | "anti";

export function quadDiagonal(
  x: number,
  z: number
): QuadDiagonal {
  return (x + z) % 2 === 0 ? "main" : "anti";
}
