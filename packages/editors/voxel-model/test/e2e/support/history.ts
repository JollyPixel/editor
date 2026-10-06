// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export function historyBar(
  page: Page
): Locator {
  return page.locator("jolly-model-editor-history jolly-model-editor-history-buttons");
}

export function historyButton(
  page: Page,
  label: "Undo" | "Redo" | "Refused steps"
): Locator {
  return historyBar(page).locator(`jolly-button[label="${label}"]`);
}
