// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

async function openTree(
  page: Parameters<typeof gotoGallery>[0]
): Promise<void> {
  await gotoGallery(page, {
    example: "data/tree",
    chrome: "off"
  });
}

async function rootIds(
  page: Parameters<typeof gotoGallery>[0]
): Promise<string[]> {
  return page.locator("jolly-tree").evaluate((element) => {
    const tree = element as HTMLElement & {
      nodes: Array<{ id: string; }>;
    };

    return tree.nodes.map((node) => node.id);
  });
}

test.describe("Tree badges", () => {
  test("renders one labelled dot per badge, in order", async({ page }) => {
    await gotoGallery(page, {
      example: "data/tree",
      chrome: "off"
    });

    const badges = page.locator('jolly-tree .row[data-id="camera"] .badge');

    await expect(badges).toHaveCount(2);
    await expect(badges.nth(0)).toHaveAttribute("aria-label", "Ada");
    await expect(badges.nth(1)).toHaveAttribute("aria-label", "Lin");
    expect(
      await badges.nth(0).evaluate((element) => getComputedStyle(element)
        .backgroundColor)
    ).toBe("rgb(224, 86, 122)");
  });

  test("renders no badge container on a row without badges", async({ page }) => {
    await gotoGallery(page, {
      example: "data/tree",
      chrome: "off"
    });

    await expect(
      page.locator('jolly-tree .row[data-id="scene"] .badges')
    ).toHaveCount(0);
  });
});

test.describe("Tree interactions", () => {
  test("selects with modifiers and keeps one roving focus row", async({ page }) => {
    await openTree(page);
    const camera = page.locator('jolly-tree .row[data-id="camera"]');
    const props = page.locator('jolly-tree .row[data-id="props"]');

    await camera.click();
    await props.click({ modifiers: ["Control"] });

    await expect(camera).toHaveAttribute("aria-selected", "true");
    await expect(props).toHaveAttribute("aria-selected", "true");
    await expect(camera).toHaveAttribute("tabindex", "0");
    await expect(page.locator('jolly-tree .row[tabindex="0"]')).toHaveCount(1);
  });

  test("navigates expansion and activation from the keyboard", async({ page }) => {
    await openTree(page);
    const scene = page.locator('jolly-tree .row[data-id="scene"]');
    await scene.click();
    await scene.press("ArrowRight");

    const camera = page.locator('jolly-tree .row[data-id="camera"]');
    await expect(camera).toHaveAttribute("tabindex", "0");
    await page.locator("jolly-tree").evaluate((element) => {
      element.addEventListener("jolly-activate", (event) => {
        element.setAttribute(
          "data-activated",
          (event as CustomEvent<{ id: string; }>).detail.id
        );
      }, { once: true });
    });
    await camera.press("Enter");
    await expect(page.locator("jolly-tree")).toHaveAttribute(
      "data-activated",
      "camera"
    );

    await scene.click();
    await scene.press("ArrowLeft");
    await expect(camera).toHaveCount(0);
  });

  test("commits and cancels rename while restoring row focus", async({ page }) => {
    await openTree(page);
    const camera = page.locator('jolly-tree .row[data-id="camera"]');
    await camera.dblclick();
    const cameraInput = camera.locator(".rename");
    await cameraInput.fill("Lens");
    await cameraInput.press("Enter");

    await expect(camera.locator(".label")).toHaveText("Lens");
    await expect(camera).toBeFocused();

    const crate = page.locator('jolly-tree .row[data-id="crate"]');
    await crate.dblclick();
    const crateInput = crate.locator(".rename");
    await crateInput.fill("Discarded");
    await crateInput.press("Escape");
    await expect(crate.locator(".label")).toHaveText("Crate");
    await expect(crate).toBeFocused();
  });

  test("reparents with the keyboard move state", async({ page }) => {
    await openTree(page);
    const lighting = page.locator('jolly-tree .row[data-id="lighting"]');
    await lighting.click();
    await lighting.press(" ");
    await lighting.press("ArrowRight");
    await lighting.press("Enter");

    expect(await rootIds(page)).toEqual(["lighting", "scene"]);
  });

  test("grip dragging commits an inside drop", async({ page }) => {
    await openTree(page);
    const grip = page.locator('jolly-tree .row[data-id="camera"] .grip');
    const lighting = page.locator('jolly-tree .row[data-id="lighting"]');
    const source = await grip.boundingBox();
    const target = await lighting.boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      target!.x + target!.width / 2,
      target!.y + target!.height / 2
    );
    await page.mouse.up();

    await expect(page.locator('jolly-tree .row[data-id="camera"]')).toHaveCount(0);
  });

  test("whole-row cancellation and disconnection clean up the gesture", async({ page }) => {
    await openTree(page);
    const camera = page.locator('jolly-tree .row[data-id="camera"]');
    const box = await camera.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 40, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + 50, box!.y + box!.height / 2);
    await expect(camera).toHaveAttribute("data-dragging", "true");
    await camera.dispatchEvent("pointercancel", {
      pointerId: 1,
      clientX: box!.x + 50,
      clientY: box!.y + box!.height / 2
    });
    await expect(camera).not.toHaveAttribute("data-dragging", "true");
    expect(await rootIds(page)).toEqual(["scene", "lighting"]);

    await page.mouse.up();
    await page.mouse.move(box!.x + 40, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + 50, box!.y + box!.height / 2);
    await page.locator("jolly-tree").evaluate((element) => element.remove());
    await expect(page.locator("html")).not.toHaveClass(/jolly-tree-dragging/);
    await page.mouse.up();
  });

  test("edge dragging uses indentation to promote a nested row", async({ page }) => {
    await openTree(page);
    const grip = page.locator('jolly-tree .row[data-id="crate"] .grip');
    const rows = page.locator("jolly-tree .rows");
    const lighting = page.locator('jolly-tree .row[data-id="lighting"]');
    const source = await grip.boundingBox();
    const container = await rows.boundingBox();
    const target = await lighting.boundingBox();
    expect(source).not.toBeNull();
    expect(container).not.toBeNull();
    expect(target).not.toBeNull();

    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(container!.x + 1, target!.y + target!.height + 8);
    await page.mouse.up();

    expect(await rootIds(page)).toEqual(["scene", "lighting", "crate"]);
  });

  test("dragging the last row past the bottom edge keeps the drop line there", async({ page }) => {
    await openTree(page);
    await page.locator("jolly-tree").evaluate((element) => {
      const tree = element as HTMLElement & { nodes: Array<{ id: string; }>; };
      tree.nodes = [...tree.nodes].reverse();
    });

    const grip = page.locator('jolly-tree .row[data-id="barrel"] .grip');
    const barrel = page.locator('jolly-tree .row[data-id="barrel"]');
    const crate = page.locator('jolly-tree .row[data-id="crate"]');
    const rows = page.locator("jolly-tree .rows");
    const source = await grip.boundingBox();
    const target = await barrel.boundingBox();
    const container = await rows.boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    expect(container).not.toBeNull();

    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(container!.x + 1, target!.y + target!.height + 8);

    await expect(barrel).toHaveAttribute("data-drop", "below");
    await expect(crate).not.toHaveAttribute("data-drop", /.+/);

    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("dragging the last root row past the bottom edge keeps the drop line there", async({ page }) => {
    await openTree(page);
    const grip = page.locator('jolly-tree .row[data-id="lighting"] .grip');
    const lighting = page.locator('jolly-tree .row[data-id="lighting"]');
    const barrel = page.locator('jolly-tree .row[data-id="barrel"]');
    const rows = page.locator("jolly-tree .rows");
    const source = await grip.boundingBox();
    const target = await lighting.boundingBox();
    const container = await rows.boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    expect(container).not.toBeNull();

    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(container!.x + 1, target!.y + target!.height + 8);

    await expect(lighting).toHaveAttribute("data-drop", "below");
    await expect(barrel).not.toHaveAttribute("data-drop", /.+/);

    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("hovering a branch's own row keeps the drop line there, not at its last child", async({ page }) => {
    await openTree(page);
    const grip = page.locator('jolly-tree .row[data-id="lighting"] .grip');
    const scene = page.locator('jolly-tree .row[data-id="scene"]');
    const barrel = page.locator('jolly-tree .row[data-id="barrel"]');
    const source = await grip.boundingBox();
    const target = await scene.boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      target!.x + target!.width / 2,
      target!.y + target!.height - 2
    );

    await expect(scene).toHaveAttribute("data-drop", "below");
    await expect(barrel).not.toHaveAttribute("data-drop", /.+/);

    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
});

test.describe("Tree indent guides", () => {
  test("widens the guide band by one indent unit per ancestor", async({ page }) => {
    await gotoGallery(page, {
      example: "data/tree",
      chrome: "off"
    });

    const rootWidth = await page.locator('jolly-tree .row[data-id="scene"]')
      .evaluate((element) => getComputedStyle(element, "::before").width);
    const nestedWidth = await page.locator('jolly-tree .row[data-id="camera"]')
      .evaluate((element) => getComputedStyle(element, "::before").width);

    expect(rootWidth).toBe("0px");
    expect(nestedWidth).toBe("16px");
  });
});
