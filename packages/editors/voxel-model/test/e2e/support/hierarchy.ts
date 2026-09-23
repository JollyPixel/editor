// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  checkboxField,
  dialog,
  textField,
  treeRow
} from "@jolly-pixel/e2e";

export type NodeKind = "Block" | "Folder";

export interface AddNodeOptions {
  asChild?: boolean;
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
  await hierarchyAction(page, `Add ${kind}`).click();
  const form = dialog(page, `New ${kind}`);
  await textField(form, `${kind} name`).fill(name);
  if (options.asChild === false) {
    await checkboxField(form, "Add as child of selection").uncheck();
  }
  await form.getByRole("button", { name: "OK" }).click();
  await expect(form).toBeHidden();
  await expect(treeRow(page, name)).toBeVisible();
}
