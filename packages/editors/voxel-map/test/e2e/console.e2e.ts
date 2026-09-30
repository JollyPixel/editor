// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";

test("a brush.size write from the console reaches the toolbar", async({ page }) => {
  const prompt = page.getByRole("combobox", { name: "Command" });
  await page.keyboard.press("Control+k");
  await expect(prompt).toBeFocused();

  await prompt.fill("brush.size 5");
  await prompt.press("Enter");
  await expect(page.getByRole("log", { name: "Console output" }))
    .toContainText("brush.size 5");

  await page.keyboard.press("Escape");
  await expect(
    page.locator("voxel-brush-toolbar").getByRole("button", { name: /^Size 5/ })
  ).toBeVisible();
});

test("the host theme variable restyles the page and the open console", async({ page }) => {
  const prompt = page.getByRole("combobox", { name: "Command" });
  await page.keyboard.press("Control+k");
  await expect(page.locator("jolly-console")).toHaveAttribute("theme", "dark");

  await prompt.fill("theme light");
  await prompt.press("Enter");

  await expect(page.locator("jolly-scope").first()).toHaveAttribute("theme", "light");
  await expect(page.locator("jolly-console")).toHaveAttribute("theme", "light");
});
