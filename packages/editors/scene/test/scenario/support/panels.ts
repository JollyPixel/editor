// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";

export function hierarchy(
  page: Page
): Locator {
  return page.locator("jolly-scene-hierarchy");
}

export function inspector(
  page: Page
): Locator {
  return page.locator("jolly-scene-inspector");
}

export function sceneTool(
  page: Page,
  tool: string
): Locator {
  return page.locator(
    `#scene-viewport jolly-tool-button[data-tool="${tool}"]`
  );
}

export function inspectedActor(
  page: Page
): Locator {
  return inspector(page).locator("jolly-folder[key=\"actor\"]");
}

export type TransformField = "Position" | "Rotation" | "Scale";
export type TransformAxis = "X" | "Y" | "Z";

export function transformAxis(
  page: Page,
  field: TransformField,
  axis: TransformAxis
): Locator {
  return inspector(page)
    .locator(`jolly-folder[key="transform"] jolly-vector3[label="${field}"]`)
    .getByRole("textbox", { name: axis });
}

export async function editTransform(
  page: Page,
  field: TransformField,
  axis: TransformAxis,
  value: string
): Promise<void> {
  const input = transformAxis(page, field, axis);
  await input.fill(value);
  await input.press("Enter");
}

async function chooseMenuPath(
  page: Page,
  menuName: string,
  path: readonly string[]
): Promise<void> {
  const menu = page.getByRole("menu", { name: menuName });
  await expect(menu).toBeVisible();
  for (const item of path) {
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  }
}

export async function addActor(
  page: Page,
  path: readonly string[]
): Promise<void> {
  await hierarchy(page)
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await chooseMenuPath(page, "Hierarchy actions", path);
}

export async function addComponent(
  page: Page,
  path: readonly string[]
): Promise<void> {
  await hierarchy(page)
    .getByRole("treeitem", { selected: true })
    .click({ button: "right" });
  await chooseMenuPath(page, "Hierarchy actions", ["Add component", ...path]);
}
