// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  stripTest as test,
  expect,
  STRIP_CHUNKS
} from "./fixtures.ts";
import {
  countPixelsNear,
  dominantColor,
  type CanvasPixels
} from "./support/canvasPixels.ts";

// CONSTANTS
const kColorTolerance = 6;
const kProbeRadius = 4;
const kRow = STRIP_CHUNKS.z / 2;
const kFarChunk = STRIP_CHUNKS.x - 5;
const kSkyPose = {
  position: { x: CHUNK_SAMPLES / 2, y: 60, z: kRow * CHUNK_SAMPLES },
  pitch: 1.2
};
const kAlongPose = {
  position: { x: CHUNK_SAMPLES / 2, y: 150, z: kRow * CHUNK_SAMPLES },
  pitch: -0.25,
  yaw: -Math.PI / 2
};

function around(
  pixels: CanvasPixels,
  centre: { x: number; y: number; }
): CanvasPixels {
  const size = kProbeRadius * 2 + 1;
  const data: number[] = [];
  for (let dy = -kProbeRadius; dy <= kProbeRadius; dy++) {
    const offset = ((Math.round(centre.y) + dy) * pixels.width + Math.round(centre.x) - kProbeRadius) * 4;
    data.push(...pixels.data.slice(offset, offset + size * 4));
  }

  return { width: size, height: size, data };
}

test.slow();

test("ground past the stream radius is drawn from the overview", async({ terrain }) => {
  await terrain.viewport.pinCamera(kSkyPose);
  const background = dominantColor(await terrain.capture());

  await terrain.viewport.pinCamera(kAlongPose);
  await expect.poll(() => terrain.chunkLoaded(1, kRow)).toBe(true);
  expect(await terrain.chunkLoaded(kFarChunk, kRow)).toBe(false);

  const sampleX = kFarChunk * CHUNK_SAMPLES + CHUNK_SAMPLES / 2;
  const sampleZ = kRow * CHUNK_SAMPLES;
  const box = await terrain.viewport.canvas.boundingBox();
  const point = await terrain.viewport.screenPoint({
    x: sampleX,
    y: await terrain.heightAt(sampleX, sampleZ),
    z: sampleZ
  });
  const probe = around(await terrain.capture(), { x: point.x - box!.x, y: point.y - box!.y });

  expect(countPixelsNear(probe, background, kColorTolerance)).toBe(0);
});
