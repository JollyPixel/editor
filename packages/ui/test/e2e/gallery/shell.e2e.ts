// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import { boxOf, widthOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { manifest } from "../../../examples/scripts/manifest.ts";
import {
  disposedIds,
  gotoGallery,
  reloadGallery
} from "../support/gallery.ts";
import {
  resolvedColorOf,
  styleOf
} from "../support/styles.ts";

// CONSTANTS
const [kFirst, kSecond] = manifest;
const kGroups = Map.groupBy(manifest, (example) => example.id.split("/")[0]);

function navLink(
  page: Page,
  id: string
): Locator {
  return page.locator(`gallery-root nav a[data-example-id="${id}"]`);
}

async function selectInPage(
  page: Page,
  id: string,
  title: string
): Promise<void> {
  await navLink(page, id).evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page).toHaveTitle(`${title} | jolly-pixel/ui`);
}

async function headerLayout(
  pane: Locator
) {
  const [title, actions, theme, density] = await Promise.all([
    boxOf(pane.locator(".title")),
    boxOf(pane.locator(".actions")),
    boxOf(pane.locator("jolly-button-group")),
    boxOf(pane.locator("jolly-select"))
  ]);

  return {
    titleBottom: title.y + title.height,
    actionsTop: actions.y,
    themeTop: theme.y,
    themeWidth: theme.width,
    densityTop: density.y,
    densityWidth: density.width
  };
}

test.describe("gallery shell", () => {
  test("renders one nav entry per example and falls back to the first", async({ page }) => {
    const current = page.locator("gallery-root nav a[aria-current='page']");

    await gotoGallery(page);
    await expect(page.locator("gallery-root nav a"))
      .toHaveText(manifest.map((example) => example.title));
    await expect(current).toHaveText(kFirst.title);

    await gotoGallery(page, { example: "does/not-exist" });
    await expect(current).toHaveText(kFirst.title);

    await gotoGallery(page, { example: kSecond.id });
    await expect(current).toHaveText(kSecond.title);
    await expect(page.locator("gallery-root .peer-row")).toBeVisible();
  });

  test("selecting an entry tears down, swaps content, and history restores it", async({ page }) => {
    await gotoGallery(page);
    await expect(page.locator("gallery-root .token-grid")).toBeVisible();
    expect(await disposedIds(page)).toEqual([]);

    await navLink(page, kSecond.id).click();
    await expect(page.locator("gallery-root .peer-row")).toBeVisible();
    await expect(page.locator("gallery-root .token-grid")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("example")).toBe(kSecond.id);
    expect(await disposedIds(page)).toEqual([kFirst.id]);

    await page.goBack();
    await expect(page.locator("gallery-root .token-grid")).toBeVisible();
  });

  test("an option toggle remounts the example, lands in the URL, and leaves with it", async({ page }) => {
    await gotoGallery(page, { example: "containers/tabs" });

    const closable = page.locator("gallery-root .options [data-option=closable] input");
    const close = page.locator("gallery-root jolly-tabs [part~=close]");
    await expect(page.locator("gallery-root .options jolly-checkbox")).toHaveCount(7);
    await expect(close).toHaveCount(0);

    await closable.click();
    await expect(closable).toBeChecked();
    await expect(close).toHaveCount(4);
    expect(new URL(page.url()).searchParams.get("closable")).toBe("1");

    await reloadGallery(page);
    await expect(closable).toBeChecked();
    await expect(close).toHaveCount(4);

    await navLink(page, kFirst.id).click();
    await expect(page.locator("gallery-root .options")).toBeHidden();
    expect(new URL(page.url()).searchParams.has("closable")).toBe(false);
  });

  test("chrome=off renders neither the nav nor the options panel", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/tabs",
      chrome: "off",
      options: { closable: true }
    });

    await expect(page.locator("gallery-root .options")).toHaveCount(0);
    await expect(page.locator("gallery-root jolly-tabs [part~=close]")).toHaveCount(4);
  });

  test("chrome=off renders the example with no nav", async({ page }) => {
    await gotoGallery(page, {
      example: kFirst.id,
      chrome: "off"
    });

    await expect(page.locator("gallery-root nav")).toHaveCount(0);
    await expect(page.locator("gallery-root .token-grid")).toBeVisible();
  });

  test("scopes full-size pane CSS to its navigation pane", async({ page }) => {
    await gotoGallery(page, { example: "containers/pane" });

    await expect(page.locator("gallery-root .gallery-pane")).toHaveCount(1);
    await expect(page.locator("gallery-root main jolly-pane.gallery-pane"))
      .toHaveCount(0);
  });

  test("the navigation header uses on-fill text and wraps its actions", async({ page }) => {
    await gotoGallery(page);

    const pane = page.locator("gallery-root .gallery-pane");
    const headerColor = await styleOf(pane.locator(":scope > .header"), "color");
    await expect(pane.locator("jolly-button-group .segment").first())
      .toHaveCSS("color", headerColor);
    await expect(pane.locator("jolly-select select")).toHaveCSS("color", headerColor);

    const wide = await headerLayout(pane);
    expect(wide.titleBottom).toBeLessThanOrEqual(wide.actionsTop);
    expect(wide.themeTop).toBe(wide.densityTop);

    await page.locator("gallery-root jolly-dock").evaluate((element: HTMLElement) => {
      element.style.width = "160px";
    });
    await expect.poll(() => widthOf(page.locator("gallery-root jolly-dock"))).toBe(160);
    const narrow = await headerLayout(pane);
    expect(narrow.titleBottom).toBeLessThanOrEqual(narrow.actionsTop);
    expect(narrow.densityTop).toBeGreaterThan(narrow.themeTop);

    for (const layout of [wide, narrow]) {
      expect(layout.themeWidth).toBeGreaterThanOrEqual(96);
      expect(layout.densityWidth).toBeGreaterThanOrEqual(96);
    }
  });

  test("the theme attribute flips the resolved colour scheme", async({ page }) => {
    const swatch = page.locator("gallery-root .token-swatch").first();

    await gotoGallery(page, { theme: "dark" });
    const dark = await styleOf(swatch, "background-color");
    await gotoGallery(page, { theme: "light" });

    expect(await styleOf(swatch, "background-color")).not.toBe(dark);
  });

  test("the density preference survives navigation and reloads", async({ page }) => {
    await gotoGallery(page);
    await page.evaluate(() => {
      localStorage.setItem("jolly-ui-gallery:density", "comfortable");
    });
    await reloadGallery(page);

    const control = page.locator("gallery-root jolly-pane jolly-select");
    const select = control.locator("select");
    await expect(control).toHaveJSProperty("value", "comfortable");
    await expect(select).toHaveValue("2");
    await expect(select.locator("option:checked")).toHaveText("Comfortable");

    await select.selectOption({ label: "Default" });
    await navLink(page, kSecond.id).click();
    await expect(control).toHaveJSProperty("value", "default");
    await expect(select).toHaveValue("1");

    await reloadGallery(page);
    await expect(select).toHaveValue("1");
  });

  test("the dark density select themes its closed and dropdown surfaces", async({ page }) => {
    await gotoGallery(page, { theme: "dark" });

    const select = page.locator("gallery-root jolly-pane jolly-select select");
    const segment = page.locator(
      "gallery-root jolly-pane jolly-button-group .segment[aria-checked='false']"
    ).first();

    await expect(select).toHaveCSS("color-scheme", "dark");
    await expect(select).toHaveCSS(
      "background-color",
      await styleOf(segment, "background-color")
    );
    await expect(select.locator("option").first()).toHaveCSS(
      "background-color",
      await resolvedColorOf(select, "var(--jolly-surface-raised)")
    );
  });
});

test.describe("manifest sweep", () => {
  for (const [group, examples] of kGroups) {
    test(`${group} examples mount and tear down without errors`, async({ page }) => {
      const failures: string[] = [];
      let phase = `mount ${examples[0].id}`;
      page.on("pageerror", (error) => failures.push(`${phase}: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") {
          failures.push(`${phase}: ${message.text()}`);
        }
      });

      await gotoGallery(page, { example: examples[0].id });
      const exit = manifest.find((entry) => !entry.id.startsWith(`${group}/`)) ?? kFirst;
      const route = [...examples, exit];
      for (let index = 1; index < route.length; index++) {
        const previous = route[index - 1].id;
        const next = route[index];
        phase = `${previous} -> ${next.id}`;
        await test.step(phase, async() => {
          await selectInPage(page, next.id, next.title);
          await expect(page.locator("gallery-root main > *").first()).toBeAttached();
          expect(await disposedIds(page)).toContain(previous);
        });
      }

      expect(failures).toEqual([]);
    });
  }
});
