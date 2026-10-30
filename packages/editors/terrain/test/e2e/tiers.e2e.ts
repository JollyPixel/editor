// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  refinedTest as test,
  expect,
  REFINED_CHUNK,
  REFINED_HOLE
} from "./fixtures.ts";
import {
  countPixelsNear,
  dominantColor,
  pixelsAround
} from "./support/canvasPixels.ts";

// CONSTANTS
const kColorTolerance = 6;
const kProbeRadius = 3;
const kCorner = { x: REFINED_CHUNK.x * CHUNK_SAMPLES, z: REFINED_CHUNK.z * CHUNK_SAMPLES };
const kSkyPose = {
  position: { x: kCorner.x, y: 60, z: kCorner.z },
  pitch: 1.2
};

test.slow();

test("a refined chunk draws finer levels and meets its x1 neighbours without a gap", async({ terrain }) => {
  await terrain.viewport.pinCamera(kSkyPose);
  const background = dominantColor(await terrain.capture());
  await expect.poll(() => terrain.chunkLoaded(REFINED_CHUNK.x, REFINED_CHUNK.z)).toBe(true);

  const seam = { x: kCorner.x, z: kCorner.z + 20 };
  const height = await terrain.heightAt(seam.x, seam.z);
  await terrain.viewport.pinCamera({
    position: { x: seam.x + 18, y: height + 30, z: seam.z },
    pitch: -1,
    yaw: Math.PI / 2
  });

  expect(await terrain.selectedLodLevels()).toContain(-2);
  expect(countPixelsNear(await terrain.capture(), background, kColorTolerance)).toBe(0);
});

test("a hole on a refined chunk opens on its own grid", async({ terrain }) => {
  await terrain.viewport.pinCamera(kSkyPose);
  const background = dominantColor(await terrain.capture());
  await expect.poll(() => terrain.chunkLoaded(REFINED_CHUNK.x, REFINED_CHUNK.z)).toBe(true);

  const centre = { x: REFINED_HOLE.x + REFINED_HOLE.size / 2, z: REFINED_HOLE.z + REFINED_HOLE.size / 2 };
  const height = await terrain.heightAt(centre.x, centre.z);
  await terrain.viewport.pinCamera({
    position: { x: centre.x, y: height + 15, z: centre.z },
    pitch: -Math.PI / 2
  });
  const box = await terrain.viewport.canvas.boundingBox();
  const screen = await terrain.viewport.screenPoint({ x: centre.x, y: height, z: centre.z });
  const probe = pixelsAround(
    await terrain.capture(),
    { x: screen.x - box!.x, y: screen.y - box!.y },
    kProbeRadius
  );

  expect(countPixelsNear(probe, background, kColorTolerance)).toBe((kProbeRadius * 2 + 1) ** 2);
});
