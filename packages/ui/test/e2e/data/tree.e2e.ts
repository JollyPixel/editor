// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";
import { boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { styleOf } from "../support/styles.ts";
import {
  TREE_SELECTOR,
  rowOf
} from "../support/tree.ts";

function swatchOrder(
  row: Locator
): Promise<string[]> {
  return row.evaluate((element) => [...element.querySelectorAll(".swatch, .label")]
    .map((part) => part.className));
}

test.describe("Tree", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "data/tree");
  });

  test("titles a label only while it is cut off, unless an ancestor opts out", async({ page }) => {
    const tree = page.locator(TREE_SELECTOR);
    const label = rowOf(page, "crate").locator(".label");

    await label.hover();
    await expect(label).not.toHaveAttribute("title");

    await tree.evaluate((element) => {
      (element as HTMLElement).style.width = "165px";
    });
    await page.mouse.move(0, 0);
    await label.hover();
    await expect(label).toHaveAttribute("title", "Crate");

    await tree.evaluate((element) => element.setAttribute("overflow-title", "off"));
    await page.mouse.move(0, 0);
    await label.hover();
    await expect(label).not.toHaveAttribute("title");
  });

  test("activates a swatch without selecting or renaming its row", async({ page }) => {
    const tree = page.locator(TREE_SELECTOR);
    const crate = rowOf(page, "crate");
    const swatch = crate.getByRole("button", { name: "Material: Glass" });
    await tree.evaluate((element) => {
      element.addEventListener("jolly-activate-swatch", (event) => {
        if (event instanceof CustomEvent) {
          element.setAttribute("data-swatch", event.detail.id);
        }
      });
    });

    await swatch.click();
    await expect(tree).toHaveAttribute("data-swatch", "crate");
    await expect(crate).toHaveAttribute("aria-selected", "false");

    await swatch.dblclick();
    await expect(crate.locator(".rename")).toHaveCount(0);
  });

  test("draws the swatch before the label when its position is start", async({ page }) => {
    const tree = page.locator(TREE_SELECTOR);
    const crate = rowOf(page, "crate");

    expect(await swatchOrder(crate)).toEqual(["label", "swatch"]);

    await tree.evaluate((element) => element.setAttribute("swatch-position", "start"));

    await expect.poll(() => swatchOrder(crate)).toEqual(["swatch", "label"]);
  });

  test("shows an empty swatch only on a hovered or selected row", async({ page }) => {
    const barrel = rowOf(page, "barrel");
    const swatch = barrel.getByRole("button", { name: "Add material" });
    await expect(swatch).toBeHidden();

    await barrel.hover();
    await expect(swatch).toBeVisible();
  });

  test("renders ordered badges and one indent unit per ancestor", async({ page }) => {
    const badges = rowOf(page, "camera").locator(".badge");

    await expect(badges).toHaveCount(2);
    await expect(badges.nth(0)).toHaveAttribute("aria-label", "Ada");
    await expect(badges.nth(1)).toHaveAttribute("aria-label", "Lin");
    await expect(badges.nth(0)).toHaveCSS("background-color", "rgb(224, 86, 122)");
    await expect(rowOf(page, "scene").locator(".badges")).toHaveCount(0);
    await expect(rowOf(page, "camera").locator(".detail")).toHaveText("2 lights");
    await expect(rowOf(page, "scene").locator(".detail")).toHaveCount(0);

    const [detail, badge] = await Promise.all([
      boxOf(rowOf(page, "camera").locator(".detail")),
      boxOf(badges.nth(0))
    ]);
    expect(detail.x).toBeLessThan(badge.x);

    expect(await styleOf(rowOf(page, "scene"), "width", "::before")).toBe("0px");
    expect(await styleOf(rowOf(page, "camera"), "width", "::before")).toBe("16px");
  });

  test("highlights a leaf from the row start and aligns its icon with branches", async({ page }) => {
    const [lighting, lightingContent, lightingIcon, sceneIcon] = await Promise.all([
      boxOf(rowOf(page, "lighting")),
      boxOf(rowOf(page, "lighting").locator(".content")),
      boxOf(rowOf(page, "lighting").locator(".node-icon")),
      boxOf(rowOf(page, "scene").locator(".node-icon"))
    ]);

    expect(lightingContent.x).toBe(lighting.x);
    expect(lightingContent.x + lightingContent.width).toBe(lighting.x + lighting.width);
    expect(lightingIcon.x).toBe(sceneIcon.x);

    await page.locator(TREE_SELECTOR).evaluate((tree: HTMLElementTagNameMap["jolly-tree"]) => {
      tree.nodes = [{ id: "flat", label: "Flat" }];
    });
    await expect(page.locator(`${TREE_SELECTOR} .toggle-spacer`)).toHaveCount(0);
  });

  test("selects with modifiers and keeps one roving focus row", async({ page }) => {
    const camera = rowOf(page, "camera");
    const props = rowOf(page, "props");

    await camera.click();
    await props.click({ modifiers: ["Control"] });

    await expect(camera).toHaveAttribute("aria-selected", "true");
    await expect(props).toHaveAttribute("aria-selected", "true");
    await expect(camera).toHaveAttribute("tabindex", "0");
    await expect(page.locator(`${TREE_SELECTOR} .row[tabindex="0"]`)).toHaveCount(1);
  });

  test("keeps a row selected on empty-area and ctrl clicks when a selection is required", async({ page }) => {
    const rows = page.locator(`${TREE_SELECTOR} .rows`);
    const camera = rowOf(page, "camera");
    const { height } = await boxOf(rows);

    await camera.click();
    await rows.click({ position: { x: 8, y: height - 8 } });
    await expect(camera).toHaveAttribute("aria-selected", "false");

    await page.locator(TREE_SELECTOR).evaluate((element: HTMLElementTagNameMap["jolly-tree"]) => {
      element.requireSelection = true;
    });
    await camera.click();
    await rows.click({ position: { x: 8, y: height - 8 } });
    await camera.click({ modifiers: ["Control"] });
    await expect(camera).toHaveAttribute("aria-selected", "true");
  });

  test("navigates expansion and activation from the keyboard", async({ page }) => {
    const tree = page.locator(TREE_SELECTOR);
    const scene = rowOf(page, "scene");
    const camera = rowOf(page, "camera");

    await scene.click();
    await scene.press("ArrowRight");
    await expect(camera).toHaveAttribute("tabindex", "0");

    await tree.evaluate((element) => {
      element.addEventListener("jolly-activate", (event) => {
        if (event instanceof CustomEvent) {
          element.setAttribute("data-activated", event.detail.id);
        }
      }, { once: true });
    });
    await camera.press("Enter");
    await expect(tree).toHaveAttribute("data-activated", "camera");

    await scene.click();
    await scene.press("ArrowLeft");
    await expect(camera).toHaveCount(0);
  });

  test("commits and cancels rename while restoring row focus", async({ page }) => {
    const camera = rowOf(page, "camera");
    await camera.dblclick();
    await camera.locator(".rename").fill("Lens");
    await camera.locator(".rename").press("Enter");
    await expect(camera.locator(".label")).toHaveText("Lens");
    await expect(camera).toBeFocused();

    const crate = rowOf(page, "crate");
    await crate.dblclick();
    await crate.locator(".rename").fill("Discarded");
    await crate.locator(".rename").press("Escape");
    await expect(crate.locator(".label")).toHaveText("Crate");
    await expect(crate).toBeFocused();
  });

  test("keeps renaming while the pointer selects text in the field", async({ page }) => {
    const camera = rowOf(page, "camera");
    await camera.dblclick();
    const field = camera.locator(".rename");
    const box = await boxOf(field);

    await field.click();
    await page.mouse.move(box.x + 2, box.y + (box.height / 2));
    await page.mouse.down();
    await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 4 });
    await page.mouse.up();

    await expect(field).toBeFocused();
    await expect(page.locator(`${TREE_SELECTOR} .row[data-dragging="true"]`)).toHaveCount(0);
    await field.fill("Lens");
    await field.press("Enter");
    await expect(camera.locator(".label")).toHaveText("Lens");
  });

  test("activates on double-click and renames on request when opted in", async({ page }) => {
    const tree = page.locator(TREE_SELECTOR);
    const camera = rowOf(page, "camera");
    await tree.evaluate((element: HTMLElementTagNameMap["jolly-tree"]) => {
      element.activateOnDoubleClick = true;
      element.addEventListener("jolly-activate", (event) => {
        if (event instanceof CustomEvent) {
          element.setAttribute("data-activated", event.detail.id);
        }
      }, { once: true });
    });

    await camera.dblclick();
    await expect(tree).toHaveAttribute("data-activated", "camera");
    await expect(camera.locator(".rename")).toHaveCount(0);

    const started = await tree.evaluate(
      (element: HTMLElementTagNameMap["jolly-tree"]) => element.beginRename("camera")
    );
    expect(started).toBe(true);
    await camera.locator(".rename").fill("Lens");
    await camera.locator(".rename").press("Enter");
    await expect(camera.locator(".label")).toHaveText("Lens");
  });
});
