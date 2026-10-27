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
    `jolly-scene-toolbar jolly-tool-button[data-tool="${tool}"]`
  );
}

export function inspectedActor(
  page: Page
): Locator {
  return inspector(page).locator("jolly-folder[key=\"actor\"]");
}

export async function editTransform(
  page: Page,
  field: "Position" | "Rotation" | "Scale",
  axis: "X" | "Y" | "Z",
  value: string
): Promise<void> {
  const actor = inspectedActor(page);
  await actor.getByRole("radio", { name: field }).click();

  const input = actor
    .locator("jolly-vector3")
    .getByRole("textbox", { name: axis });
  await input.fill(value);
  await input.press("Enter");
}

export async function chooseMenuPath(
  page: Page,
  opener: Locator,
  menuName: string,
  path: readonly string[]
): Promise<void> {
  await opener.click();
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
  await chooseMenuPath(
    page,
    hierarchy(page).getByRole("button", { name: "Add", exact: true }),
    "Hierarchy actions",
    path
  );
}

export async function addComponent(
  page: Page,
  label: string
): Promise<void> {
  await chooseMenuPath(
    page,
    inspector(page).getByRole("button", { name: "Add component" }),
    "Add component",
    [label]
  );
}
