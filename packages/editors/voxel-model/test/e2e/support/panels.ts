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

export function textField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-text")
    .filter({ hasText: label })
    .getByRole("textbox");
}

export function checkboxField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-checkbox")
    .filter({ hasText: label })
    .getByRole("checkbox");
}

export function treeRow(
  page: Page,
  name: string
): Locator {
  return page.getByRole("treeitem").filter({
    has: page.getByText(name, { exact: true })
  });
}
