// Import Third-party Dependencies
import { nextFrames } from "@jolly-pixel/e2e/editor";
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

// CONSTANTS
const kFrom = { x: CHUNK_SAMPLES + 12, z: CHUNK_SAMPLES + 32 };
const kTo = { x: CHUNK_SAMPLES + 52, z: CHUNK_SAMPLES + 32 };
const kMiddle = { x: CHUNK_SAMPLES + 32, z: CHUNK_SAMPLES + 32 };

test.slow();

test("Alt during a ramp drag cancels it, and Ctrl+wheel during one keeps it", async({
  terrain
}) => {
  const { page } = terrain;
  await terrain.viewport.pinCamera({
    position: { x: kMiddle.x, y: 140, z: kMiddle.z },
    pitch: -Math.PI / 2
  });
  await expect.poll(() => terrain.chunkLoaded(1, 1)).toBe(true);
  const before = await terrain.confirmedHeightAt(kMiddle.x, kMiddle.z);
  await terrain.selectTool("ramp");

  await terrain.dragBrush(kFrom, kTo, async() => {
    await page.keyboard.down("Alt");
    await nextFrames(page, 2);
    await page.keyboard.up("Alt");
    await nextFrames(page, 2);
  });
  await nextFrames(page, 4);
  expect(await terrain.confirmedHeightAt(kMiddle.x, kMiddle.z)).toBe(before);

  await terrain.dragBrush(kFrom, kTo, async() => {
    await page.keyboard.down("Control");
    await nextFrames(page, 2);
    await page.mouse.wheel(0, -100);
    await nextFrames(page, 2);
    await page.keyboard.up("Control");
    await nextFrames(page, 2);
    expect(await terrain.confirmedHeightAt(kMiddle.x, kMiddle.z)).toBe(before);
  });
  await expect.poll(() => terrain.confirmedHeightAt(kMiddle.x, kMiddle.z)).not.toBe(before);
});

test("dragging the Ramp tool pulls the ground between its ends toward a straight slope, undone alone", async({
  terrain
}) => {
  await terrain.viewport.pinCamera({
    position: { x: kMiddle.x, y: 140, z: kMiddle.z },
    pitch: -Math.PI / 2
  });
  await expect.poll(() => terrain.chunkLoaded(1, 1)).toBe(true);
  const [from, to, before] = await Promise.all([kFrom, kTo, kMiddle].map(
    ({ x, z }) => terrain.confirmedHeightAt(x, z)
  ));
  const line = (from + to) / 2;
  await terrain.selectTool("ramp");

  await terrain.dragBrush(kFrom, kTo);
  await expect.poll(async() => Math.abs(await terrain.confirmedHeightAt(kMiddle.x, kMiddle.z) - line))
    .toBeLessThan(Math.abs(before - line) * 0.9);

  await terrain.page.keyboard.press("Control+z");
  await expect.poll(() => terrain.confirmedHeightAt(kMiddle.x, kMiddle.z)).toBe(before);
});
