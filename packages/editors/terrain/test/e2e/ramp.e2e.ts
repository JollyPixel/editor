// Import Third-party Dependencies
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

  await terrain.undo();
  await expect.poll(() => terrain.confirmedHeightAt(kMiddle.x, kMiddle.z)).toBe(before);
});
