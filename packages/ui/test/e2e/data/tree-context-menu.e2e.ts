// Import Third-party Dependencies
import { boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import {
  TREE_SELECTOR,
  rowOf
} from "../support/tree.ts";

test.describe("Tree context requests", () => {
  test.use({
    example: "data/tree"
  });

  test("a right-click selects the row and opens its menu at the pointer", async({ page }) => {
    const crate = rowOf(page, "crate");
    const box = await boxOf(crate);
    const pointer = {
      x: box.x + 30,
      y: box.y + 4
    };

    await page.mouse.click(pointer.x, pointer.y, { button: "right" });

    const menu = page.getByRole("menu", { name: "Row actions" });
    await expect(crate).toHaveAttribute("aria-selected", "true");
    await expect(menu).toBeVisible();
    await expect.poll(async() => (await menu.boundingBox())?.x).toBeCloseTo(pointer.x, 0);
    await page.keyboard.press("Escape");
    await expect(crate).toBeFocused();
  });

  test("a right-click inside a multi-selection keeps it", async({ page }) => {
    const crate = rowOf(page, "crate");
    const barrel = rowOf(page, "barrel");
    await crate.click();
    await barrel.click({ modifiers: ["Control"] });
    await expect(crate).toHaveAttribute("aria-selected", "true");

    await barrel.click({ button: "right" });

    await expect(crate).toHaveAttribute("aria-selected", "true");
    await expect(barrel).toHaveAttribute("aria-selected", "true");
  });

  test("Rename from the menu keeps the field focused and commits", async({ page }) => {
    const camera = rowOf(page, "camera");
    await camera.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename" }).click();

    const field = camera.locator(".rename");
    await expect(field).toBeFocused();
    await field.fill("Lens");
    await field.press("Enter");

    await expect(camera).toContainText("Lens");
  });

  test("the browser's keyboard context menu (Shift+F10) opens under the focused row", async({ page }) => {
    const barrel = rowOf(page, "barrel");
    await barrel.click();
    const box = await boxOf(barrel);

    await page.keyboard.press("Shift+F10");

    const menu = page.getByRole("menu", { name: "Row actions" });
    await expect(page.getByRole("menuitem", { name: "Rename" })).toBeFocused();
    await expect.poll(async() => (await menu.boundingBox())?.y).toBeCloseTo(box.y + box.height, 0);
  });

  test("a right-click below the rows requests the tree's menu and keeps the selection", async({ page }) => {
    const tree = page.locator(TREE_SELECTOR);
    await tree.evaluate((element) => {
      element.addEventListener("jolly-context-request", (event) => {
        if (event instanceof CustomEvent) {
          element.setAttribute("data-request", JSON.stringify(event.detail.id));
        }
      });
    });
    const crate = rowOf(page, "crate");
    await crate.click();
    const rows = await boxOf(page.locator(`${TREE_SELECTOR} .rows`));

    await page.mouse.click(rows.x + 20, rows.y + rows.height - 5, { button: "right" });

    await expect(tree).toHaveAttribute("data-request", "null");
    await expect(crate).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("menu")).toBeHidden();
  });

  test("a right-click in the rename field leaves the row menu closed", async({ page }) => {
    const camera = rowOf(page, "camera");
    await camera.dblclick();
    const field = camera.locator(".rename");
    await expect(field).toBeFocused();

    await field.click({ button: "right" });

    await expect(page.getByRole("menu")).toBeHidden();
    await expect(field).toBeVisible();
  });
});
