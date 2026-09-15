export const PORT = 3000;
export const BASE_URL = `http://localhost:${PORT}`;

// Must match examples/scripts/main.ts texture size.
export const TEXTURE_SIZE = {
  x: 80,
  y: 80
};

export const DEMO_ASSET_PATH = "demo-canvas.pixelart";
export const WORKER_COUNT = 4;

export function testAssetPath(
  workerIndex: number
): string {
  return `e2e/canvas-${workerIndex}.pixelart`;
}
