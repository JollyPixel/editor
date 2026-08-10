// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { manifest } from "../../examples/scripts/manifest.ts";
import {
  disposedIds,
  gotoGallery
} from "./utils.ts";

/**
 * Every later test opts out of the shell with `chrome=off`, so it keeps a suite of its own: a nav
 * or router regression fails here by name instead of reddening every component report.
 */
test.describe("gallery shell", () => {
  test("renders one nav entry per manifest example", async({ page }) => {
    await gotoGallery(page);

    const links = page.locator("gallery-root nav a");
    await expect(links).toHaveCount(manifest.length);
    await expect(links).toHaveText(manifest.map((example) => example.title));
  });

  test("selects the first example by default", async({ page }) => {
    await gotoGallery(page);

    await expect(page.locator("gallery-root nav a[aria-current='page']"))
      .toHaveText(manifest[0].title);
  });

  test("a deep link selects the requested entry", async({ page }) => {
    const target = manifest[1];
    await gotoGallery(page, { example: target.id });

    await expect(page.locator("gallery-root nav a[aria-current='page']"))
      .toHaveText(target.title);
    await expect(page.locator("gallery-root .peer-row")).toBeVisible();
  });

  test("an unknown example id falls back to the first entry", async({ page }) => {
    await gotoGallery(page, { example: "does/not-exist" });

    await expect(page.locator("gallery-root nav a[aria-current='page']"))
      .toHaveText(manifest[0].title);
  });

  test("selecting an entry swaps the content and updates the url", async({ page }) => {
    await gotoGallery(page);
    await expect(page.locator("gallery-root .token-grid")).toBeVisible();

    await page.locator(`gallery-root nav a[data-example-id="${manifest[1].id}"]`).click();

    await expect(page.locator("gallery-root .peer-row")).toBeVisible();
    await expect(page.locator("gallery-root .token-grid")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("example")).toBe(manifest[1].id);
  });

  test("swapping runs the previous example's teardown before mounting the next", async({ page }) => {
    await gotoGallery(page);
    expect(await disposedIds(page)).toEqual([]);

    await page.locator(
      `gallery-root nav a[data-example-id="${manifest[1].id}"]`
    ).click();
    await expect(page.locator("gallery-root .peer-row")).toBeVisible();

    expect(await disposedIds(page)).toEqual([manifest[0].id]);
  });

  test("going back restores the previous example", async({ page }) => {
    await gotoGallery(page);
    await page.locator(
      `gallery-root nav a[data-example-id="${manifest[1].id}"]`
    ).click();
    await expect(page.locator("gallery-root .peer-row")).toBeVisible();

    await page.goBack();

    await expect(page.locator("gallery-root .token-grid")).toBeVisible();
  });

  test("chrome=off renders the example with no nav", async({ page }) => {
    await gotoGallery(page, {
      example: manifest[0].id,
      chrome: "off"
    });

    await expect(page.locator("gallery-root nav")).toHaveCount(0);
    await expect(page.locator("gallery-root .token-grid")).toBeVisible();
  });

  test("the theme attribute flips the resolved colour scheme", async({ page }) => {
    await gotoGallery(page, { theme: "dark" });
    const dark = await page.locator("gallery-root .token-swatch").first()
      .evaluate((node) => getComputedStyle(node).backgroundColor);

    await gotoGallery(page, { theme: "light" });
    const light = await page.locator("gallery-root .token-swatch").first()
      .evaluate((node) => getComputedStyle(node).backgroundColor);

    expect(dark).not.toBe(light);
  });
});

/** Catches "throws on mount" across the library, and grows as later phases add entries. */
test.describe("manifest sweep", () => {
  for (const example of manifest) {
    test(`${example.id} mounts and disposes without throwing`, async({ page }) => {
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") {
          failures.push(message.text());
        }
      });

      await gotoGallery(page, { example: example.id });
      await expect(page.locator("gallery-root main")).not.toBeEmpty();

      // Selecting in-page, not a second goto: a reload discards the tree without ever
      // calling the teardown this is meant to exercise.
      const next = manifest.find((entry) => entry.id !== example.id) ?? example;
      await page.locator(`gallery-root nav a[data-example-id="${next.id}"]`).click();
      await expect(page.locator("gallery-root main")).not.toBeEmpty();

      expect(await disposedIds(page)).toContain(example.id);
      expect(failures).toEqual([]);
    });
  }
});
