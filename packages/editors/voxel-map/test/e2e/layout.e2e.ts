// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { openPane } from "./support/panels.ts";

async function textureHost(
  page: Page
) {
  for (const pane of ["blocks", "paint"]) {
    const editor = page.locator(`jolly-pane[key="${pane}"] texture-editor`);
    if (await editor.count() === 1) {
      return {
        pane,
        uvAccess: await editor.evaluate(
          (element: HTMLElementTagNameMap["texture-editor"]) => element.uvAccess
        )
      };
    }
  }

  return null;
}

async function dragTabToDock(
  page: Page,
  tab: string,
  dock: string
): Promise<void> {
  const source = await page.getByRole("tab", { name: tab }).boundingBox();
  const target = await page.locator(`jolly-dock[key='${dock}']`).boundingBox();
  await page.mouse.move(source!.x + (source!.width / 2), source!.y + (source!.height / 2));
  await page.mouse.down();
  await page.mouse.move(
    target!.x + (target!.width / 2),
    target!.y + (target!.height / 2),
    { steps: 16 }
  );
  await page.mouse.up();
}

test("the texture editor follows the shown tab while Blocks and Paint share a group", async({ page }) => {
  await openPane(page, "Blocks");
  await expect.poll(() => textureHost(page)).toEqual({
    pane: "blocks",
    uvAccess: "edit"
  });

  await openPane(page, "Paint");
  await expect.poll(() => textureHost(page)).toEqual({
    pane: "paint",
    uvAccess: "view"
  });
});

test("the texture editor stays in Paint once it has its own dock", async({ page }) => {
  await dragTabToDock(page, "Paint", "right");
  await expect(page.locator("jolly-dock[key='right'] jolly-pane[key='paint']")).toBeAttached();

  await openPane(page, "Blocks");

  await expect.poll(() => textureHost(page)).toEqual({
    pane: "paint",
    uvAccess: "edit"
  });
  await expect(page.getByRole("listbox", { name: "Blocks" })).toBeVisible();
});
