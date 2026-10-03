// Import Third-party Dependencies
import {
  checkboxField,
  dialog,
  textField,
  treeRow
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  addNode,
  hierarchyAction,
  materialTab,
  rowMenu
} from "./support/hierarchy.ts";
import {
  blockSummary,
  blockVisible,
  outline,
  selectedBlock
} from "./support/scene.ts";

test("a new block is listed, selected and given its texture region", async({ page }) => {
  await addNode(page, "Block", "Arm");

  await expect(treeRow(page, "Arm")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("img").filter({ hasText: "(Arm)front" })).toBeVisible();
  expect(await outline(page)).toEqual(["Block", "Arm"]);
  expect(await selectedBlock(page)).toBe("Arm");
});

test("a row menu adds inside the row and the header adds under the selection", async({ page }) => {
  await addNode(page, "Block", "Arm", { under: "Block" });
  await expect(treeRow(page, "Arm")).toHaveAttribute("aria-selected", "true");
  await addNode(page, "Block", "Hand");
  await addNode(page, "Folder", "Fingers");

  expect(await outline(page)).toEqual(["Block", "  Arm", "    Hand", "      Fingers/"]);
});

test("a cancelled dialog adds nothing", async({ page }) => {
  await hierarchyAction(page, "Add Block").click();
  const form = dialog(page, "New Block");
  await textField(form, "Block name").fill("Ghost");
  await form.getByRole("button", { name: "Cancel" }).click();

  await expect(form).toBeHidden();
  await expect(treeRow(page, "Ghost")).toHaveCount(0);
  expect(await outline(page)).toEqual(["Block"]);
});

test("blocks placed in a folder are listed under it", async({ page }) => {
  await addNode(page, "Folder", "Limbs");
  await addNode(page, "Block", "Arm", { under: "Limbs" });

  expect(await outline(page)).toEqual(["Block", "Limbs/", "  Arm"]);
});

test("a row is reordered among its siblings with the keyboard move state", async({ page }) => {
  await addNode(page, "Block", "Arm");

  const arm = treeRow(page, "Arm");
  await arm.click();
  await arm.press(" ");
  await arm.press("ArrowRight");
  await arm.press("Enter");

  await expect.poll(() => outline(page)).toEqual(["Arm", "Block"]);
});

test("rows show no drag grip", async({ page }) => {
  await expect(treeRow(page, "Block").locator("[part=grip]")).toBeHidden();
});

test("a row is renamed in place by double-click", async({ page }) => {
  await treeRow(page, "Block").dblclick();
  const rename = page.getByRole("textbox", { name: "Rename" });
  await rename.fill("Torso");
  await rename.press("Enter");

  await expect(treeRow(page, "Torso")).toBeVisible();
  expect(await outline(page)).toEqual(["Torso"]);
});

test("a row is reparented with the keyboard move state", async({ page }) => {
  await addNode(page, "Block", "Arm");

  const arm = treeRow(page, "Arm");
  await arm.click();
  await arm.press(" ");
  await arm.press("ArrowLeft");
  await arm.press("Enter");

  await expect.poll(() => outline(page)).toEqual(["Block", "  Arm"]);
});

test("a block row eye hides and shows only that block", async({ page }) => {
  await addNode(page, "Block", "Arm", { under: "Block" });

  await treeRow(page, "Block").getByRole("button", { name: "Hide" }).click();
  await expect(treeRow(page, "Block").getByRole("button", { name: "Show" })).toBeVisible();
  expect(await blockVisible(page, "Block")).toBe(false);
  expect(await blockVisible(page, "Arm")).toBe(true);

  await treeRow(page, "Block").getByRole("button", { name: "Show" }).click();
  await expect(treeRow(page, "Block").getByRole("button", { name: "Hide" })).toBeVisible();
  expect(await blockVisible(page, "Block")).toBe(true);
});

test("a folder eye hides its blocks and turns back on when one is shown", async({ page }) => {
  await addNode(page, "Folder", "Limbs");
  await addNode(page, "Block", "Arm", { under: "Limbs" });
  await addNode(page, "Block", "Leg", { under: "Limbs" });

  await treeRow(page, "Limbs").getByRole("button", { name: "Hide" }).click();
  expect(await blockVisible(page, "Arm")).toBe(false);
  expect(await blockVisible(page, "Leg")).toBe(false);

  await treeRow(page, "Arm").getByRole("button", { name: "Show" }).click();
  await expect(treeRow(page, "Limbs").getByRole("button", { name: "Hide" })).toBeVisible();

  await treeRow(page, "Limbs").getByRole("button", { name: "Hide" }).click();
  await treeRow(page, "Limbs").getByRole("button", { name: "Show" }).click();
  expect(await blockVisible(page, "Arm")).toBe(true);
  expect(await blockVisible(page, "Leg")).toBe(true);
});

test("a duplicate copies the subtree and mirrors it", async({ page }) => {
  await treeRow(page, "Block").click();
  await page.getByRole("radio", { name: "Pos" }).check();
  await page.getByRole("textbox", { name: "X" }).fill("2");
  await page.getByRole("textbox", { name: "X" }).press("Enter");
  await addNode(page, "Block", "Arm", { under: "Block" });

  await treeRow(page, "Block").click();
  await hierarchyAction(page, "Duplicate").click();
  const form = dialog(page, "Duplicate");
  await expect(textField(form, "Name")).toHaveValue("Block Copy");
  await expect(checkboxField(form, "Duplicate children too")).toBeChecked();
  await checkboxField(form, "X").check();
  await form.getByRole("button", { name: "Duplicate" }).click();
  await expect(form).toBeHidden();

  await expect(treeRow(page, "Block Copy")).toHaveAttribute("aria-selected", "true");
  expect(await outline(page)).toEqual([
    "Block",
    "  Arm",
    "Block Copy",
    "  Arm"
  ]);
  expect(await blockSummary(page, "Block Copy")).toMatchObject({
    worldPosition: { x: -2, y: 0, z: 0 }
  });
});

test("a row menu renames in place and opens the Material tab", async({ page }) => {
  const menu = await rowMenu(page, "Block");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Add Child Block",
    "Rename",
    "Duplicate",
    "Material…",
    "Delete"
  ]);
  await menu.getByRole("menuitem", { name: "Rename" }).click();
  const rename = page.getByRole("textbox", { name: "Rename" });
  await expect(rename).toBeFocused();
  await rename.fill("Torso");
  await rename.press("Enter");
  await expect(treeRow(page, "Torso")).toBeVisible();

  await (await rowMenu(page, "Torso")).getByRole("menuitem", { name: "Material…" }).click();
  await expect(materialTab(page)).toBeVisible();
});

test("a right-click below the rows adds at the root, with no row actions", async({ page }) => {
  await treeRow(page, "Block").click();
  const tree = (await page.locator("jolly-model-editor-hierarchy jolly-tree").boundingBox())!;

  await page.mouse.click(tree.x + 20, tree.y + tree.height - 10, { button: "right" });
  const menu = page.getByRole("menu", { name: "Hierarchy actions" });
  await expect(menu.getByRole("menuitem")).toHaveText(["Add Block", "Add Folder"]);
  await expect(treeRow(page, "Block")).toHaveAttribute("aria-selected", "true");

  await menu.getByRole("menuitem", { name: "Add Folder" }).click();
  const form = dialog(page, "New Folder");
  await textField(form, "Folder name").fill("Props");
  await form.getByRole("button", { name: "OK" }).click();

  await expect.poll(() => outline(page)).toEqual(["Block", "Props/"]);
});

test("a row menu duplicates next to the row under a new name and deletes it", async({ page }) => {
  await addNode(page, "Block", "Arm");

  await (await rowMenu(page, "Block")).getByRole("menuitem", { name: "Duplicate" }).click();
  const form = dialog(page, "Duplicate");
  await textField(form, "Name").fill("Torso");
  await form.getByRole("button", { name: "Duplicate" }).click();
  await expect.poll(() => outline(page)).toEqual(["Block", "Torso", "Arm"]);

  await (await rowMenu(page, "Torso")).getByRole("menuitem", { name: "Delete" }).click();
  await dialog(page, "Delete Block").getByRole("button", { name: "Delete" }).click();

  await expect.poll(() => outline(page)).toEqual(["Block", "Arm"]);
});

test("deleting a parent removes or promotes its children", async({ page }) => {
  await addNode(page, "Block", "Arm", { under: "Block" });
  await addNode(page, "Block", "Hand", { under: "Arm" });

  await test.step("keeping the children", async() => {
    await treeRow(page, "Arm").click();
    await hierarchyAction(page, "Delete").click();
    const form = dialog(page, "Delete Block");
    await checkboxField(form, "Delete children too").uncheck();
    await form.getByRole("button", { name: "Delete" }).click();

    await expect(treeRow(page, "Arm")).toHaveCount(0);
    expect(await outline(page)).toEqual(["Block", "  Hand"]);
  });

  await test.step("with the children", async() => {
    await treeRow(page, "Block").click();
    await hierarchyAction(page, "Delete").click();
    await dialog(page, "Delete Block")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByRole("treeitem")).toHaveCount(0);
    expect(await outline(page)).toEqual([]);
    await expect(hierarchyAction(page, "Delete")).toBeDisabled();
  });
});
