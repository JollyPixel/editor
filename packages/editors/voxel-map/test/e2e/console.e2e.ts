// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";

test("a brush.size write from the console reaches the toolbar", async({ map, commands }) => {
  await commands.submit("brush.size 5");
  await commands.close();

  await expect(map.toolbar.sizeButton(5)).toBeVisible();
});

test("the theme variable restyles the page, console and texture panel", async({ map, page, commands }) => {
  const commandHost = page.locator("jolly-console");
  await map.panes.open("Paint");
  await expect(map.texture.panel).toHaveCSS("color-scheme", "dark");
  await commands.open();
  await expect(commandHost).toHaveAttribute("theme", "dark");

  await commands.submit("theme light");

  await expect(page.locator("jolly-scope").first()).toHaveAttribute("theme", "light");
  await expect(commandHost).toHaveAttribute("theme", "light");
  await expect(map.texture.panel).toHaveCSS("color-scheme", "light");
});

test("the texture panel's pixel-art shortcuts are in the console", async({ commands }) => {
  await commands.submit("pixelart.keybinds.undo");

  await expect(commands.log).toContainText("Mod+z");
});
