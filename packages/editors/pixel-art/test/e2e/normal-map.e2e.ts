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
  await panel.getByRole("button", { name: "Export textures" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("menuitem", { name: `Normal map — ${convention}` }).click()
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

test("bottom toolbar stays reachable as the panel narrows", async({ panel }) => {
  await panel.getByRole("button", { name: "Normal map settings" }).click();
  await panel.locator("normal-map-dock [part=normal-map-enable] input").check();
  await panel.evaluate((element: PixelDrawPanel) => {
    element.uvAccess = "view";
  });

  for (const width of [600, 350, 240]) {
    await panel.evaluate((element, value) => {
      element.style.width = `${value}px`;
      element.style.flex = "none";
    }, width);
    await expect.poll(() => panel.evaluate((element) => {
      const root = element.shadowRoot!;
      const stage = root.querySelector(".stage")!.getBoundingClientRect();
      const buttons = root.querySelectorAll(
        "[part=history-file-toolbar] button:not([role=menuitem])"
      );

      return Array.from(buttons).every((button) => {
        const box = button.getBoundingClientRect();

        return box.width > 0 && box.left >= stage.left + 7 &&
          box.right <= stage.right - 7 && box.bottom <= stage.bottom;
      });
    })).toBe(true);
    await panel.getByRole("radio", { name: "Normal", exact: true }).click();
    await expect(panel.getByRole("radio", { name: "Normal", exact: true }))
      .toHaveAttribute("aria-checked", "true");
    await panel.getByRole("radio", { name: "Albedo", exact: true }).click();
    const visibility = panel.getByRole("button", { name: "Region visibility" });
    await visibility.click();
    const menu = panel.getByRole("dialog", { name: "Region visibility" });
    await expect(menu.getByRole("checkbox", { name: "Show region labels" }))
      .toBeVisible();
    const menuBox = await menu.boundingBox();
    const triggerBox = await visibility.boundingBox();
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(triggerBox!.y);
    await menu.getByRole("checkbox", { name: "Show region labels" })
      .press("Escape");
  }
});

test("normal map toolbar actions appear only while enabled", async({ panel }) => {
  await setMode(panel, "uv");
  const exportButton = panel.getByRole("button", { name: "Export textures" });
  const overrideButton = panel.getByRole("button", { name: "Override normal map" });
  const enable = panel.locator("normal-map-dock [part=normal-map-enable] input");
  const viewSwitch = panel.getByRole("radiogroup", { name: "Texture view" });
  const normal = panel.getByRole("radio", { name: "Normal", exact: true });

  await expect(exportButton).toBeHidden();
  await expect(panel.getByRole("button", { name: "Export texture", exact: true }))
    .toBeVisible();
  await expect(overrideButton).toBeHidden();
  await expect(viewSwitch).toHaveCount(0);

  await panel.getByRole("button", { name: "Normal map settings" }).click();
  await enable.check();
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeEnabled();
  await expect(overrideButton).toBeVisible();
  await expect(overrideButton).toBeDisabled();
  await expect(viewSwitch).toBeVisible();
  await normal.click();
  await expect(normal).toHaveAttribute("aria-checked", "true");

  await enable.uncheck();
  await expect(viewSwitch).toHaveCount(0);
  expect((await normalMapState(panel)).view).toBe("albedo");
  await expect(panel.getByRole("button", { name: "Paint", exact: true }))
    .toBeEnabled();
  await expect(exportButton).toBeHidden();
  await expect(overrideButton).toBeHidden();

  await enable.check();
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeEnabled();
  await expect(overrideButton).toBeVisible();
  await expect(viewSwitch).toBeVisible();
  await expect(panel.getByRole("radio", { name: "Albedo", exact: true }))
    .toHaveAttribute("aria-checked", "true");
});

test("enable, view, override a region and export the normal map", async({ panel, page }) => {
  await seedTexture(panel, [
    { x: 0, y: 0, width: TEXTURE_SIZE.x, height: TEXTURE_SIZE.y, color: "#808080" },
    { ...kBump, color: "#ffffff" },
    { ...kCubeCell, color: "#ffffff" }
  ]);
  const dock = panel.locator("normal-map-dock");

  await panel.getByRole("button", { name: "Normal map settings" }).click();
  await expect(dock).toHaveAttribute("open", "");
  await dock.locator("[part=normal-map-enable] input").check();
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
  await panel.getByRole("button", { name: "Region visibility" }).click();
  const showAll = panel.getByRole("checkbox", { name: "Show all regions" });
  await showAll.check();
  await showAll.press("Escape");
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

  const exportButton = panel.getByRole("button", { name: "Export textures" });
  await exportButton.focus();
  await exportButton.press("Enter");
  const albedo = panel.getByRole("menuitem", { name: "Albedo texture" });
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

  await panel.getByRole("radio", { name: "Albedo" }).click();
  await expect(panel.getByRole("button", { name: "Paint", exact: true })).toBeEnabled();
  await expect.poll(() => readRenderedPixels(panel, [kBump])).toEqual(["#ffffffff"]);
});

test("export menu highlights the hovered and keyboard-focused row", async({ panel, page }) => {
  await panel.getByRole("button", { name: "Normal map settings" }).click();
  await panel.locator("normal-map-dock [part=normal-map-enable] input").check();

  for (const theme of ["light", "dark"] as const) {
    await panel.evaluate((element: PixelDrawPanel, value) => {
      element.theme = value;
    }, theme);
    await panel.getByRole("button", { name: "Export textures" }).click();
    const albedo = panel.getByRole("menuitem", { name: "Albedo texture" });
    const opengl = panel.getByRole("menuitem", { name: "Normal map — OpenGL (Y+)" });
    const directx = panel.getByRole("menuitem", { name: "Normal map — DirectX (Y-)" });
    const idle = await opengl.evaluate((element) => (
      getComputedStyle(element).backgroundColor
    ));

    await opengl.hover();
    await expect(opengl).not.toHaveCSS("background-color", idle);
    await directx.hover();
    await expect(opengl).toHaveCSS("background-color", idle);
    await expect(directx).not.toHaveCSS("background-color", idle);

    await panel.getByRole("button", { name: "Export textures" }).hover();
    await albedo.focus();
    await page.keyboard.press("Tab");
    await expect(opengl).toBeFocused();
    await expect(opengl).not.toHaveCSS("background-color", idle);
    await page.keyboard.press("Escape");
    await expect(opengl).toBeHidden();
  }
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
  await normalDock.locator("[part=normal-map-enable] input").check();
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
