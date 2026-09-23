// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export function dialog(
  page: Page,
  heading: string
): Locator {
  return page.locator("jolly-dialog")
    .filter({ has: page.locator("dialog[open]") })
    .filter({ has: page.getByRole("banner").filter({ hasText: heading }) });
}

export function titledDialog(
  page: Page,
  title: string
): Locator {
  return page.locator(`jolly-dialog[heading-editable][heading="${title}"]`)
    .filter({ has: page.locator("dialog[open]") });
}

export function dialogTitle(
  scope: Locator
): Locator {
  return scope.getByRole("textbox", { name: "Title" });
}

export function textField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-text")
    .filter({ hasText: label })
    .getByRole("textbox");
}

export function selectField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-select")
    .filter({ hasText: label })
    .getByRole("combobox");
}

export function checkboxField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-checkbox")
    .filter({ hasText: label })
    .getByRole("checkbox");
}

export function buttonGroup(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-button-group")
    .filter({ hasText: label })
    .getByRole("radiogroup");
}

export function treeRow(
  page: Page,
  name: string
): Locator {
  return page.getByRole("treeitem").filter({
    has: page.getByText(name, { exact: true })
  });
}

export function fieldRow(
  page: Page,
  tag: string,
  state: string
): Locator {
  return page.locator(`[data-state="${state}"] ${tag}`);
}
