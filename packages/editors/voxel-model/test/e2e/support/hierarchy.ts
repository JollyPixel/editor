// Import Third-party Dependencies
import {
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  checkboxField,
  dialog,
  textField,
  treeRow
} from "./panels.ts";

export type NodeKind = "Block" | "Folder";

export interface AddNodeOptions {
  asChild?: boolean;
}

export async function addNode(
  page: Page,
  kind: NodeKind,
  name: string,
  options: AddNodeOptions = {}
): Promise<void> {
  await page.getByRole("button", { name: `Add ${kind}` }).click();
  const form = dialog(page, `New ${kind}`);
  await textField(form, `${kind} name`).fill(name);
  if (options.asChild === false) {
    await checkboxField(form, "Add as child of selection").uncheck();
  }
  await form.getByRole("button", { name: "OK" }).click();
  await expect(form).toBeHidden();
  await expect(treeRow(page, name)).toBeVisible();
}
