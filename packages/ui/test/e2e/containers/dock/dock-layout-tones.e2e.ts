// Import Third-party Dependencies
import { centerOf, dragTo } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Page
} from "../../fixtures.ts";
import { openExample } from "../../support/gallery.ts";
import { FloatingWindow } from "../../support/floating.ts";
import {
  resolvedColorOf,
  styleOf
} from "../../support/styles.ts";
import {
  Pane,
  PaneGroup
} from "../../support/pane.ts";

// CONSTANTS
const kExample = "scenarios/dock-layout-tones";

function areaOf(
  page: Page,
  pane: string
): Promise<string> {
  return new Pane(page, pane).root.evaluate(
    (element) => element.style.getPropertyValue("--jolly-area-tone")
  );
}

test.describe("DockLayout tones", () => {
  test("each column keeps its own tone by default", async({ page }) => {
    await openExample(page, kExample);

    expect(await areaOf(page, "general")).toBe("var(--jolly-tone-sky)");
    expect(await areaOf(page, "paint")).toBe("var(--jolly-tone-pink)");
    await expect(new Pane(page, "assets").root)
      .not.toHaveAttribute("toned");
  });

  test("shades the selected tab underline from its tone: light on dark, deep on light", async({ page }) => {
    const group = new PaneGroup(page);
    function underline(): Promise<string> {
      return styleOf(group.selectedTab, "background-color", "::after");
    }
    function shade(
      color: string
    ): Promise<string> {
      return resolvedColorOf(group.root, color);
    }

    await openExample(page, kExample, { theme: "dark" });
    await group.tab("Blocks").click();
    expect(await underline())
      .toBe(await shade("var(--jolly-tone-amber-on-fill)"));

    await openExample(page, kExample, { theme: "light" });
    await group.tab("Blocks").click();
    expect(await underline())
      .toBe(await shade("color-mix(in oklab, var(--jolly-tone-amber-fill) 70%, black)"));
  });

  test("share-tone paints both columns with the leading tone", async({ page }) => {
    await openExample(page, kExample, {
      options: { shareTone: true }
    });

    await expect.poll(() => areaOf(page, "paint"))
      .toBe("var(--jolly-tone-sky)");
    await expect.poll(() => areaOf(page, "assets"))
      .toBe("var(--jolly-tone-violet)");

    await new PaneGroup(page).tab("Blocks").click();

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
      new Pane(page, "paint").header.first(),
      await centerOf(page.locator(".dock-layout-viewport"))
    );

    await expect(new FloatingWindow(page, "paint").root)
      .toHaveCount(1);
    await expect.poll(() => areaOf(page, "paint"))
      .toBe("var(--jolly-tone-pink)");
  });
});
