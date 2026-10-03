// Import Node.js Dependencies
import { readFile } from "node:fs/promises";

// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { decodePng } from "@jolly-pixel/image";
import type * as THREE from "three";

// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import {
  TEXTURE_SIZE,
  addUvRegion,
  clickTexturePixel,
  readRenderedPixels,
  seedTexture,
  setMode
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

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

function normalMapState(
  panel: Locator
) {
  return panel.evaluate((element: PixelDrawPanel) => {
    const canvas = element.canvasManager!;

    return {
      view: canvas.textureView,
      mode: canvas.mode,
      config: canvas.document.normalMap?.toJSON() ?? null
    };
  });
}

async function exportNormalMap(
  panel: Locator,
  page: Page,
  convention: "OpenGL (Y+)" | "DirectX (Y-)"
): Promise<Uint8ClampedArray> {
  await panel.getByRole("button", { name: "Export normal map" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("menuitem", { name: convention }).click()
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
  await seedTexture(panel, [
    { x: 0, y: 0, width: TEXTURE_SIZE.x, height: TEXTURE_SIZE.y, color: "#808080" },
    { ...kBump, color: "#ffffff" },
    { ...kCubeCell, color: "#ffffff" }
  ]);
  const dock = panel.locator("normal-map-dock");
  const exportButton = panel.getByRole("button", { name: "Export normal map" });
  await expect(exportButton).toBeDisabled();

  await panel.getByRole("button", { name: "Normal map settings" }).click();
  await expect(dock).toHaveAttribute("open", "");
  await dock.locator("[part=normal-map-enable] input").check();
  await expect(exportButton).toBeEnabled();
  expect((await normalMapState(panel)).config).toMatchObject({ zones: [] });

  await panel.getByRole("radio", { name: "Normal" }).click();
  expect(await normalMapState(panel)).toMatchObject({
    view: "normal",
    mode: "move"
  });
  await expect(panel.getByRole("button", { name: "Paint", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Import texture" })).toBeDisabled();
  await expect.poll(() => readRenderedPixels(panel, [kBesideBump, { x: 50, y: 5 }]))
    .toEqual([expect.not.stringMatching(kFlat), kFlat]);

  await setMode(panel, "uv");
  await panel.getByRole("button", { name: "Show all" }).click();
  await panel.getByRole("button", { name: "Create cube", exact: true }).click();
  await clickTexturePixel(panel, kCubeCell);
  await panel.getByRole("button", { name: "Override normal map" }).click();
  await expect(dock.locator("[part=normal-map-zone]")).toHaveText(/cube-1/);
  await expect(dock.locator("[part=normal-map-target]")).toHaveText("cube-1");
  await dock.locator("jolly-checkbox[label=\"Off for this UV\"] input").check();
  const { config } = await normalMapState(panel);
  expect(config?.zones).toEqual([
    { regionId: expect.any(String), settings: "off" }
  ]);

  const opengl = await exportNormalMap(panel, page, "OpenGL (Y+)");
  const directx = await exportNormalMap(panel, page, "DirectX (Y-)");
  expect(pixelAt(opengl, { x: 7, y: 8 })).toEqual([128, 128, 255, 255]);
  const bumped = pixelAt(opengl, kBesideBump);
  expect(bumped).not.toEqual([128, 128, 255, 255]);
  expect(pixelAt(directx, kBesideBump))
    .toEqual([bumped[0], 255 - bumped[1], bumped[2], 255]);

  await panel.getByRole("radio", { name: "Albedo" }).click();
  await expect(panel.getByRole("button", { name: "Paint", exact: true })).toBeEnabled();
  await expect.poll(() => readRenderedPixels(panel, [kBump])).toEqual(["#ffffffff"]);
});

test("the color dock and the normal map dock never open together", async({ panel }) => {
  const colorDock = panel.locator("color-dock");
  const normalDock = panel.locator("normal-map-dock");
  const colorToggle = panel.getByRole("button", { name: "Docked color picker" });
  const normalToggle = panel.getByRole("button", { name: "Normal map settings" });

  await colorToggle.click();
  await expect(colorDock).toHaveAttribute("open", "");

  await normalToggle.click();
  await expect(normalDock).toHaveAttribute("open", "");
  await expect(colorDock).not.toHaveAttribute("open", "");
  await expect(panel).not.toHaveAttribute("color-docked", "");

  await colorToggle.click();
  await expect(colorDock).toHaveAttribute("open", "");
  await expect(normalDock).not.toHaveAttribute("open", "");

  await panel.getByRole("radio", { name: "Normal" }).click();
  await expect(normalDock).toHaveAttribute("open", "");
  await expect(colorDock).not.toHaveAttribute("open", "");
});

test("switching back to Albedo restores the tool the Normal view displaced", async({ panel }) => {
  await setMode(panel, "fill");
  await panel.getByRole("button", { name: "Normal map settings" }).click();
  await panel.locator("normal-map-dock [part=normal-map-enable] input").check();

  await panel.getByRole("radio", { name: "Normal" }).click();
  expect((await normalMapState(panel)).mode).toBe("move");

  await panel.getByRole("radio", { name: "Albedo" }).click();
  expect((await normalMapState(panel)).mode).toBe("fill");
});

test.describe("3D preview", () => {
  test.use({ editor: playground({ runtime: true }) });

  function previewNormalMaps(
    panel: Locator
  ): Promise<boolean[]> {
    return panel.page().evaluate(() => {
      const meshes = window.pixelArtEditor?.preview?.scene.meshes ?? [];

      return meshes.map((mesh) => {
        const { material } = mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

        return material.normalMap !== null;
      });
    });
  }

  test("applies the normal map while it is enabled", async({ panel }) => {
    await addUvRegion(panel, kCubeRegion);
    const enable = panel.locator("normal-map-dock [part=normal-map-enable] input");
    await expect.poll(() => previewNormalMaps(panel)).toEqual([false]);

    await panel.getByRole("button", { name: "Normal map settings" }).click();
    await enable.check();
    await expect.poll(() => previewNormalMaps(panel)).toEqual([true]);

    await enable.uncheck();
    await expect.poll(() => previewNormalMaps(panel)).toEqual([false]);
  });
});
