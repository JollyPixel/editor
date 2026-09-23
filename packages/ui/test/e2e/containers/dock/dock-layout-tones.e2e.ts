// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";
import { centerOf, dragTo } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../../support/gallery.ts";

// CONSTANTS
const kExample = "scenarios/dock-layout-tones";

function areaOf(
  page: Page,
  pane: string
): Promise<string> {
  return page.locator(`jolly-pane[key='${pane}']`).evaluate(
    (element) => element.style.getPropertyValue("--jolly-area-tone")
  );
}

test.describe("DockLayout tones", () => {
  test("each column keeps its own tone by default", async({ page }) => {
    await openExample(page, kExample);

    expect(await areaOf(page, "general")).toBe("var(--jolly-tone-sky)");
    expect(await areaOf(page, "paint")).toBe("var(--jolly-tone-pink)");
    await expect(page.locator("jolly-pane[key='assets']"))
      .not.toHaveAttribute("toned");
  });

  test("share-tone paints both columns with the leading tone", async({ page }) => {
    await openExample(page, kExample, {
      options: { shareTone: true }
    });

    await expect.poll(() => areaOf(page, "paint"))
      .toBe("var(--jolly-tone-sky)");
    await expect.poll(() => areaOf(page, "assets"))
      .toBe("var(--jolly-tone-violet)");

    await page.locator("jolly-pane-group .tab[data-key='blocks']").click();

    await expect.poll(() => areaOf(page, "paint"))
      .toBe("var(--jolly-tone-amber)");
    await expect.poll(() => areaOf(page, "general"))
      .toBe("var(--jolly-tone-amber)");
  });

  test("a pane dragged out of a sharing dock returns to its own tone", async({ page }) => {
    await openExample(page, kExample, {
      options: { shareTone: true }
    });
    await expect.poll(() => areaOf(page, "paint"))
      .toBe("var(--jolly-tone-sky)");

    await dragTo(
      page,
      page.locator("jolly-pane[key='paint'] .header").first(),
      await centerOf(page.locator(".dock-layout-viewport"))
    );

    await expect(page.locator("jolly-floating jolly-pane[key='paint']"))
      .toHaveCount(1);
    await expect.poll(() => areaOf(page, "paint"))
      .toBe("var(--jolly-tone-pink)");
  });
});
