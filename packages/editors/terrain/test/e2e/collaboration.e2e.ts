// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { TerrainPage } from "./support/terrainPage.ts";

// CONSTANTS
const kStroke = {
  x: CHUNK_SAMPLES * 1.5,
  z: CHUNK_SAMPLES * 1.5
};
const kNearPose = {
  position: {
    x: kStroke.x,
    y: 60,
    z: kStroke.z + 70
  },
  pitch: -0.7
};
const kFarPose = {
  ...kNearPose,
  position: {
    ...kNearPose.position,
    x: kStroke.x + CHUNK_SAMPLES * 8
  }
};

test.slow();

test("a stroke reaches a near peer while it runs and a far peer only once committed", async({
  terrain,
  peerTerrain,
  farPeer
}) => {
  const far = new TerrainPage(farPeer);
  await terrain.viewport.pinCamera(kNearPose);
  await peerTerrain.viewport.pinCamera(kNearPose);
  await far.viewport.pinCamera(kFarPose);
  const before = await terrain.heightAt(kStroke.x, kStroke.z);

  const release = await terrain.pressBrush(kStroke.x, kStroke.z);
  await expect.poll(() => peerTerrain.heightAt(kStroke.x, kStroke.z)).toBeGreaterThan(before);
  expect(await far.heightAt(kStroke.x, kStroke.z)).toBe(await far.confirmedHeightAt(kStroke.x, kStroke.z));
  await release();

  const committed = await terrain.heightAt(kStroke.x, kStroke.z);
  await expect.poll(() => far.heightAt(kStroke.x, kStroke.z)).toBe(committed);
  await expect.poll(() => peerTerrain.heightAt(kStroke.x, kStroke.z)).toBe(committed);
});

test("undoing a stroke restores the heights a peer sees", async({ terrain, peerTerrain }) => {
  await terrain.viewport.pinCamera(kNearPose);
  const before = await terrain.heightAt(kStroke.x, kStroke.z);

  await terrain.sculptAt(kStroke.x, kStroke.z);
  await expect.poll(() => peerTerrain.heightAt(kStroke.x, kStroke.z)).toBeGreaterThan(before);

  await terrain.undo();

  await expect.poll(() => peerTerrain.heightAt(kStroke.x, kStroke.z)).toBe(before);
  expect(await terrain.heightAt(kStroke.x, kStroke.z)).toBe(before);
});
