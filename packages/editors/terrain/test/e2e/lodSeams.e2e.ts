// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect,
  TERRAIN_CHUNKS
} from "./fixtures.ts";
import {
  countPixelsNear,
  dominantColor
} from "./support/canvasPixels.ts";

// CONSTANTS
const kCentre = CHUNK_SAMPLES * TERRAIN_CHUNKS / 2;
const kColorTolerance = 6;
const kSkyPose = {
  position: {
    x: kCentre,
    y: 60,
    z: kCentre
  },
  pitch: 1.2
};
const kGroundPose = {
  position: {
    x: kCentre,
    y: 50,
    z: CHUNK_SAMPLES * TERRAIN_CHUNKS - 26
  },
  pitch: -1
};

test.slow();

test("terrain across LoD levels leaves no gap to the background", async({ terrain }) => {
  await terrain.viewport.pinCamera(kSkyPose);
  const background = dominantColor(await terrain.capture());

  await terrain.viewport.pinCamera(kGroundPose);
  expect((await terrain.selectedLodLevels()).length).toBeGreaterThan(1);

  expect(countPixelsNear(await terrain.capture(), background, kColorTolerance)).toBe(0);
});
