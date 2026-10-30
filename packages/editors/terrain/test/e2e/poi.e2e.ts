// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  averageColor,
  pixelsAround
} from "./support/canvasPixels.ts";
import type { TerrainPage } from "./support/terrainPage.ts";

// CONSTANTS
const kChunk = { x: 1, z: 1 };
const kPoint = { x: (kChunk.x + 0.5) * CHUNK_SAMPLES, z: (kChunk.z + 0.5) * CHUNK_SAMPLES };
const kProbeRadius = 4;

async function warmthAtPoint(
  terrain: TerrainPage
): Promise<number> {
  const box = await terrain.viewport.canvas.boundingBox();
  const screen = await terrain.viewport.screenPoint({
    x: kPoint.x,
    y: await terrain.heightAt(kPoint.x, kPoint.z),
    z: kPoint.z
  });

  const [red, , blue] = averageColor(pixelsAround(
    await terrain.capture(),
    { x: screen.x - box!.x, y: screen.y - box!.y },
    kProbeRadius
  ));

  return red - blue;
}

test.slow();

test("a point of interest takes the chunk clicked while editing, tinted, the brush resting", async({
  terrain
}) => {
  await terrain.viewport.pinCamera({ position: { x: kPoint.x, y: 120, z: kPoint.z }, pitch: -Math.PI / 2 });
  await expect.poll(() => terrain.chunkLoaded(kChunk.x, kChunk.z)).toBe(true);
  const height = await terrain.confirmedHeightAt(kPoint.x, kPoint.z);
  const plain = await warmthAtPoint(terrain);
  const panel = terrain.page.locator("terrain-poi-panel");
  await panel.getByRole("button", { name: "Add point of interest" }).click();
  await panel.locator("jolly-toggle[data-field=edit-chunks]").click();

  await terrain.clickAt(kPoint.x, kPoint.z);
  await expect.poll(() => terrain.pointOfInterestChunks()).toEqual([`${kChunk.x},${kChunk.z}`]);
  expect(await terrain.confirmedHeightAt(kPoint.x, kPoint.z)).toBe(height);
  expect(await warmthAtPoint(terrain)).toBeGreaterThan(plain + 20);

  await terrain.undo();
  await expect.poll(() => terrain.pointOfInterestChunks()).toEqual([]);
});
