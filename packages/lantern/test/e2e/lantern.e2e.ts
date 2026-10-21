// Import Third-party Dependencies
import {
  measureBox,
  measureCenter,
  measureWidth,
  type Box
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

// CONSTANTS
const kHolePadding = 6;

function rounded(
  box: Box
): number[] {
  return [box.x, box.y, box.width, box.height].map(Math.round);
}

test.describe("jolly-lantern", () => {
  test("keeps the spotlight on a target that is resized", async({ example }) => {
    await example.startAt("Blocks");
    await expect.poll(() => measureWidth(example.spotlight))
      .toBeCloseTo(await measureWidth(example.pane) + (kHolePadding * 2), 0);

    await example.pane.evaluate((element) => {
      element.style.width = "320px";
    });

    await expect.poll(() => measureWidth(example.spotlight))
      .toBeCloseTo(320 + (kHolePadding * 2), 0);
  });

  test("blocks clicks on the target of a passive step", async({ example, page }) => {
    await example.startAt("Blocks");
    await example.pane.evaluate((element) => {
      element.addEventListener("click", () => element.setAttribute("data-clicked", ""));
    });
    await expect.poll(() => measureWidth(example.spotlight))
      .toBeCloseTo(await measureWidth(example.pane) + (kHolePadding * 2), 0);

    const center = await measureCenter(example.pane);
    await page.mouse.click(center.x, center.y);

    await expect(example.pane).not.toHaveAttribute("data-clicked");
  });

  test("fits the spotlight to a docked pane, its tab included", async({ example }) => {
    await example.startAt("Docked pane");

    await expect.poll(async() => rounded(await measureBox(example.spotlight)))
      .toEqual(rounded(await measureBox(example.dock)));
  });

  test("lets clicks reach the target of an interactive step", async({ example, page }) => {
    await example.startAt("Click the viewport");
    await expect(example.card.button("Waiting…")).toBeDisabled();
    await expect.poll(() => measureWidth(example.spotlight))
      .toBeCloseTo(await measureWidth(example.viewport) + (kHolePadding * 2), 0);

    const viewport = await measureBox(example.viewport);
    await page.mouse.click(viewport.x + 20, viewport.y + 20);

    await expect(example.clicks).toHaveText("1");
    await expect(example.card.heading("Missing target")).toBeVisible();
  });

  test("flips the card to the side that fits", async({ example }) => {
    await example.startAt("Near the edge");
    const target = await measureBox(example.helpButton);

    await expect.poll(async() => {
      const card = await measureBox(example.card.root);

      return card.x + card.width;
    }).toBeLessThanOrEqual(target.x);
  });

  test("Escape skips the tour and gives focus back", async({ example, page }) => {
    await example.startButton.click();
    await expect(example.card.button("Next")).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(example.card.root).toHaveCount(0);
    await expect(example.startButton).toBeFocused();
  });

  test("offers the follow-up tour on the last step", async({ example }) => {
    await example.startAt("Click the viewport");
    await example.viewport.click();
    const followUp = example.card.button("Next tour: More tours");
    await expect(followUp).toBeFocused();

    await followUp.click();

    await expect(example.card.heading("Chained tour")).toBeVisible();
  });
});
