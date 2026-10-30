// Import Internal Dependencies
import {
  test,
  expect,
  type Page
} from "../fixtures.ts";
import {
  TREE_SELECTOR,
  findRow
} from "../support/tree.ts";

// CONSTANTS
const kRowCount = 40 * 51;
const kScroller = `${TREE_SELECTOR} .rows`;

function scrollTo(
  page: Page,
  where: "top" | "bottom"
): Promise<void> {
  return page.locator(kScroller).evaluate((element, edge) => {
    element.scrollTop = edge === "top" ? 0 : element.scrollHeight;
  }, where);
}

test.describe("Tree, virtual", () => {
  test.use({
    example: "data/virtual-tree"
  });

  test.beforeEach(async({ page }) => {
    await expect(findRow(page, "folder-0")).toBeVisible();
  });

  test("renders only the rows near the viewport and announces the whole tree", async({ page }) => {
    const rendered = await page.locator(`${TREE_SELECTOR} .row`).count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(kRowCount / 10);

    await expect(findRow(page, "folder-0")).toHaveAttribute("aria-level", "1");
    await expect(findRow(page, "folder-0")).toHaveAttribute("aria-setsize", "40");
    await expect(findRow(page, "asset-0-1")).toHaveAttribute("aria-level", "2");
    await expect(findRow(page, "asset-0-1")).toHaveAttribute("aria-posinset", "2");
    await expect(findRow(page, "asset-0-1")).toHaveAttribute("aria-setsize", "50");

    await scrollTo(page, "bottom");
    await expect(findRow(page, "asset-39-49")).toBeVisible();
    await expect(findRow(page, "folder-0")).toHaveCount(0);
  });

  test("moves focus with the keyboard past the rendered rows", async({ page }) => {
    await findRow(page, "asset-0-0").click();
    for (let step = 0; step < 30; step++) {
      await page.keyboard.press("ArrowDown");
    }

    const target = findRow(page, "asset-0-30");
    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute("aria-selected", "true");
    await expect(target).toBeInViewport();
  });

  test("scrolls a row into view to rename it", async({ page }) => {
    await page.locator(TREE_SELECTOR).evaluate((element: HTMLElementTagNameMap["jolly-tree"]) => {
      element.beginRename("asset-39-49");
    });

    const field = findRow(page, "asset-39-49").locator(".rename");
    await expect(field).toBeFocused();
    await field.fill("Last.png");
    await field.press("Enter");
    await expect(findRow(page, "asset-39-49").locator(".label")).toHaveText("Last.png");
  });

  test("scrolls a revealed row into view and flashes it without taking focus", async({ page }) => {
    await page.locator(TREE_SELECTOR).evaluate((element: HTMLElementTagNameMap["jolly-tree"]) => {
      element.reveal("asset-39-49");
    });

    const target = findRow(page, "asset-39-49");
    await expect(target).toBeInViewport();
    await expect(target).toHaveAttribute("data-flash", "true");
    await expect(target).not.toBeFocused();
    await expect(target).not.toHaveAttribute("data-flash");
  });

  test("hands the tab stop over to the active row once it is scrolled away", async({ page }) => {
    await findRow(page, "folder-0").click();
    await scrollTo(page, "bottom");
    await expect(findRow(page, "folder-0")).toHaveCount(0);

    await page.locator(TREE_SELECTOR).evaluate((element) => {
      const button = document.createElement("button");
      button.textContent = "Before";
      element.before(button);
      button.focus();
    });
    await page.keyboard.press("Tab");

    await expect(findRow(page, "folder-0")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(findRow(page, "asset-0-0")).toBeFocused();
  });
});
