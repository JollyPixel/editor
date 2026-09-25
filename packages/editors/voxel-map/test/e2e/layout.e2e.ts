// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";
import {
  centerOf,
  dragTo
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  openPane,
  type PaneName
} from "./support/panels.ts";
import { texturePanel } from "./support/texture.ts";

// CONSTANTS
const kPerformancePane = "performance";
const kPerformanceToggleKey = "F3";

function textureView(
  panel: Locator
) {
  return panel.evaluate((element: PixelDrawPanel) => {
    const { camera, viewport, textureSize } = element.canvasManager!;

    return {
      camera,
      canvasHeight: viewport.canvasHeight,
      textureHeight: textureSize.y * viewport.zoom.value
    };
  });
}

async function showPaneCanvas(
  page: Page,
  pane: PaneName,
  previousHeight: number
) {
  const panel = texturePanel(page);
  await openPane(page, pane);
  await expect.poll(async() => (await textureView(panel)).canvasHeight)
    .not.toBe(previousHeight);

  return textureView(panel);
}

async function textureHost(
  page: Page
) {
  for (const pane of ["blocks", "paint"]) {
    const editor = page.locator(`jolly-pane[key="${pane}"] texture-editor`);
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

async function dragPaneToTab(
  page: Page,
  pane: Locator,
  tab: string
): Promise<void> {
  await dragTo(
    page,
    pane.locator(".header").first(),
    await centerOf(page.getByRole("tab", { name: tab }))
  );
}

function leftGroups(
  page: Page
): Promise<string[][]> {
  return page.evaluate(() => {
    const layout = document.querySelector("jolly-dock-layout")!;

    return layout.snapshot().docks.left.groups.map(
      (group) => [...group.panes]
    );
  });
}

async function dragTabToDock(
  page: Page,
  tab: string,
  dock: string
): Promise<void> {
  await dragTo(
    page,
    page.getByRole("tab", { name: tab }),
    await centerOf(page.locator(`jolly-dock[key='${dock}']`))
  );
}

test("the texture editor follows the shown tab while Blocks and Paint share a group", async({ page }) => {
  await openPane(page, "Blocks");
  await expect.poll(() => textureHost(page)).toEqual({
    pane: "blocks",
    uvAccess: "edit"
  });

  await openPane(page, "Paint");
  await expect.poll(() => textureHost(page)).toEqual({
    pane: "paint",
    uvAccess: "view"
  });
});

test("the texture keeps its frame after a round trip through Paint", async({ page }) => {
  test.slow();
  const panel = texturePanel(page);
  await openPane(page, "Blocks");
  await expect(panel).toHaveAttribute("data-ready", "");
  const blocks = await textureView(panel);
  const paint = await showPaneCanvas(page, "Paint", blocks.canvasHeight);

  const gap = paint.canvasHeight - blocks.canvasHeight;
  const paintHeight = Math.round(paint.textureHeight + 16 + (gap / 2));
  const viewport = page.viewportSize()!;
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height + (paintHeight - paint.canvasHeight)
  });
  await expect.poll(async() => (await textureView(panel)).canvasHeight)
    .toBe(paintHeight);

  const before = await showPaneCanvas(page, "Blocks", paintHeight);
  expect(before.canvasHeight).toBeLessThan(paint.textureHeight + 16);
  await showPaneCanvas(page, "Paint", before.canvasHeight);
  await openPane(page, "Blocks");

  await expect.poll(() => textureView(panel)).toEqual(before);
});

test("the texture editor stays in Paint once it has its own dock", async({ page }) => {
  await dragTabToDock(page, "Paint", "right");
  await expect(page.locator("jolly-dock[key='right'] jolly-pane[key='paint']")).toBeAttached();

  await openPane(page, "Blocks");

  await expect.poll(() => textureHost(page)).toEqual({
    pane: "paint",
    uvAccess: "edit"
  });
  await expect(page.getByRole("listbox", { name: "Blocks" })).toBeVisible();
});

test("the performance readout merges into the pane group it is dropped on", async({ page }) => {
  await page.keyboard.press(kPerformanceToggleKey);
  const readout = page.locator(`jolly-pane[key='${kPerformancePane}']`);
  await expect(readout).toBeAttached();

  await dragPaneToTab(page, readout, "General");

  await expect.poll(() => leftGroups(page)).toEqual([
    ["general", kPerformancePane, "blocks", "paint", "layers"]
  ]);
});
