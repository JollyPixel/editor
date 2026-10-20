export const PORTS = {
  pixelArt: 3000,
  ui: 3001,
  voxelMap: 3002,
  voxelModel: 3003,
  studio: 3004,
  runtime: 3005,
  console: 3006,
  lantern: 3007,
  terrain: 3008
} as const;

export function baseUrl(
  port: number
): string {
  return `http://localhost:${port}`;
}
