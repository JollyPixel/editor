// Import Node.js Dependencies
import { readFile } from "node:fs/promises";

// Import Third-party Dependencies
import { decodePng } from "@jolly-pixel/image";
import type * as THREE from "three";

// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import { TEXTURE_SIZE } from "./support/canvas.ts";
import type { PixelArtPanel } from "./support/panel.ts";

// CONSTANTS
const kFlat = "#8080ffff";
const kBump = {
  x: 30,
  y: 20
};
const kBesideBump = {
  x: 29,
  y: 20
};
const kCubeRegion = {
  x: 0,
  y: 0,
  width: 16,
  height: 16
};
const kCubeCell = {
  x: 8,
  y: 8
};

async function exportNormalMap(
  panel: PixelArtPanel,
  convention: "OpenGL (Y+)" | "DirectX (Y-)"
): Promise<Uint8ClampedArray> {
  await panel.normalMap.exportMenu.click();
  const [download] = await Promise.all([
    panel.page.waitForEvent("download"),
    panel.normalMap.exportItem(`Normal map — ${convention}`).click()
  ]);
  expect(download.suggestedFilename()).toBe("texture.normal.png");
  const image = await decodePng(await readFile(await download.path()));
  expect([image.width, image.height]).toEqual([TEXTURE_SIZE.x, TEXTURE_SIZE.y]);

  return image.data;
}

function pixelAt(
  data: Uint8ClampedArray,
  point: { x: number; y: number; }
): number[] {
  const offset = ((point.y * TEXTURE_SIZE.x) + point.x) * 4;

  return Array.from(data.subarray(offset, offset + 4));
}

test("enable, view, override a region and export the normal map", async({ panel, page }) => {
  const { normalMap } = panel;
  await panel.canvas.seed([
    { x: 0, y: 0, width: TEXTURE_SIZE.x, height: TEXTURE_SIZE.y, color: "#808080" },
    { ...kBump, color: "#ffffff" },
    { ...kCubeCell, color: "#ffffff" }
  ]);
  const dock = normalMap.root;

  await normalMap.toggle.click();
  await expect(dock).toHaveAttribute("open", "");
  await normalMap.enableBox.check();
  expect((await panel.normalMap.state()).config).toMatchObject({ zones: [] });

  await normalMap.normalView.click();
  expect(await panel.normalMap.state()).toMatchObject({
    view: "normal",
    mode: "move"
  });
  await expect(panel.modes.button("paint")).toBeDisabled();
  await expect(panel.importButton).toBeDisabled();
  await expect.poll(() => panel.canvas.renderedPixels([kBesideBump, { x: 50, y: 5 }]))
    .toEqual([expect.not.stringMatching(kFlat), kFlat]);

  await panel.modes.select("uv");
  await panel.visibility.apply({ all: true });
  await panel.uv.createCube.click();
  await panel.canvas.click(kCubeCell);
  await normalMap.override.click();
  await expect(dock.locator("[part=normal-map-zone]")).toHaveText(/cube-1/);
  await expect(dock.locator("[part=normal-map-target]")).toHaveText("cube-1");
  await dock.locator("jolly-checkbox[label=\"Off for this UV\"] input").check();
  const { config } = await panel.normalMap.state();
  expect(config?.zones).toEqual([
    { regionId: expect.any(String), settings: "off" }
  ]);

  const opengl = await exportNormalMap(panel, "OpenGL (Y+)");
  const directx = await exportNormalMap(panel, "DirectX (Y-)");
  expect(pixelAt(opengl, { x: 7, y: 8 })).toEqual([128, 128, 255, 255]);
  const bumped = pixelAt(opengl, kBesideBump);
  expect(bumped).not.toEqual([128, 128, 255, 255]);
  expect(pixelAt(directx, kBesideBump))
    .toEqual([bumped[0], 255 - bumped[1], bumped[2], 255]);

  await normalMap.exportMenu.focus();
  await normalMap.exportMenu.press("Enter");
  const albedo = normalMap.exportItem("Albedo texture");
  await expect(albedo).toBeVisible();
  await albedo.focus();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    albedo.press("Enter")
  ]);
  expect(download.suggestedFilename()).toBe("texture.png");
  const image = await decodePng(await readFile(await download.path()));
  expect(pixelAt(image.data, kBump)).toEqual([255, 255, 255, 255]);
  await expect(albedo).toBeHidden();

  await normalMap.albedoView.click();
  await expect(panel.modes.button("paint")).toBeEnabled();
  await expect.poll(() => panel.canvas.renderedPixels([kBump])).toEqual(["#ffffffff"]);
});

test("switching back to Albedo restores the tool the Normal view displaced", async({ panel }) => {
  await panel.modes.select("fill");
  await panel.normalMap.enable();

  await panel.normalMap.normalView.click();
  expect((await panel.normalMap.state()).mode).toBe("move");

  await panel.normalMap.albedoView.click();
  expect((await panel.normalMap.state()).mode).toBe("fill");
});

test.describe("3D preview", () => {
  test.use({ editor: playground({ runtime: true }) });

  function previewNormalMaps(
    panel: PixelArtPanel
  ): Promise<boolean[]> {
    return panel.page.evaluate(() => {
      const meshes = window.pixelArtEditor?.preview?.scene.meshes ?? [];

      return meshes.map((mesh) => {
        const { material } = mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

        return material.normalMap !== null;
      });
    });
  }

  test("applies the normal map while it is enabled", async({ panel }) => {
    const { normalMap } = panel;
    await panel.uv.addRegion(kCubeRegion);
    await expect.poll(() => previewNormalMaps(panel)).toEqual([false]);

    await normalMap.enable();
    await expect.poll(() => previewNormalMaps(panel)).toEqual([true]);

    await normalMap.enableBox.uncheck();
    await expect.poll(() => previewNormalMaps(panel)).toEqual([false]);
  });
});
