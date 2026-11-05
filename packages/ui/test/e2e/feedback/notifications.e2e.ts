// Import Third-party Dependencies
import { measureBox } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { openExample } from "../support/gallery.ts";
import { runUntilGone } from "../support/clock.ts";

test.describe("Notifications", () => {
  test.beforeEach(async({ page }) => {
    await page.clock.install();
    await openExample(page, "feedback/notifications");
  });

  test("settles a loading chip into a success chip that closes by itself", async({ page }) => {
    await page.locator("[data-action=notify-upload]").click();

    const chip = page.locator("jolly-notifications .chip");
    await expect(chip).toHaveAttribute("data-tone", "loading");
    await expect(chip.locator("jolly-spinner")).toBeVisible();
    await expect(chip.locator("jolly-progress")).toBeVisible();

    await page.clock.runFor(3_000);
    await expect(chip).toHaveAttribute("data-tone", "success");
    await expect(chip).toContainText("Uploaded \"forest.glb\"");
    await expect(chip.locator("jolly-progress")).toHaveCount(0);
    await runUntilGone(page, chip);
  });

  test("keeps an error until its close button dismisses it", async({ page }) => {
    await page.locator("[data-action=notify-error]").click();

    const chip = page.locator("jolly-notifications .chip");
    await expect(chip).toHaveAttribute("role", "alert");
    await page.clock.runFor(60_000);
    await expect(chip).toHaveCount(1);

    await chip.getByRole("button", { name: "Dismiss" }).click();
    await runUntilGone(page, chip);
  });

  test("holds its timers while hovered", async({ page }) => {
    await page.locator("[data-action=notify-success]").click();

    const chip = page.locator("jolly-notifications .chip");
    await chip.hover();
    await page.clock.runFor(10_000);
    await expect(chip).toHaveCount(1);

    await page.mouse.move(0, 0);
    await runUntilGone(page, chip);
  });

  test("stacks the newest chip nearest its corner", async({ page }) => {
    await page.locator("[data-action=notify-info]").click();
    await page.locator("[data-action=notify-warning]").click();

    const chips = page.locator("jolly-notifications .chip");
    await expect(chips).toHaveCount(2);
    const width = await page.evaluate(() => window.innerWidth);

    const newest = await measureBox(chips.nth(0));
    const older = await measureBox(chips.nth(1));
    expect(newest.y).toBeGreaterThan(older.y);
    expect(newest.x + newest.width).toBeGreaterThan(width - 40);

    await page.locator("[data-placement=top-start]").click();
    await expect.poll(async() => (await measureBox(chips.nth(0))).x)
      .toBeLessThan(40);
    expect((await measureBox(chips.nth(0))).y)
      .toBeLessThan((await measureBox(chips.nth(1))).y);
  });
});
