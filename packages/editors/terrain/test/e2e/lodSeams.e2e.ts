// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect,
  TERRAIN_CHUNKS
} from "./fixtures.ts";

// CONSTANTS
const kCentre = CHUNK_SAMPLES * TERRAIN_CHUNKS / 2;
const kSkyPose = {
  x: kCentre,
  y: 60,
  z: kCentre,
  pitch: 1.2
};
const kGroundPose = {
  x: kCentre,
  y: 50,
  z: CHUNK_SAMPLES * TERRAIN_CHUNKS - 26,
  pitch: -1
};

test.slow();

test("terrain across LoD levels leaves no gap to the background", async({ terrain }) => {
  await terrain.pinCamera(kSkyPose);
  const background = await terrain.dominantColor();

  await terrain.pinCamera(kGroundPose);
  expect((await terrain.selectedLodLevels()).length).toBeGreaterThan(1);

  expect(await terrain.pixelsMatching(background)).toBe(0);
});
