// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  countPixelsNear,
  dominantColor,
  pixelsAround,
  type CanvasPixels
} from "./support/canvasPixels.ts";
import type { TerrainPage } from "./support/terrainPage.ts";

// CONSTANTS
const kColorTolerance = 6;
const kProbeRadius = 3;
const kProbePixels = (kProbeRadius * 2 + 1) ** 2;
const kPoint = {
  x: CHUNK_SAMPLES * 1.5,
  z: CHUNK_SAMPLES * 1.5
};
const kSkyPose = {
  position: { x: kPoint.x, y: 60, z: kPoint.z },
  pitch: 1.2
};
const kTopDownPose = {
  position: { x: kPoint.x, y: 80, z: kPoint.z },
  pitch: -Math.PI / 2
};

async function probeAtPoint(
  terrain: TerrainPage
): Promise<CanvasPixels> {
  const box = await terrain.viewport.canvas.boundingBox();
  const screen = await terrain.viewport.screenPoint({
    x: kPoint.x,
    y: await terrain.heightAt(kPoint.x, kPoint.z),
    z: kPoint.z
  });

  return pixelsAround(
    await terrain.capture(),
    { x: screen.x - box!.x, y: screen.y - box!.y },
    kProbeRadius
  );
}

test.slow();

test("the hole tool shows the cells it cuts, which open to the background under another tool", async({
  terrain
}) => {
  await terrain.viewport.pinCamera(kSkyPose);
  const background = dominantColor(await terrain.capture());
  async function backgroundAtPoint(): Promise<number> {
    return countPixelsNear(await probeAtPoint(terrain), background, kColorTolerance);
  }
  await terrain.viewport.pinCamera(kTopDownPose);
  await terrain.selectTool("holes");

  const releaseCut = await terrain.pressBrush(kPoint.x, kPoint.z);
  await releaseCut();
  await expect.poll(() => terrain.holeAt(kPoint.x, kPoint.z)).toBe(true);
  expect(await backgroundAtPoint()).toBe(0);

  await terrain.selectTool("raise");
  expect(await backgroundAtPoint()).toBe(kProbePixels);

  await terrain.selectTool("holes");
  await terrain.page.keyboard.down("Control");
  const releaseFill = await terrain.pressBrush(kPoint.x, kPoint.z);
  await releaseFill();
  await terrain.page.keyboard.up("Control");
  await expect.poll(() => terrain.holeAt(kPoint.x, kPoint.z)).toBe(false);
  await terrain.selectTool("raise");
  expect(await backgroundAtPoint()).toBe(0);
});
