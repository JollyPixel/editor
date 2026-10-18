// Import Third-party Dependencies
import {
  measureBox,
  measureCenter,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Page
} from "../fixtures.ts";
import {
  TREE_SELECTOR,
  findRow
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
    measureBox(page.locator(`${TREE_SELECTOR} .rows`)),
    measureBox(findRow(page, target))
  ]);

  await hold(page, await measureCenter(findRow(page, source).locator(".grip")), {
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
  test.use({
    example: "data/tree"
  });

  test("reparents with the keyboard move state", async({ page }) => {
    const lighting = findRow(page, "lighting");
    await lighting.click();
    await lighting.press(" ");
    await lighting.press("ArrowRight");
    await lighting.press("Enter");

    expect(await rootIds(page)).toEqual(["lighting", "scene"]);
  });

  test("grip dragging commits an inside drop", async({ page }) => {
    await expect(findRow(page, "camera").locator("[part=grip]")).toBeVisible();
    await hold(
      page,
      await measureCenter(findRow(page, "camera").locator(".grip")),
      await measureCenter(findRow(page, "lighting")),
      1
    );
    await page.mouse.up();

    await expect(findRow(page, "camera")).toHaveCount(0);
  });

  test("edge dragging uses indentation to promote a nested row", async({ page }) => {
    await holdBelowLastRow(page, "crate", "lighting");
    await page.mouse.up();

    expect(await rootIds(page)).toEqual(["scene", "lighting", "crate"]);
  });

  test("the drop line stays on the hovered row, never on a descendant", async({ page }) => {
    await test.step("below the last root row", async() => {
      await holdBelowLastRow(page, "lighting", "lighting");
      await expect(findRow(page, "lighting")).toHaveAttribute("data-drop", "below");
      await expect(findRow(page, "barrel")).not.toHaveAttribute("data-drop", /.+/);
      await cancelDrag(page);
    });

    await test.step("on a branch's own row", async() => {
      const scene = await measureBox(findRow(page, "scene"));
      await hold(page, await measureCenter(findRow(page, "lighting").locator(".grip")), {
        x: scene.x + (scene.width / 2),
        y: scene.y + scene.height - 2
      }, 1);
      await expect(findRow(page, "scene")).toHaveAttribute("data-drop", "below");
      await expect(findRow(page, "barrel")).not.toHaveAttribute("data-drop", /.+/);
      await cancelDrag(page);
    });

    await test.step("below the last nested row", async() => {
      await page.locator(TREE_SELECTOR).evaluate(
        (tree: HTMLElementTagNameMap["jolly-tree"]) => {
          tree.nodes = [...tree.nodes].reverse();
        }
      );
      await holdBelowLastRow(page, "barrel", "barrel");
      await expect(findRow(page, "barrel")).toHaveAttribute("data-drop", "below");
      await expect(findRow(page, "crate")).not.toHaveAttribute("data-drop", /.+/);
      await cancelDrag(page);
    });
  });

  test("a drag claimed outside the tree drops there instead of reparenting", async({ page }) => {
    const tree = page.locator(TREE_SELECTOR);
    await tree.evaluate((element: HTMLElementTagNameMap["jolly-tree"]) => {
      const { right } = element.getBoundingClientRect();
      element.dataset.dragOut = "";
      element.dragOut = {
        over: ({ clientX }) => clientX > right,
        drop: ({ movedIds }) => {
          element.dataset.dragOut += `drop:${movedIds.join(",")} `;
        },
        leave: () => {
          element.dataset.dragOut += "leave ";
        }
      };
    });
    const box = await measureBox(tree);
    const outside = {
      x: box.x + box.width + 40,
      y: box.y + box.height + 40
    };

    await hold(page, await measureCenter(findRow(page, "scene").locator(".grip")), outside, 4);
    await expect(findRow(page, "lighting")).not.toHaveAttribute("data-drop", /.+/);
    await page.mouse.move(box.x + 8, outside.y, { steps: 4 });
    await page.mouse.move(outside.x, outside.y, { steps: 4 });
    await page.mouse.up();

    await expect(tree).toHaveAttribute("data-drag-out", "leave drop:scene ");
    expect(await rootIds(page)).toEqual(["scene", "lighting"]);
  });

  test("whole-row cancellation and disconnection clean up the gesture", async({ page }) => {
    const camera = findRow(page, "camera");
    const box = await measureBox(camera);
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
