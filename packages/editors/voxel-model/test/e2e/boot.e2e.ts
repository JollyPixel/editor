// Import Third-party Dependencies
import { treeRow } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { hierarchyAction } from "./support/hierarchy.ts";
import { blockSummary, outline } from "./support/scene.ts";

test("opens the requested model with its default block and texture regions", async({ page }) => {
  await expect(treeRow(page, "Block")).toBeVisible();
  await expect(page.getByRole("img").filter({ hasText: "(Block)front" })).toBeVisible();

  expect(await outline(page)).toEqual(["Block"]);
  expect(await blockSummary(page, "Block")).toMatchObject({
    position: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 }
  });
});

test("the transform panel stays disabled until a block is selected", async({ page }) => {
  const x = page.getByRole("textbox", { name: "X" });
  await expect(x).toBeDisabled();
  await expect(hierarchyAction(page, "Duplicate")).toBeDisabled();
  await expect(hierarchyAction(page, "Delete")).toBeDisabled();

  await treeRow(page, "Block").click();

  await expect(x).toBeEnabled();
  await expect(hierarchyAction(page, "Duplicate")).toBeEnabled();
  await expect(hierarchyAction(page, "Delete")).toBeEnabled();
});
