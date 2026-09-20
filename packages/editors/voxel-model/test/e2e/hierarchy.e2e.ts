// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  checkboxField,
  dialog,
  textField,
  treeRow
} from "./support/panels.ts";
import { addNode } from "./support/hierarchy.ts";
import {
  blockSummary,
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

test("a block added as a child nests under the selection", async({ page }) => {
  await treeRow(page, "Block").click();
  await addNode(page, "Block", "Arm");
  await addNode(page, "Block", "Leg", { asChild: false });

  expect(await outline(page)).toEqual(["Block", "  Arm", "Leg"]);
});

test("a cancelled dialog adds nothing", async({ page }) => {
  await page.getByRole("button", { name: "Add Block" }).click();
  const form = dialog(page, "New Block");
  await textField(form, "Block name").fill("Ghost");
  await form.getByRole("button", { name: "Cancel" }).click();

  await expect(form).toBeHidden();
  await expect(treeRow(page, "Ghost")).toHaveCount(0);
  expect(await outline(page)).toEqual(["Block"]);
});

test("blocks placed in a folder are listed under it", async({ page }) => {
  await addNode(page, "Folder", "Limbs");
  await treeRow(page, "Limbs").click();
  await addNode(page, "Block", "Arm");

  expect(await outline(page)).toEqual(["Limbs/", "  Arm", "Block"]);
});

test("a row is renamed in place", async({ page }) => {
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

test("a duplicate copies the subtree and mirrors it", async({ page }) => {
  await treeRow(page, "Block").click();
  await page.getByRole("radio", { name: "Pos" }).check();
  await page.getByRole("textbox", { name: "X" }).fill("2");
  await page.getByRole("textbox", { name: "X" }).press("Enter");
  await addNode(page, "Block", "Arm");

  await treeRow(page, "Block").click();
  await page.getByRole("button", { name: "Duplicate" }).click();
  const form = dialog(page, "Duplicate");
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

test("deleting a parent removes or promotes its children", async({ page }) => {
  await treeRow(page, "Block").click();
  await addNode(page, "Block", "Arm");
  await addNode(page, "Block", "Hand");

  await test.step("keeping the children", async() => {
    await treeRow(page, "Arm").click();
    await page.getByRole("button", { name: "Delete" }).click();
    const form = dialog(page, "Delete Block");
    await checkboxField(form, "Delete children too").uncheck();
    await form.getByRole("button", { name: "Delete" }).click();

    await expect(treeRow(page, "Arm")).toHaveCount(0);
    expect(await outline(page)).toEqual(["Block", "  Hand"]);
  });

  await test.step("with the children", async() => {
    await treeRow(page, "Block").click();
    await page.getByRole("button", { name: "Delete" }).click();
    await dialog(page, "Delete Block")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByRole("treeitem")).toHaveCount(0);
    expect(await outline(page)).toEqual([]);
    await expect(page.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
