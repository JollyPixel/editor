export const PORT = 3000;
export const BASE_URL = `http://localhost:${PORT}`;

// Must match examples/scripts/main.ts texture size.
export const TEXTURE_SIZE = {
  x: 80,
  y: 80
};

/**
 * Playwright worker count. Each worker gets its own sync room (see
 * `testRoomId`) so tests run truly in parallel instead of racing on the
 * single shared demo room — must match the count of test rooms registered
 * in vite.config.ts.
 */
export const WORKER_COUNT = 4;

/**
 * Per-worker sync room id, isolated from the interactive demo room
 * ("pixel-draw:demo-canvas") and from every other worker.
 */
export function testRoomId(
  workerIndex: number
): string {
  return `pixel-draw:demo-canvas-test-${workerIndex}`;
}
