// Import Third-party Dependencies
import { GROUND_MATERIAL } from "@jolly-pixel/asset.terrain";
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  stripTest,
  expect,
  ROCK_MATERIAL,
  STRIP_CHUNKS
} from "./fixtures.ts";
import {
  averageColor,
  pixelsAround,
  type Rgb
} from "./support/canvasPixels.ts";
import { TerrainPage } from "./support/terrainPage.ts";

// CONSTANTS
const kProbeRadius = 2;
const kRenderTimeout = 30_000;
const kStroke = {
  x: CHUNK_SAMPLES * 1.5,
  z: CHUNK_SAMPLES * 1.5
};
const kRow = STRIP_CHUNKS.z / 2;
const kFarChunk = STRIP_CHUNKS.x - 5;
const kHorizonPoint = {
  x: kFarChunk * CHUNK_SAMPLES + CHUNK_SAMPLES / 2,
  z: kRow * CHUNK_SAMPLES
};

function nearPose(
  point: { x: number; z: number; }
) {
  return {
    position: { x: point.x, y: 60, z: point.z + 70 },
    pitch: -0.7
  };
}

const kHorizonPose = {
  position: { x: (kFarChunk - 9) * CHUNK_SAMPLES + CHUNK_SAMPLES / 2, y: 400, z: kRow * CHUNK_SAMPLES },
  pitch: -0.6,
  yaw: -Math.PI / 2
};

async function colorAt(
  terrain: TerrainPage,
  point: { x: number; z: number; }
): Promise<Rgb> {
  const box = await terrain.viewport.canvas.boundingBox();
  const screen = await terrain.viewport.screenPoint({
    x: point.x,
    y: await terrain.heightAt(point.x, point.z),
    z: point.z
  });

  return averageColor(pixelsAround(
    await terrain.capture(),
    { x: screen.x - box!.x, y: screen.y - box!.y },
    kProbeRadius
  ));
}

test.slow();
stripTest.slow();

test("paint and sculpt on one chunk reach both peers, and undoing the paint keeps the sculpt", async({
  terrain,
  peerTerrain
}) => {
  await terrain.viewport.pinCamera(nearPose(kStroke));
  await peerTerrain.viewport.pinCamera(nearPose(kStroke));
  await terrain.paintWith(ROCK_MATERIAL.name);
  const before = await terrain.heightAt(kStroke.x, kStroke.z);

  const releasePaint = await terrain.pressBrush(kStroke.x, kStroke.z);
  const releaseSculpt = await peerTerrain.pressBrush(kStroke.x, kStroke.z);
  await expect.poll(() => terrain.materialAt(kStroke.x, kStroke.z)).toBe(ROCK_MATERIAL.slot);
  await releaseSculpt();
  await releasePaint();

  const sculpted = await peerTerrain.confirmedHeightAt(kStroke.x, kStroke.z);
  expect(sculpted).toBeGreaterThan(before);
  function confirmedMaterial(
    peer: TerrainPage
  ) {
    return peer.materialAt(kStroke.x, kStroke.z, { confirmed: true });
  }
  for (const peer of [terrain, peerTerrain]) {
    await expect.poll(() => confirmedMaterial(peer)).toBe(ROCK_MATERIAL.slot);
    await expect.poll(() => peer.confirmedHeightAt(kStroke.x, kStroke.z)).toBe(sculpted);
  }

  await terrain.undo();

  for (const peer of [terrain, peerTerrain]) {
    await expect.poll(() => confirmedMaterial(peer)).toBe(GROUND_MATERIAL.slot);
    expect(await peer.confirmedHeightAt(kStroke.x, kStroke.z)).toBe(sculpted);
  }
});

stripTest("paint past a far peer's stream radius takes its horizon to the new dominant material", async({
  terrain,
  farPeer
}) => {
  const far = new TerrainPage(farPeer);
  await terrain.viewport.pinCamera(nearPose(kHorizonPoint));
  await far.viewport.pinCamera(kHorizonPose);
  await far.showOverlay("splat");
  await far.selectMaterial(ROCK_MATERIAL.name);
  await expect.poll(() => terrain.chunkLoaded(kFarChunk, kRow)).toBe(true);
  expect(await far.chunkLoaded(kFarChunk, kRow)).toBe(false);
  const [groundRed, , groundBlue] = await colorAt(far, kHorizonPoint);
  expect(groundRed).toBeGreaterThan(groundBlue);

  await terrain.paintWith(ROCK_MATERIAL.name);
  const release = await terrain.pressBrush(kHorizonPoint.x, kHorizonPoint.z);
  await expect.poll(() => terrain.materialAt(kHorizonPoint.x, kHorizonPoint.z)).toBe(ROCK_MATERIAL.slot);
  await release();
  await expect.poll(() => terrain.materialAt(kHorizonPoint.x, kHorizonPoint.z, { confirmed: true }))
    .toBe(ROCK_MATERIAL.slot);

  await expect.poll(async() => {
    const [red, , blue] = await colorAt(far, kHorizonPoint);

    return blue > red;
  }, { timeout: kRenderTimeout }).toBe(true);
  expect(await far.chunkLoaded(kFarChunk, kRow)).toBe(false);
});
