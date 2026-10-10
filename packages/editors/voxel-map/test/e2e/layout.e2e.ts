// Import Third-party Dependencies
import type { Locator } from "@playwright/test";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { PaneName } from "./support/dock.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kPerformancePane = "performance";
const kPerformanceToggleKey = "F3";

function textureView(
  map: VoxelMapPage
) {
  return map.texture.panel.evaluate((element: PixelDrawPanel) => {
    const { camera, viewport, textureSize } = element.canvasManager!;

    return {
      camera,
      canvasHeight: viewport.canvasHeight,
      textureHeight: textureSize.y * viewport.zoom.value
    };
  });
}

async function showPaneCanvas(
  map: VoxelMapPage,
  pane: PaneName,
  previousHeight: number
) {
  await map.panes.open(pane);
  await expect.poll(async() => (await textureView(map)).canvasHeight)
    .not.toBe(previousHeight);

  return textureView(map);
}

async function textureHost(
  map: VoxelMapPage
) {
  for (const pane of ["blocks", "paint"]) {
    const editor = map.panes.pane(pane).locator("texture-editor");
    if (await editor.count() === 1) {
      return {
        pane,
        uvAccess: await editor.evaluate(
          (element: HTMLElementTagNameMap["texture-editor"]) => element.uvAccess
        )
      };
    }
  }

  return null;
}

async function performanceReadout(
  map: VoxelMapPage
): Promise<Locator> {
  const readout = map.panes.pane(kPerformancePane);
  await expect(readout).toBeAttached();

  return readout;
}

function leftGroups(
  map: VoxelMapPage
): Promise<string[][]> {
  return map.page.evaluate(() => {
    const layout = document.querySelector("jolly-dock-layout")!;

    return layout.snapshot().docks.left.groups.map(
      (group) => [...group.panes]
    );
  });
}

test("the texture editor follows the shown tab while Blocks and Paint share a group", async({ map }) => {
  await map.panes.open("Blocks");
  await expect.poll(() => textureHost(map)).toEqual({
    pane: "blocks",
    uvAccess: "edit"
  });

  await map.panes.open("Paint");
  await expect.poll(() => textureHost(map)).toEqual({
    pane: "paint",
    uvAccess: "view"
  });
});

test("the texture keeps its frame after a round trip through Paint", async({ map, page }) => {
  test.slow();
  await map.panes.open("Blocks");
  await expect(map.texture.panel).toHaveAttribute("data-ready", "");
  const blocks = await textureView(map);
  const paint = await showPaneCanvas(map, "Paint", blocks.canvasHeight);

  const gap = paint.canvasHeight - blocks.canvasHeight;
  const paintHeight = Math.round(paint.textureHeight + 16 + (gap / 2));
  const viewport = page.viewportSize()!;
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height + (paintHeight - paint.canvasHeight)
  });
  await expect.poll(async() => (await textureView(map)).canvasHeight)
    .toBe(paintHeight);

  const before = await showPaneCanvas(map, "Blocks", paintHeight);
  expect(before.canvasHeight).toBeLessThan(paint.textureHeight + 16);
  await showPaneCanvas(map, "Paint", before.canvasHeight);
  await map.panes.open("Blocks");

  await expect.poll(() => textureView(map)).toEqual(before);
});

test("the texture editor stays in Paint once it has its own dock", async({ map }) => {
  await map.panes.moveTab("Paint", "right");
  await expect(map.panes.dock("right").locator("jolly-pane[key='paint']")).toBeAttached();

  await map.panes.open("Blocks");

  await expect.poll(() => textureHost(map)).toEqual({
    pane: "paint",
    uvAccess: "edit"
  });
  await expect(map.blocks.library.listbox).toBeVisible();
});

test("the Materials pane shows its block library only while Blocks is not on screen", async({
  map,
  page
}) => {
  const materialsLibrary = map.materials.blockLibrary;
  await map.panes.open("Materials");
  await expect(materialsLibrary).toBeVisible();

  await map.panes.moveTab("Blocks", "right");
  await map.panes.open("Materials");
  await expect(materialsLibrary).toHaveCount(0);
  await expect(page.getByRole("listbox", { name: "Blocks" })).toHaveCount(1);

  await map.panes.dock("right").locator(".resize-handle").dblclick();
  await expect(materialsLibrary).toBeVisible();
});

test("the performance readout merges into the pane group it is dropped on", async({ map, page }) => {
  const readout = await performanceReadout(map);
  await page.keyboard.press(kPerformanceToggleKey);
  await expect(readout).toBeVisible();

  await map.panes.movePane(readout, "General");

  await expect.poll(() => leftGroups(map)).toEqual([
    ["general", kPerformancePane, "blocks", "materials", "paint", "layers"]
  ]);
});

test("the performance toggle key still toggles the readout once docked", async({ map, page }) => {
  const readout = await performanceReadout(map);
  await page.keyboard.press(kPerformanceToggleKey);
  await expect(readout).toBeVisible();

  await map.panes.movePane(readout, "General");
  await expect(
    map.panes.dock("left").locator(`jolly-pane[key='${kPerformancePane}']`)
  ).toBeVisible();

  await page.keyboard.press(kPerformanceToggleKey);
  await expect(readout).toBeHidden();
  await page.keyboard.press(kPerformanceToggleKey);
  await expect(readout).toBeVisible();
});
