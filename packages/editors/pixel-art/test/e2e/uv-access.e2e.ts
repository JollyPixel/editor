// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode
} from "./utils.ts";
import type {
  PixelDrawPanel,
  UvAccess
} from "../../src/index.ts";

async function setUvAccess(
  page: Page,
  access: UvAccess
): Promise<void> {
  await page.evaluate((value) => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
    panel.uvAccess = value;

    return panel.updateComplete;
  }, access);
}

async function readUv(
  page: Page
): Promise<{ mode: string; showAll: boolean; showRegionLabels: boolean; uvClip: boolean; }> {
  return page.evaluate(() => {
    const canvas = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!.canvasManager!;

    return {
      mode: canvas.mode,
      showAll: canvas.uv.showAll,
      showRegionLabels: canvas.uv.showRegionLabels,
      uvClip: canvas.tools.fill.uvClip
    };
  });
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("view hides UV mode but keeps the visibility toggles in the bottom toolbar", async({ page }) => {
  const initial = await readUv(page);
  await setUvAccess(page, "view");

  await expect(page.getByRole("button", { name: "UV", exact: true })).toHaveCount(0);
  await expect(page.locator("pixel-draw-panel [part=uv-toolbar]")).toHaveCount(0);

  const bottom = page.locator("pixel-draw-panel [part=history-file-toolbar]");
  const showAll = bottom.getByRole("button", { name: "Show all" });
  const labels = bottom.getByRole("button", { name: "Show region labels" });

  await showAll.click();
  await expect(showAll).toHaveAttribute("aria-pressed", String(!initial.showAll));
  await labels.click();
  await expect(labels).toHaveAttribute("aria-pressed", String(!initial.showRegionLabels));

  const toggled = await readUv(page);
  expect(toggled.showAll).toBe(!initial.showAll);
  expect(toggled.showRegionLabels).toBe(!initial.showRegionLabels);
});

test("leaving edit while in UV mode falls back to paint", async({ page }) => {
  await setMode(page, "uv");
  await expect(page.locator("pixel-draw-panel [part=uv-toolbar]")).toBeVisible();

  await setUvAccess(page, "view");

  expect((await readUv(page)).mode).toBe("paint");
  await expect(
    page.getByRole("button", { name: "Paint", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("pixel-draw-panel [part=uv-toolbar]")).toHaveCount(0);
});

test("none removes every UV control and turns off the fill clip", async({ page }) => {
  await setMode(page, "fill");
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Fill", exact: true }).hover();
  await page.getByRole("button", { name: "Clip to UV", exact: true }).click();
  expect((await readUv(page)).uvClip).toBe(true);

  await setUvAccess(page, "none");

  expect((await readUv(page)).uvClip).toBe(false);
  await expect(page.getByRole("button", { name: "UV", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clip to UV", exact: true })).toHaveCount(0);
  await expect(page.locator("mode-rail [part=uv-clip-badge]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show all" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show region labels" })).toHaveCount(0);
});

test("the uv-access attribute restores edit when removed", async({ page }) => {
  const panel = page.locator("pixel-draw-panel");
  await panel.evaluate((element) => element.setAttribute("uv-access", "view"));
  await expect(page.getByRole("button", { name: "UV", exact: true })).toHaveCount(0);

  await panel.evaluate((element) => element.removeAttribute("uv-access"));
  await expect(page.getByRole("button", { name: "UV", exact: true })).toBeVisible();
});
