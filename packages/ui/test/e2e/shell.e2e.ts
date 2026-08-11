// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import { manifest } from "../../examples/scripts/manifest.ts";
import {
  disposedIds,
  gotoGallery
} from "./utils.ts";

/**
 * Every later test opts out of the shell with `chrome=off`, so it keeps a
 * suite of its own: a nav or router regression fails here by name instead of
 * reddening every component report.
 */
test.describe("gallery shell", () => {
  test("scopes full-size pane CSS to its navigation pane", async({ page }) => {
    await gotoGallery(page, { example: "containers/pane" });

    await expect(page.locator("gallery-root .gallery-pane")).toHaveCount(1);
    await expect(page.locator("gallery-root main jolly-pane.gallery-pane"))
      .toHaveCount(0);
  });

  test("uses on-fill text in navigation pane actions", async({ page }) => {
    await gotoGallery(page);

    const pane = page.locator("gallery-root .gallery-pane");
    const headerColor = await pane.locator(":scope > .header")
      .evaluate((element) => getComputedStyle(element).color);
    const actionText = [
      pane.locator("jolly-button-group .segment").first(),
      pane.locator("jolly-select select")
    ];

    for (const target of actionText) {
      await expect(target).toHaveCSS("color", headerColor);
    }
  });

  test("places the navigation title above responsive actions", async({ page }) => {
    await gotoGallery(page);

    const pane = page.locator("gallery-root .gallery-pane");
    const initial = await galleryHeaderLayout(pane);

    expect(initial.titleBottom).toBeLessThanOrEqual(initial.actionsTop);
    expect(initial.themeTop).toBe(initial.densityTop);
    expect(initial.themeWidth).toBeGreaterThanOrEqual(96);
    expect(initial.densityWidth).toBeGreaterThanOrEqual(96);

    await page.locator("gallery-root jolly-dock").evaluate((element) => {
      element.style.width = "160px";
    });
    const narrow = await galleryHeaderLayout(pane);

    expect(narrow.titleBottom).toBeLessThanOrEqual(narrow.actionsTop);
    expect(narrow.densityTop).toBeGreaterThan(narrow.themeTop);
    expect(narrow.themeWidth).toBeGreaterThanOrEqual(96);
    expect(narrow.densityWidth).toBeGreaterThanOrEqual(96);
  });

  test("renders one nav entry per manifest example", async({ page }) => {
    await gotoGallery(page);

    const links = page.locator("gallery-root nav a");
    await expect(links).toHaveCount(manifest.length);
    await expect(links).toHaveText(
      manifest.map((example) => example.title)
    );
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

    await page.locator(
      `gallery-root nav a[data-example-id="${manifest[1].id}"]`
    ).click();

    await expect(page.locator("gallery-root .peer-row")).toBeVisible();
    await expect(page.locator("gallery-root .token-grid")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("example")).toBe(manifest[1].id);
  });

  test("swapping runs the previous teardown first", async({ page }) => {
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

  test("density preference stays selected across visuals and reloads", async({ page }) => {
    await gotoGallery(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "jolly-ui-gallery:density",
        "comfortable"
      );
    });
    await page.reload();
    await page.waitForFunction(
      () => window.__galleryReady === true
    );

    const control = page.locator("gallery-root jolly-pane jolly-select");
    const select = control.locator("select");

    await expect(control).toHaveJSProperty("value", "comfortable");
    await expect(select).toHaveValue("2");
    await expect(select.locator("option:checked")).toHaveText("Comfortable");

    await select.selectOption({ label: "Default" });
    await page.locator(
      `gallery-root nav a[data-example-id="${manifest[1].id}"]`
    ).click();

    await expect(control).toHaveJSProperty("value", "default");
    await expect(select).toHaveValue("1");

    await page.reload();
    await page.waitForFunction(
      () => window.__galleryReady === true
    );
    await expect(
      page.locator("gallery-root jolly-pane jolly-select select")
    ).toHaveValue("1");
  });

  test("dark density Select uses themed closed and dropdown surfaces", async({ page }) => {
    await gotoGallery(page, { theme: "dark" });

    const select = page.locator(
      "gallery-root jolly-pane jolly-select select"
    );
    const segment = page.locator(
      "gallery-root jolly-pane jolly-button-group .segment[aria-checked='false']"
    ).first();
    const selectStyle = await select.evaluate((node) => {
      const style = getComputedStyle(node);

      return {
        backgroundColor: style.backgroundColor,
        colorScheme: style.colorScheme
      };
    });
    const segmentBackground = await segment.evaluate(
      (node) => getComputedStyle(node).backgroundColor
    );
    const dropdownStyle = await select.evaluate((node) => {
      const option = node.querySelector("option");
      const probe = document.createElement("span");
      probe.style.background = "var(--jolly-surface-raised)";
      node.parentElement?.append(probe);
      const surfaceBackground = getComputedStyle(probe).backgroundColor;
      probe.remove();

      return {
        optionBackground: option === null
          ? ""
          : getComputedStyle(option).backgroundColor,
        surfaceBackground
      };
    });

    expect(selectStyle.colorScheme).toBe("dark");
    expect(selectStyle.backgroundColor).toBe(segmentBackground);
    expect(dropdownStyle.optionBackground).toBe(
      dropdownStyle.surfaceBackground
    );
  });
});

async function galleryHeaderLayout(
  pane: Locator
) {
  return pane.evaluate((element) => {
    const title = element.shadowRoot?.querySelector(".title");
    const actions = element.shadowRoot?.querySelector(".actions");
    const theme = element.querySelector("jolly-button-group");
    const density = element.querySelector("jolly-select");
    if (
      title === null ||
      title === undefined ||
      actions === null ||
      actions === undefined ||
      theme === null ||
      density === null
    ) {
      throw new Error("Gallery pane header is incomplete");
    }

    const titleRect = title.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const themeRect = theme.getBoundingClientRect();
    const densityRect = density.getBoundingClientRect();

    return {
      titleBottom: titleRect.bottom,
      actionsTop: actionsRect.top,
      themeTop: themeRect.top,
      themeWidth: themeRect.width,
      densityTop: densityRect.top,
      densityWidth: densityRect.width
    };
  });
}

/**
 * Catches "throws on mount" across the library, and grows as later phases add
 * entries.
 */
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
      await page.locator(
        `gallery-root nav a[data-example-id="${next.id}"]`
      ).click();
      await expect(page.locator("gallery-root main")).not.toBeEmpty();

      expect(await disposedIds(page)).toContain(example.id);
      expect(failures).toEqual([]);
    });
  }
});
