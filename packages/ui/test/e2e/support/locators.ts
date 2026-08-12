// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export function fieldRow(
  page: Page,
  tag: string,
  state: string
): Locator {
  return page.locator(`[data-state="${state}"] ${tag}`);
}
