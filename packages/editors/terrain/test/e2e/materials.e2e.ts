// Import Third-party Dependencies
import { GROUND_MATERIAL } from "@jolly-pixel/asset.terrain";
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  averageColor,
  pixelsAround,
  type Rgb
} from "./support/canvasPixels.ts";
import type { TerrainPage } from "./support/terrainPage.ts";

// CONSTANTS
const kProbeRadius = 4;
const kRenderTimeout = 30_000;
const kTextureName = "ground.png";
const kPoint = {
  x: CHUNK_SAMPLES * 1.5,
  z: CHUNK_SAMPLES * 1.5
};
const kPose = {
  position: { x: kPoint.x, y: 60, z: kPoint.z + 70 },
  pitch: -0.7
};

async function colorAt(
  terrain: TerrainPage
): Promise<Rgb> {
  const box = await terrain.viewport.canvas.boundingBox();
  const screen = await terrain.viewport.screenPoint({
    x: kPoint.x,
    y: await terrain.heightAt(kPoint.x, kPoint.z),
    z: kPoint.z
  });

  return averageColor(pixelsAround(
    await terrain.capture(),
    { x: screen.x - box!.x, y: screen.y - box!.y },
    kProbeRadius
  ));
}

function groundAlbedo(
  terrain: TerrainPage
): Promise<string | null> {
  return terrain.page.evaluate(
    (id) => window.terrainEditor!.document.materials.material(id)?.albedo?.id ?? null,
    GROUND_MATERIAL.id
  );
}

function materialCount(
  terrain: TerrainPage
): Promise<number> {
  return terrain.page.evaluate(() => window.terrainEditor!.document.materials.materials().length);
}

test.slow();

test("re-importing a texture from the palette repaints the terrain that uses it for a peer", async({
  terrain,
  peerTerrain
}) => {
  await terrain.viewport.pinCamera(kPose);
  await peerTerrain.viewport.pinCamera(kPose);
  await terrain.dropImage(kTextureName, "#e02020");
  await expect.poll(() => materialCount(terrain)).toBe(3);
  await terrain.page.evaluate((id) => {
    const editor = window.terrainEditor!;
    const imported = editor.document.materials.materials().find((material) => material.albedo !== null)!;
    editor.document.updateMaterial(id, { albedo: imported.albedo });
    editor.document.removeMaterial(imported.id);
  }, GROUND_MATERIAL.id);
  const albedo = await groundAlbedo(terrain);
  expect(albedo).not.toBeNull();
  await expect.poll(async() => {
    const [red, , blue] = await colorAt(peerTerrain);

    return red > blue;
  }, { timeout: kRenderTimeout }).toBe(true);

  await terrain.dropImage(kTextureName, "#2040e0");
  await terrain.page.getByRole("button", { name: "Replace" }).click();

  await expect.poll(async() => {
    const [red, , blue] = await colorAt(peerTerrain);

    return blue > red;
  }, { timeout: kRenderTimeout }).toBe(true);
  expect(await groundAlbedo(terrain)).toBe(albedo);
  expect(await materialCount(terrain)).toBe(2);
});
