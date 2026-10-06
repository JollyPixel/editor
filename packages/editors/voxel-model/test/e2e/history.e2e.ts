// Import Third-party Dependencies
import { treeRow } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  addNode,
  hierarchyAction,
  newMaterial,
  openMaterialTab
} from "./support/hierarchy.ts";
import {
  historyBar,
  historyButton
} from "./support/history.ts";
import {
  materialOutline,
  outline
} from "./support/scene.ts";

test("each tab undoes and redoes its own steps, naming and counting them", async({ page }) => {
  await expect(historyButton(page, "Undo").getByRole("button")).toBeDisabled();
  await addNode(page, "Block", "Arm");
  await expect(historyButton(page, "Undo")).toHaveAttribute("title", "Undo Add Arm (Ctrl+Z)");
  await expect(historyBar(page).locator(".count")).toHaveText("1");

  await openMaterialTab(page);
  await expect(historyButton(page, "Undo").getByRole("button")).toBeDisabled();
  await newMaterial(page, "Metal");
  await expect(historyButton(page, "Undo")).toHaveAttribute("title", "Undo Add material Metal (Ctrl+Z)");

  await historyButton(page, "Undo").getByRole("button").click();
  await expect.poll(() => materialOutline(page)).not.toContain("Metal");
  await expect.poll(() => outline(page)).toEqual(["Block", "Arm"]);
  await expect(historyButton(page, "Redo")).toHaveAttribute("title", "Redo Add material Metal (Ctrl+Y)");

  await historyButton(page, "Redo").getByRole("button").click();
  await expect.poll(() => materialOutline(page)).toContain("Metal");
  await expect(historyButton(page, "Redo").getByRole("button")).toBeDisabled();

  await page.getByRole("tab", { name: "Build" }).click();
  await expect(historyButton(page, "Undo")).toHaveAttribute("title", "Undo Add Arm (Ctrl+Z)");
});

test("outside Build the tree only selects, and its lock opens Build", async({ page }) => {
  await openMaterialTab(page);
  await expect(hierarchyAction(page, "Add Block")).toHaveCount(0);

  await treeRow(page, "Block").dblclick();
  await expect(page.getByRole("textbox", { name: "Rename" })).toHaveCount(0);
  await expect(treeRow(page, "Block")).toHaveAttribute("aria-selected", "true");

  await hierarchyAction(page, "Edit in Build").click();
  await expect(page.getByRole("tab", { name: "Build" })).toHaveAttribute("aria-selected", "true");
  await expect(hierarchyAction(page, "Add Block")).toBeVisible();
});

test("keyboard shortcuts undo and redo outside text fields", async({ page }) => {
  await treeRow(page, "Block").dblclick();
  const rename = page.getByRole("textbox", { name: "Rename" });
  await rename.fill("Torso");
  await rename.press("Enter");
  await expect(treeRow(page, "Torso")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+z");
  await expect(treeRow(page, "Block")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(treeRow(page, "Torso")).toBeVisible();
});
