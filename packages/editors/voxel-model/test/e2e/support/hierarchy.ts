// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  dialog,
  textField,
  treeRow
} from "@jolly-pixel/e2e";

export type NodeKind = "Block" | "Folder";

export interface AddNodeOptions {
  /**
   * Adds inside this row through its menu instead of the header button.
   */
  under?: string;
}

export function hierarchyAction(
  page: Page,
  name: string
): Locator {
  return page
    .locator(`jolly-model-editor-hierarchy jolly-button[label="${name}"]`)
    .getByRole("button");
}

export async function addNode(
  page: Page,
  kind: NodeKind,
  name: string,
  options: AddNodeOptions = {}
): Promise<void> {
  if (options.under === undefined) {
    await hierarchyAction(page, `Add ${kind}`).click();
  }
  else {
    const menu = await rowMenu(page, options.under);
    await menu.getByRole("menuitem", { name: new RegExp(`^Add (Child )?${kind}$`) }).click();
  }
  const form = dialog(page, `New ${kind}`);
  await textField(form, `${kind} name`).fill(name);
  await form.getByRole("button", { name: "OK" }).click();
  await expect(form).toBeHidden();
  await expect(treeRow(page, name)).toBeVisible();
}

export async function renameRow(
  page: Page,
  from: string,
  to: string
): Promise<void> {
  await treeRow(page, from).dblclick();
  const rename = page.getByRole("textbox", { name: "Rename" });
  await rename.fill(to);
  await rename.press("Enter");
}

export async function deleteBlock(
  page: Page,
  name: string
): Promise<void> {
  await treeRow(page, name).click();
  await hierarchyAction(page, "Delete").click();
  await dialog(page, "Delete Block")
    .getByRole("button", { name: "Delete" })
    .click();
}

export async function rowMenu(
  page: Page,
  name: string
): Promise<Locator> {
  await treeRow(page, name).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Hierarchy actions" });
  await expect(menu).toBeVisible();

  return menu;
}
