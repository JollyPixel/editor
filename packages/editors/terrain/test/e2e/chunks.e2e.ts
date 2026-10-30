// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect,
  TERRAIN_CHUNKS
} from "./fixtures.ts";

// CONSTANTS
const kChunk = { x: TERRAIN_CHUNKS, z: 1 };
const kPoint = {
  x: (kChunk.x + 0.5) * CHUNK_SAMPLES,
  z: (kChunk.z + 0.5) * CHUNK_SAMPLES
};
const kTopDownPose = {
  position: { x: kPoint.x, y: 120, z: kPoint.z },
  pitch: -Math.PI / 2
};

test.slow();

test("the Chunks tool adds a chunk on empty ground, Ctrl+click removes it, and each undoes alone", async({
  terrain
}) => {
  await terrain.viewport.pinCamera(kTopDownPose);
  await terrain.selectTool("chunks");

  await terrain.clickAt(kPoint.x, kPoint.z);
  await expect.poll(() => terrain.chunkLoaded(kChunk.x, kChunk.z)).toBe(true);

  await terrain.page.keyboard.down("Control");
  await terrain.clickAt(kPoint.x, kPoint.z);
  await terrain.page.keyboard.up("Control");
  await expect.poll(() => terrain.chunkLoaded(kChunk.x, kChunk.z)).toBe(null);

  await terrain.undo();
  await expect.poll(() => terrain.chunkLoaded(kChunk.x, kChunk.z)).toBe(true);
  await terrain.undo();
  await expect.poll(() => terrain.chunkLoaded(kChunk.x, kChunk.z)).toBe(null);
});
