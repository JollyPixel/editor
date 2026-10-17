// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { findRow } from "../support/tree.ts";

function visibleRowIds(
  page: Page
): Promise<string[]> {
  return page
    .locator("[data-pane=scene] jolly-tree .row")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-id") ?? ""));
}

test.describe("search", () => {
  test.use({
    example: "controls/search"
  });

  test("a compact search expands on click and Escape collapses it onto the trigger", async({ page }) => {
    const compact = page.locator("[data-search=compact]");

    await compact.getByRole("button", { name: "Search" }).click();
    const input = compact.getByRole("searchbox");
    await expect(input).toBeFocused();

    await input.fill("crate");
    await page.keyboard.press("Escape");
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(compact.getByRole("searchbox")).toHaveCount(0);
    await expect(compact.getByRole("button", { name: "Search" })).toBeFocused();
  });

  test("a searchable pane filters its tree and restores the expansion once cleared", async({ page }) => {
    const pane = page.locator("[data-pane=scene]");
    const before = await visibleRowIds(page);

    await findRow(page, "camera").click();
    await page.keyboard.press("Control+f");
    const input = pane.getByRole("searchbox");
    await expect(input).toBeFocused();
    await expect(pane.locator(".title")).toBeHidden();

    await input.fill("lamp");
    await expect.poll(() => visibleRowIds(page))
      .toEqual(["scene", "props", "lamp", "lights", "lamp-light"]);
    await expect(findRow(page, "lamp").locator("mark")).toHaveText("lamp");
    await expect(findRow(page, "lamp").locator(".grip")).toHaveCount(0);
    await expect(findRow(page, "props").locator(".toggle")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect.poll(() => visibleRowIds(page)).toEqual(before);
  });

  test("a searchable pane hides the fields and folders that miss", async({ page }) => {
    const pane = page.locator("[data-pane=inspector]");

    await pane.getByRole("button", { name: "Search Inspector" }).click();
    const input = pane.getByRole("searchbox");

    await input.fill("rot");
    await expect(pane.locator("[data-field=Rotation]")).toBeVisible();
    await expect(pane.locator("[data-field=Position]")).toBeHidden();
    await expect(pane.locator("[data-folder=Rendering]")).toBeHidden();
    await expect(pane.locator("[data-folder=Transform] .toggle")).toHaveCount(0);

    await input.fill("render");
    await expect(pane.locator("[data-field=Material]")).toBeVisible();
    await expect(pane.locator("[data-folder=Transform]")).toBeHidden();

    await input.fill("zebra");
    await expect(pane.getByRole("paragraph")).toHaveText("No matches");
  });
});
