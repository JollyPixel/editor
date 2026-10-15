// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";

function card(
  page: Page
): Locator {
  return page.getByRole("dialog");
}

function ring(
  page: Page
): Locator {
  return page.locator("jolly-lantern .ring");
}

async function startAt(
  page: Page,
  title: string
): Promise<void> {
  await page.locator("#start").click();
  while (!await card(page).getByRole("heading", { name: title }).isVisible()) {
    await page.keyboard.press("ArrowRight");
    await expect(card(page)).toBeVisible();
  }
}

async function box(
  locator: Locator
) {
  const result = await locator.boundingBox();
  if (result === null) {
    throw new Error("The element has no box");
  }

  return result;
}

async function roundedBox(
  locator: Locator
): Promise<number[]> {
  const { x, y, width, height } = await box(locator);

  return [x, y, width, height].map(Math.round);
}

test.describe("jolly-lantern", () => {
  test.beforeEach(async({ page }) => {
    await page.goto("/");
  });

  test("keeps the spotlight on a target that is resized", async({ page }) => {
    await startAt(page, "Blocks");
    const pane = page.locator("#pane");
    await expect.poll(async() => (await box(ring(page))).width)
      .toBeCloseTo((await box(pane)).width + 12, 0);

    await pane.evaluate((element) => {
      element.style.width = "320px";
    });

    await expect.poll(async() => (await box(ring(page))).width).toBeCloseTo(332, 0);
  });

  test("blocks clicks on the target of a passive step", async({ page }) => {
    await startAt(page, "Blocks");
    const pane = page.locator("#pane");
    await pane.evaluate((element) => {
      element.addEventListener("click", () => element.setAttribute("data-clicked", ""));
    });
    const target = await box(pane);
    await expect.poll(async() => (await box(ring(page))).width)
      .toBeCloseTo(target.width + 12, 0);

    await page.mouse.click(target.x + (target.width / 2), target.y + (target.height / 2));

    await expect(pane).not.toHaveAttribute("data-clicked");
  });

  test("fits the spotlight to a docked pane, its tab included", async({ page }) => {
    await startAt(page, "Docked pane");

    await expect.poll(() => roundedBox(ring(page)))
      .toEqual(await roundedBox(page.locator("#dock")));
  });

  test("lets clicks reach the target of an interactive step", async({ page }) => {
    await startAt(page, "Click the viewport");
    await expect(card(page).getByRole("button", { name: "Waiting…" })).toBeDisabled();
    const viewport = await box(page.locator("#viewport"));
    await expect.poll(async() => (await box(ring(page))).width)
      .toBeCloseTo(viewport.width + 12, 0);

    await page.mouse.click(viewport.x + 20, viewport.y + 20);

    await expect(page.locator("#clicks")).toHaveText("1");
    await expect(card(page).getByRole("heading", { name: "Missing target" })).toBeVisible();
  });

  test("flips the card to the side that fits", async({ page }) => {
    await startAt(page, "Near the edge");
    const target = await box(page.locator("#edge"));

    await expect.poll(async() => {
      const placed = await box(card(page));

      return placed.x + placed.width;
    }).toBeLessThanOrEqual(target.x);
  });

  test("Escape skips the tour and gives focus back", async({ page }) => {
    await page.locator("#start").click();
    await expect(card(page).getByRole("button", { name: "Next" })).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(card(page)).toHaveCount(0);
    await expect(page.locator("#start")).toBeFocused();
  });

  test("offers the follow-up tour on the last step", async({ page }) => {
    await startAt(page, "Click the viewport");
    await page.locator("#viewport").click();
    const followUp = card(page).getByRole("button", { name: "Next tour: More tours" });
    await expect(followUp).toBeFocused();

    await followUp.click();

    await expect(card(page).getByRole("heading", { name: "Chained tour" })).toBeVisible();
  });
});
