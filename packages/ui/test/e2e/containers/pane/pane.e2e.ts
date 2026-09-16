// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../../support/gallery.ts";
import {
  resolvedColorOf,
  styleOf
} from "../../support/styles.ts";

test("a pane header paints the accent fill under a left-origin pixel pattern", async({ page }) => {
  await openExample(page, "scenarios/editor");

  const header = page.locator("jolly-pane > .header").first();
  const title = header.locator(".title");
  const [accent, textOnFill] = await Promise.all([
    resolvedColorOf(header, "var(--jolly-accent-fill)"),
    resolvedColorOf(header, "var(--jolly-text-on-fill)")
  ]);

  await expect(header).toHaveCSS("background-color", accent);
  await expect(header).toHaveCSS("color", textOnFill);
  await expect(title).toHaveCSS("font-weight", "600");
  await expect(title).toHaveCSS("letter-spacing", "0.88px");
  expect(await styleOf(header, "background-image", "::before"))
    .toContain("conic-gradient");
  expect(await styleOf(header, "mask-image", "::before"))
    .toContain("linear-gradient");
  expect(await styleOf(header, "color", "::before")).toBe(textOnFill);
  expect(await styleOf(header, "inset-inline-start", "::before")).toBe("0px");
  expect(await styleOf(header, "opacity", "::before")).toBe("0.07");
});
