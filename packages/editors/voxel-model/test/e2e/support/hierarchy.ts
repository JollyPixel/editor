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
  /** Adds inside this row through its menu instead of at the root. */
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

export async function rowMenu(
  page: Page,
  name: string
): Promise<Locator> {
  await treeRow(page, name).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Hierarchy actions" });
  await expect(menu).toBeVisible();

  return menu;
}

export function materialTab(
  page: Page
): Locator {
  return page.locator("jolly-model-editor-material-library");
}

export async function openMaterialTab(
  page: Page
): Promise<Locator> {
  await page.getByRole("tab", { name: "Material" }).click();
  const library = materialTab(page);
  await expect(library).toBeVisible();

  return library;
}

export async function openMaterial(
  page: Page,
  name: string
): Promise<Locator> {
  const row = treeRow(page, name);
  await row.hover();
  await row.getByRole("button", { name: /material/i }).click();
  const library = materialTab(page);
  await expect(library).toBeVisible();
  await expect(materialBlockBar(page)).toContainText(name);

  return library;
}

export function materialBlockBar(
  page: Page
): Locator {
  return materialTab(page).locator(".block-bar");
}

export async function materialTool(
  page: Page,
  name: "New Material" | "New Folder" | "Duplicate" | "Delete"
): Promise<void> {
  await materialTab(page)
    .getByRole("toolbar", { name: "Material tools" })
    .getByRole("button", { name, exact: true })
    .click();
}

export function materialMenu(
  page: Page
): Locator {
  return page.getByRole("menu", { name: "Material actions" });
}

export async function newMaterial(
  page: Page,
  preset: string
): Promise<void> {
  await materialTool(page, "New Material");
  await materialMenu(page).getByRole("menuitem", { name: preset }).click();
}

export function materialRow(
  page: Page,
  name: string
): Locator {
  return materialTab(page).getByRole("treeitem").filter({
    has: page.getByText(name, { exact: true })
  });
}

export async function materialRowMenu(
  page: Page,
  name: string | null
): Promise<Locator> {
  if (name === null) {
    const tree = (await materialTab(page).locator("jolly-tree").boundingBox())!;
    await page.mouse.click(tree.x + 20, tree.y + tree.height - 10, { button: "right" });
  }
  else {
    await materialRow(page, name).click({ button: "right" });
  }
  const menu = materialMenu(page);
  await expect(menu).toBeVisible();

  return menu;
}

export async function dragMaterialSlider(
  page: Page,
  name: string,
  fraction: number
): Promise<void> {
  const slider = materialTab(page).getByRole("slider", { name });
  const box = (await slider.boundingBox())!;
  const y = box.y + (box.height / 2);

  await page.mouse.move(box.x + 1, y);
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * fraction), y, { steps: 4 });
  await page.mouse.up();
}
