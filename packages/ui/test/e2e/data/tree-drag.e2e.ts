// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";
import {
  boxOf,
  centerOf,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import {
  TREE_SELECTOR,
  rowOf
} from "../support/tree.ts";

function rootIds(
  page: Page
): Promise<string[]> {
  return page.locator(TREE_SELECTOR).evaluate(
    (tree: HTMLElementTagNameMap["jolly-tree"]) => tree.nodes.map((node) => node.id)
  );
}

async function holdBelowLastRow(
  page: Page,
  source: string,
  target: string
): Promise<void> {
  const [rows, below] = await Promise.all([
    boxOf(page.locator(`${TREE_SELECTOR} .rows`)),
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

  test("reparents with the keyboard move state", async({ page }) => {
    const lighting = rowOf(page, "lighting");
    await lighting.click();
    await lighting.press(" ");
    await lighting.press("ArrowRight");
    await lighting.press("Enter");

    expect(await rootIds(page)).toEqual(["lighting", "scene"]);
  });

  test("grip dragging commits an inside drop", async({ page }) => {
    await expect(rowOf(page, "camera").locator("[part=grip]")).toBeVisible();
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
      await page.locator(TREE_SELECTOR).evaluate(
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
    await page.locator(TREE_SELECTOR).evaluate((element) => element.remove());
    await expect(page.locator("html")).not.toHaveClass(/jolly-tree-dragging/);
    await page.mouse.up();
  });
});
