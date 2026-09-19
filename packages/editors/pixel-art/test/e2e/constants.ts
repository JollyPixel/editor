export const PORT = 3000;
export const BASE_URL = `http://localhost:${PORT}`;

export const WORKER_COUNT = 4;

export const RUNTIME_MAX_FPS = 1;

export function testAssetPath(
  workerIndex: number
): string {
  return `e2e/canvas-${workerIndex}.pixelart`;
}
