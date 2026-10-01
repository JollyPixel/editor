// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// CONSTANTS
export const TREE_SELECTOR = "jolly-tree";

export function rowOf(
  page: Page,
  id: string
): Locator {
  return page.locator(`${TREE_SELECTOR} .row[data-id="${id}"]`);
}
