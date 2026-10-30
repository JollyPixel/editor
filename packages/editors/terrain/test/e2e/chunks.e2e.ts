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

test("the Detail mode refines a chunk the brushes then sculpt on its finer grid, each undone alone", async({
  terrain
}) => {
  const refined = { x: 1, z: 1 };
  const centre = { x: (refined.x + 0.5) * CHUNK_SAMPLES, z: (refined.z + 0.5) * CHUNK_SAMPLES };
  const between = { x: CHUNK_SAMPLES * 2 + 1, z: CHUNK_SAMPLES * 2 };
  await terrain.viewport.pinCamera({ position: { x: centre.x, y: 120, z: centre.z }, pitch: -Math.PI / 2 });
  await expect.poll(() => terrain.chunkLoaded(refined.x, refined.z)).toBe(true);
  await terrain.selectTool("chunks");
  await terrain.page.locator("terrain-sculpt-toolbar jolly-tool-button[data-tool=chunks-detail]").click();
  await terrain.page.locator("terrain-sculpt-toolbar jolly-tool-button[data-tool=chunks-tier-4]").click();

  await terrain.clickAt(centre.x, centre.z);
  await expect.poll(() => terrain.chunkTier(refined.x, refined.z)).toBe(4);
  const before = await terrain.confirmedSample(refined.x, refined.z, between.x, between.z);

  await terrain.selectTool("raise");
  await terrain.clickAt(centre.x, centre.z);
  await expect.poll(() => terrain.confirmedSample(refined.x, refined.z, between.x, between.z))
    .toBeGreaterThan(before!);

  await terrain.undo();
  await expect.poll(() => terrain.confirmedSample(refined.x, refined.z, between.x, between.z)).toBe(before);
  await terrain.undo();
  await expect.poll(() => terrain.chunkTier(refined.x, refined.z)).toBe(1);
});
