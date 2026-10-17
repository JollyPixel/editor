// Import Internal Dependencies
import {
  test,
  expect
} from "../../fixtures.ts";
import { openExample } from "../../support/gallery.ts";
import {
  resolveColor,
  readStyle
} from "../../support/styles.ts";

test("a pane header paints the accent fill under a left-origin pixel pattern", async({ page }) => {
  await openExample(page, "scenarios/editor");

  const header = page.locator("jolly-pane > .header").first();
  const [accent, textOnFill] = await Promise.all([
    resolveColor(header, "var(--jolly-accent-fill)"),
    resolveColor(header, "var(--jolly-text-on-fill)")
  ]);

  await expect(header).toHaveCSS("background-color", accent);
  await expect(header).toHaveCSS("color", textOnFill);
  expect(await readStyle(header, "background-image", "::before"))
    .toContain("conic-gradient");
  expect(await readStyle(header, "mask-image", "::before"))
    .toContain("linear-gradient");
  expect(await readStyle(header, "color", "::before")).toBe(textOnFill);
  expect(await readStyle(header, "inset-inline-start", "::before")).toBe("0px");
});
