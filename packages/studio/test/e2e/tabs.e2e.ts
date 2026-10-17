// Import Third-party Dependencies
import { measureBox } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  MAP,
  TEXTURE
} from "./support/assets.ts";
import {
  MAP_TAB,
  TEXTURE_TAB
} from "./support/tabs.ts";

test("starts on home and reorders editor tabs behind it", async({ studio }) => {
  const { tabs } = studio;
  await studio.openOffline();
  await expect(tabs.home).toHaveAttribute("aria-selected", "true");
  await expect(studio.home.root).toBeVisible();

  await studio.assets.open(MAP);
  await studio.openFromHome(TEXTURE);
  await expect(studio.frames.all).toHaveCount(2);
  await expect(studio.home.root).toBeHidden();
  await expect.poll(() => tabs.names()).toEqual(["Home", MAP_TAB, TEXTURE_TAB]);

  await tabs.moveFirst(TEXTURE_TAB);
  await expect.poll(() => tabs.names()).toEqual(["Home", TEXTURE_TAB, MAP_TAB]);

  await tabs.close(TEXTURE_TAB);
  await tabs.close(MAP_TAB);
  await expect(tabs.home).toHaveAttribute("aria-selected", "true");
  await expect(studio.home.root).toBeVisible();
});

test("reopens the tabs after a reload and loads only the active one", async({ studio, page }) => {
  const { tabs } = studio;
  await studio.openOffline();
  await studio.assets.open(MAP);
  await studio.openFromHome(TEXTURE);
  await tabs.tab(MAP_TAB).click();
  await expect(tabs.tab(MAP_TAB)).toHaveAttribute("aria-selected", "true");

  await page.reload();

  await expect.poll(() => tabs.names()).toEqual(["Home", MAP_TAB, TEXTURE_TAB]);
  await expect(tabs.tab(MAP_TAB)).toHaveAttribute("aria-selected", "true");
  await expect(studio.frames.all).toHaveCount(1);

  await tabs.tab(TEXTURE_TAB).click();
  await expect(studio.frames.all).toHaveCount(2);
});

test("an editor tab stops loading once its editor is ready", async({ studio }) => {
  const { tabs } = studio;
  await studio.openOffline();
  await studio.assets.open(MAP);

  await studio.frames.expectReady(studio.frames.only());
  await expect(tabs.tab(MAP_TAB)).not.toHaveAttribute("aria-busy");
  await expect(tabs.tab(MAP_TAB)).not.toHaveAttribute("aria-description");
});

test("an editor takes the full width and home lists it among open editors", async({ studio, page }) => {
  const { home, tabs } = studio;
  await studio.openOffline();
  await expect(home.assetTotal).toHaveText("4");

  await studio.assets.open(MAP);
  await expect(studio.assets.root).toBeHidden();
  const [frame, frames] = await Promise.all([
    measureBox(studio.frames.all),
    measureBox(page.locator("#editor-frames"))
  ]);
  expect(frame.x).toBe(frames.x);
  expect(frame.width).toBe(frames.width);

  await tabs.home.click();
  await expect(studio.assets.root).toBeVisible();
  await expect(home.openEditor(MAP_TAB)).toHaveAttribute("title", `maps/${MAP}`);
  await home.openEditor(MAP_TAB).click();
  await expect(tabs.tab(MAP_TAB)).toHaveAttribute("aria-selected", "true");
});
