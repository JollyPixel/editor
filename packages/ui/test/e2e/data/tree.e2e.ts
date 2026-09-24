// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  boxOf,
  centerOf,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { styleOf } from "../support/styles.ts";

// CONSTANTS
const kTree = "jolly-tree";

function rowOf(
  page: Page,
  id: string
): Locator {
  return page.locator(`${kTree} .row[data-id="${id}"]`);
}

function rootIds(
  page: Page
): Promise<string[]> {
  return page.locator(kTree).evaluate(
    (tree: HTMLElementTagNameMap["jolly-tree"]) => tree.nodes.map((node) => node.id)
  );
}

async function holdBelowLastRow(
  page: Page,
  source: string,
  target: string
): Promise<void> {
  const [rows, below] = await Promise.all([
    boxOf(page.locator(`${kTree} .rows`)),
    boxOf(rowOf(page, target))
  ]);

  await hold(page, await centerOf(rowOf(page, source).locator(".grip")), {
    x: rows.x + 1,
    y: below.y + below.height + 8
  }, 1);
}

async function cancelDrag(
  page: Page
): Promise<void> {
  await page.keyboard.press("Escape");
  await page.mouse.up();
}

test.describe("Tree", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "data/tree");
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

    await page.locator(kTree).evaluate((tree: HTMLElementTagNameMap["jolly-tree"]) => {
      tree.nodes = [{ id: "flat", label: "Flat" }];
    });
    await expect(page.locator(`${kTree} .toggle-spacer`)).toHaveCount(0);
  });

  test("selects with modifiers and keeps one roving focus row", async({ page }) => {
    const camera = rowOf(page, "camera");
    const props = rowOf(page, "props");

    await camera.click();
    await props.click({ modifiers: ["Control"] });

    await expect(camera).toHaveAttribute("aria-selected", "true");
    await expect(props).toHaveAttribute("aria-selected", "true");
    await expect(camera).toHaveAttribute("tabindex", "0");
    await expect(page.locator(`${kTree} .row[tabindex="0"]`)).toHaveCount(1);
  });

  test("navigates expansion and activation from the keyboard", async({ page }) => {
    const tree = page.locator(kTree);
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

  test("activates on double-click and renames on request when opted in", async({ page }) => {
    const tree = page.locator(kTree);
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

  test("reparents with the keyboard move state", async({ page }) => {
    const lighting = rowOf(page, "lighting");
    await lighting.click();
    await lighting.press(" ");
    await lighting.press("ArrowRight");
    await lighting.press("Enter");

    expect(await rootIds(page)).toEqual(["lighting", "scene"]);
  });

  test("grip dragging commits an inside drop", async({ page }) => {
    await hold(
      page,
      await centerOf(rowOf(page, "camera").locator(".grip")),
      await centerOf(rowOf(page, "lighting")),
      1
    );
    await page.mouse.up();

    await expect(rowOf(page, "camera")).toHaveCount(0);
  });

  test("edge dragging uses indentation to promote a nested row", async({ page }) => {
    await holdBelowLastRow(page, "crate", "lighting");
    await page.mouse.up();

    expect(await rootIds(page)).toEqual(["scene", "lighting", "crate"]);
  });

  test("the drop line stays on the hovered row, never on a descendant", async({ page }) => {
    await test.step("below the last root row", async() => {
      await holdBelowLastRow(page, "lighting", "lighting");
      await expect(rowOf(page, "lighting")).toHaveAttribute("data-drop", "below");
      await expect(rowOf(page, "barrel")).not.toHaveAttribute("data-drop", /.+/);
      await cancelDrag(page);
    });

    await test.step("on a branch's own row", async() => {
      const scene = await boxOf(rowOf(page, "scene"));
      await hold(page, await centerOf(rowOf(page, "lighting").locator(".grip")), {
        x: scene.x + (scene.width / 2),
        y: scene.y + scene.height - 2
      }, 1);
      await expect(rowOf(page, "scene")).toHaveAttribute("data-drop", "below");
      await expect(rowOf(page, "barrel")).not.toHaveAttribute("data-drop", /.+/);
      await cancelDrag(page);
    });

    await test.step("below the last nested row", async() => {
      await page.locator(kTree).evaluate(
        (tree: HTMLElementTagNameMap["jolly-tree"]) => {
          tree.nodes = [...tree.nodes].reverse();
        }
      );
      await holdBelowLastRow(page, "barrel", "barrel");
      await expect(rowOf(page, "barrel")).toHaveAttribute("data-drop", "below");
      await expect(rowOf(page, "crate")).not.toHaveAttribute("data-drop", /.+/);
      await cancelDrag(page);
    });
  });

  test("whole-row cancellation and disconnection clean up the gesture", async({ page }) => {
    const camera = rowOf(page, "camera");
    const box = await boxOf(camera);
    const from = {
      x: box.x + 40,
      y: box.y + (box.height / 2)
    };
    const to = {
      x: from.x + 10,
      y: from.y
    };

    await hold(page, from, to, 1);
    await expect(camera).toHaveAttribute("data-dragging", "true");
    await camera.dispatchEvent("pointercancel", {
      pointerId: 1,
      clientX: to.x,
      clientY: to.y
    });
    await expect(camera).not.toHaveAttribute("data-dragging", "true");
    expect(await rootIds(page)).toEqual(["scene", "lighting"]);
    await page.mouse.up();

    await hold(page, from, to, 1);
    await page.locator(kTree).evaluate((element) => element.remove());
    await expect(page.locator("html")).not.toHaveClass(/jolly-tree-dragging/);
    await page.mouse.up();
  });
});
